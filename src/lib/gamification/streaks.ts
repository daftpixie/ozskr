/**
 * Streak Tracker
 * Updates user activity streaks and awards streak bonuses
 */

import { createSupabaseServerClient } from '@/lib/api/supabase';
import { logger } from '@/lib/utils/logger';
import { PointsType, PointsSourceType } from '@/types/database';
import { WalletAddressSchema } from '@/types/schemas';
import { POINTS_VALUES } from './points';

/**
 * Result from streak update
 */
export interface StreakUpdateResult {
  currentStreak: number;
  isNewDay: boolean;
  streakBonusAwarded: number;
}

/**
 * Maximum streak days for bonus calculation (caps at 30 days)
 */
const MAX_STREAK_BONUS_DAYS = 30;

/**
 * Update user's activity streak
 *
 * This function:
 * 1. Fetches user_stats.last_active_date
 * 2. Compares with today's date:
 *    - If last_active_date was yesterday → increment current_streak_days, award streak bonus
 *    - If last_active_date is today → no change (isNewDay = false)
 *    - If last_active_date is before yesterday (or null) → reset to 1
 * 3. Updates longest_streak_days if current exceeds it
 * 4. Updates last_active_date to today
 * 5. Awards streak bonus: STREAK_BONUS_PER_DAY × min(current_streak_days, 30)
 *
 * @param walletAddress - User's wallet address
 * @returns Current streak, whether it's a new day, and bonus awarded
 * @throws Error if database operations fail
 */
export async function updateStreak(walletAddress: string): Promise<StreakUpdateResult> {
  // Validate wallet address format
  WalletAddressSchema.parse(walletAddress);

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  }

  const supabase = createSupabaseServerClient(serviceRoleKey);

  try {
    // 1. Fetch or create user_stats
    let { data: stats, error: statsError } = await supabase
      .from('user_stats')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    // If stats don't exist, create default entry
    if (statsError && statsError.code === 'PGRST116') {
      const { data: newStats, error: insertError } = await supabase
        .from('user_stats')
        .insert({
          wallet_address: walletAddress,
        })
        .select()
        .single();

      if (insertError || !newStats) {
        logger.error('Failed to create user_stats for streak', {
          walletAddress,
          error: insertError?.message,
        });
        throw new Error(`Failed to create user stats: ${insertError?.message}`);
      }
      stats = newStats;
    } else if (statsError || !stats) {
      logger.error('Failed to fetch user_stats for streak', {
        walletAddress,
        error: statsError?.message,
      });
      throw new Error(`Failed to fetch user stats: ${statsError?.message}`);
    }

    // 2. Get today's date (YYYY-MM-DD format)
    const today = new Date().toISOString().split('T')[0];
    const lastActiveDate = stats.last_active_date;

    // If last active date is today, no update needed
    if (lastActiveDate === today) {
      return {
        currentStreak: stats.current_streak_days,
        isNewDay: false,
        streakBonusAwarded: 0,
      };
    }

    // 3. Calculate new streak
    let newStreakDays = 1;
    let streakBonusAwarded = 0;

    if (lastActiveDate) {
      const lastDate = new Date(lastActiveDate);
      const todayDate = new Date(today);
      const diffMs = todayDate.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Yesterday → increment streak
        newStreakDays = stats.current_streak_days + 1;
      } else if (diffDays > 1) {
        // Missed days → reset to 1
        newStreakDays = 1;
      }
    }

    // 4. Calculate longest streak
    const newLongestStreak = Math.max(stats.longest_streak_days, newStreakDays);

    // 5. Calculate streak bonus (only if streak continued)
    if (newStreakDays > 1) {
      const bonusDays = Math.min(newStreakDays, MAX_STREAK_BONUS_DAYS);
      streakBonusAwarded = POINTS_VALUES.STREAK_BONUS_PER_DAY * bonusDays;
    }

    // 6. Update user_stats
    const { error: updateError } = await supabase
      .from('user_stats')
      .update({
        current_streak_days: newStreakDays,
        longest_streak_days: newLongestStreak,
        last_active_date: today,
      })
      .eq('wallet_address', walletAddress);

    if (updateError) {
      logger.error('Failed to update streak', {
        walletAddress,
        error: updateError.message,
      });
      throw new Error(`Failed to update streak: ${updateError.message}`);
    }

    // 7. Award streak bonus if applicable
    if (streakBonusAwarded > 0) {
      const { error: pointsError } = await supabase
        .from('user_points')
        .insert({
          wallet_address: walletAddress,
          points_type: PointsType.STREAK,
          points_amount: streakBonusAwarded,
          description: `${newStreakDays}-day streak bonus`,
          source_type: PointsSourceType.ACHIEVEMENT,
          source_id: null,
        });

      if (pointsError) {
        logger.error('Failed to award streak bonus points', {
          walletAddress,
          streakBonusAwarded,
          error: pointsError.message,
        });
        // Don't throw - streak was updated successfully
      } else {
        // Update total_points in user_stats
        await supabase
          .from('user_stats')
          .update({
            total_points: stats.total_points + streakBonusAwarded,
          })
          .eq('wallet_address', walletAddress);
      }
    }

    logger.info('Streak updated successfully', {
      walletAddress,
      currentStreak: newStreakDays,
      longestStreak: newLongestStreak,
      bonusAwarded: streakBonusAwarded,
    });

    return {
      currentStreak: newStreakDays,
      isNewDay: true,
      streakBonusAwarded,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('updateStreak failed', {
      walletAddress,
      error: message,
    });
    throw error;
  }
}
