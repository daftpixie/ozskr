/**
 * Achievement Checker
 * Checks user stats against achievement requirements and unlocks qualifying achievements
 */

import { createSupabaseServerClient } from '@/lib/api/supabase';
import {
  AchievementCategory,
  AchievementRequirementType,
  PointsType,
  PointsSourceType,
  type Achievement,
  type UserStats,
} from '@/types/database';
import { WalletAddressSchema } from '@/types/schemas';
import { logger } from '@/lib/utils/logger';

/**
 * Check and unlock achievements for a user
 *
 * This function:
 * 1. Fetches user_stats for the wallet
 * 2. Fetches all achievements that are NOT yet unlocked by this user
 * 3. For each locked achievement, checks if the user's stats meet the requirement
 * 4. If requirement met: inserts into user_achievements and awards bonus points
 *
 * @param walletAddress - User's wallet address
 * @returns Array of newly unlocked achievements
 * @throws Error if database operations fail
 */
export async function checkAndUnlockAchievements(walletAddress: string): Promise<Achievement[]> {
  // Validate wallet address format
  WalletAddressSchema.parse(walletAddress);

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  }

  const supabase = createSupabaseServerClient(serviceRoleKey);

  try {
    // 1. Fetch user stats
    const { data: stats, error: statsError } = await supabase
      .from('user_stats')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (statsError || !stats) {
      logger.warn('User stats not found for achievement check', {
        walletAddress,
        error: statsError?.message,
      });
      return [];
    }

    // 2. Fetch all achievements with a LEFT JOIN to filter out already unlocked ones
    const { data: allAchievements, error: achievementsError } = await supabase
      .from('achievements')
      .select(`
        *,
        user_achievements!left(wallet_address)
      `)
      .order('requirement_value', { ascending: true });

    if (achievementsError || !allAchievements) {
      logger.error('Failed to fetch achievements', {
        walletAddress,
        error: achievementsError?.message,
      });
      return [];
    }

    // Filter out achievements already unlocked by this user
    const lockedAchievements = allAchievements.filter((achievement) => {
      const unlocks = achievement.user_achievements as unknown;
      // Check if user_achievements array exists and has entries for this wallet
      if (Array.isArray(unlocks)) {
        return !unlocks.some((ua: { wallet_address?: string }) => ua.wallet_address === walletAddress);
      }
      return true;
    });

    const newlyUnlocked: Achievement[] = [];

    // 3. Check each locked achievement against user stats
    for (const achievement of lockedAchievements) {
      // Remove join artifacts from the achievement object
      const cleanAchievement: Achievement = {
        id: achievement.id,
        slug: achievement.slug,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category,
        requirement_type: achievement.requirement_type,
        requirement_value: achievement.requirement_value,
        points_reward: achievement.points_reward,
        tier_required: achievement.tier_required,
        created_at: achievement.created_at,
      };

      if (doesUserQualify(stats, cleanAchievement)) {
        // 4. Insert into user_achievements
        const { error: unlockError } = await supabase
          .from('user_achievements')
          .insert({
            wallet_address: walletAddress,
            achievement_id: cleanAchievement.id,
          });

        if (unlockError) {
          // Skip if already unlocked (race condition)
          if (unlockError.code === '23505') {
            logger.info('Achievement already unlocked (race condition)', {
              walletAddress,
              achievementId: cleanAchievement.id,
            });
            continue;
          }
          logger.error('Failed to unlock achievement', {
            walletAddress,
            achievementId: cleanAchievement.id,
            error: unlockError.message,
          });
          continue;
        }

        // 5. Award bonus points (but don't recurse infinitely)
        if (cleanAchievement.points_reward > 0) {
          const { error: pointsError } = await supabase
            .from('user_points')
            .insert({
              wallet_address: walletAddress,
              points_type: PointsType.REFERRAL,
              points_amount: cleanAchievement.points_reward,
              description: `Unlocked achievement: ${cleanAchievement.name}`,
              source_type: PointsSourceType.ACHIEVEMENT,
              source_id: cleanAchievement.id,
            });

          if (pointsError) {
            logger.error('Failed to award achievement bonus points', {
              walletAddress,
              achievementId: cleanAchievement.id,
              error: pointsError.message,
            });
          } else {
            // Update total_points in user_stats (no tier recalc needed since we just checked achievements)
            await supabase
              .from('user_stats')
              .update({
                total_points: stats.total_points + cleanAchievement.points_reward,
              })
              .eq('wallet_address', walletAddress);
          }
        }

        newlyUnlocked.push(cleanAchievement);
        logger.info('Achievement unlocked', {
          walletAddress,
          achievementId: cleanAchievement.id,
          achievementName: cleanAchievement.name,
          pointsRewarded: cleanAchievement.points_reward,
        });
      }
    }

    return newlyUnlocked;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('checkAndUnlockAchievements failed', {
      walletAddress,
      error: message,
    });
    return [];
  }
}

/**
 * Check if user's stats meet an achievement's requirements
 */
function doesUserQualify(stats: UserStats, achievement: Achievement): boolean {
  const { requirement_type, requirement_value, category } = achievement;

  switch (requirement_type) {
    case AchievementRequirementType.COUNT: {
      // Determine which stat to check based on category
      let currentValue = 0;
      switch (category) {
        case AchievementCategory.CREATION:
          // Check if achievement is for agents or content
          if (achievement.slug === 'first-steps' || achievement.slug === 'multi-agent') {
            currentValue = stats.total_agents_created;
          } else {
            currentValue = stats.total_content_generated;
          }
          break;
        case AchievementCategory.PUBLISHING:
          currentValue = stats.total_posts_published;
          break;
        case AchievementCategory.ENGAGEMENT:
          // For count-based engagement, check total_posts_published
          currentValue = stats.total_posts_published;
          break;
        default:
          return false;
      }
      return currentValue >= requirement_value;
    }

    case AchievementRequirementType.STREAK: {
      // Check current streak days
      return stats.current_streak_days >= requirement_value;
    }

    case AchievementRequirementType.MILESTONE: {
      // Milestone achievements are typically points-based
      if (achievement.slug.includes('points') || achievement.slug.includes('status')) {
        return stats.total_points >= requirement_value;
      }
      // For engagement milestones, we'd need additional data (post-specific metrics)
      // For now, return false for non-points milestones
      return false;
    }

    default:
      return false;
  }
}
