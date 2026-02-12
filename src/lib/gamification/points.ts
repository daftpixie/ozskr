/**
 * Points Engine
 * Award points, update stats, and trigger achievement checks
 */

import { createSupabaseServerClient } from '@/lib/api/supabase';
import { PointsType, PointsSourceType, type UserPoints, type Achievement } from '@/types/database';
import { WalletAddressSchema } from '@/types/schemas';
import { getTierForPoints } from './tiers';
import { checkAndUnlockAchievements } from './achievements';
import { logger } from '@/lib/utils/logger';

/**
 * Point values for different actions
 */
export const POINTS_VALUES = {
  AGENT_CREATED: 50,
  CONTENT_GENERATED_TEXT: 10,
  CONTENT_GENERATED_IMAGE: 15,
  CONTENT_GENERATED_VIDEO: 25,
  CONTENT_PUBLISHED: 20, // per platform
  ENGAGEMENT_MILESTONE: 5, // per 10 engagements
  STREAK_BONUS_PER_DAY: 25, // caps at 30 days = 750
} as const;

/**
 * Parameters for awarding points
 */
export interface AwardPointsParams {
  walletAddress: string;
  pointsType: PointsType;
  pointsAmount: number;
  description: string;
  sourceType: PointsSourceType;
  sourceId?: string;
}

/**
 * Result from awarding points
 */
export interface AwardPointsResult {
  points: UserPoints;
  newAchievements: Achievement[];
}

/**
 * Award points to a user and update their stats
 *
 * This function:
 * 1. Inserts a new entry into user_points (append-only ledger)
 * 2. Upserts user_stats to increment total_points
 * 3. Recalculates and updates the user's tier
 * 4. Checks for newly unlocked achievements
 *
 * @param params - Points award parameters
 * @returns The created points record and any newly unlocked achievements
 * @throws Error if database operations fail
 */
export async function awardPoints(params: AwardPointsParams): Promise<AwardPointsResult> {
  // Validate wallet address format
  WalletAddressSchema.parse(params.walletAddress);

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  }

  const supabase = createSupabaseServerClient(serviceRoleKey);

  try {
    // 1. Insert into user_points ledger
    const { data: pointsRecord, error: pointsError } = await supabase
      .from('user_points')
      .insert({
        wallet_address: params.walletAddress,
        points_type: params.pointsType,
        points_amount: params.pointsAmount,
        description: params.description,
        source_type: params.sourceType,
        source_id: params.sourceId || null,
      })
      .select()
      .single();

    if (pointsError || !pointsRecord) {
      logger.error('Failed to insert user_points record', {
        walletAddress: params.walletAddress,
        error: pointsError?.message,
      });
      throw new Error(`Failed to insert points: ${pointsError?.message}`);
    }

    // 2. Fetch or create user_stats
    let { data: stats, error: statsError } = await supabase
      .from('user_stats')
      .select('*')
      .eq('wallet_address', params.walletAddress)
      .single();

    // If stats don't exist, create default entry
    if (statsError && statsError.code === 'PGRST116') {
      const { data: newStats, error: insertError } = await supabase
        .from('user_stats')
        .insert({
          wallet_address: params.walletAddress,
        })
        .select()
        .single();

      if (insertError || !newStats) {
        logger.error('Failed to create user_stats', {
          walletAddress: params.walletAddress,
          error: insertError?.message,
        });
        throw new Error(`Failed to create user stats: ${insertError?.message}`);
      }
      stats = newStats;
    } else if (statsError || !stats) {
      logger.error('Failed to fetch user_stats', {
        walletAddress: params.walletAddress,
        error: statsError?.message,
      });
      throw new Error(`Failed to fetch user stats: ${statsError?.message}`);
    }

    // 3. Calculate new total points and tier
    const newTotalPoints = stats.total_points + params.pointsAmount;
    const newTier = getTierForPoints(newTotalPoints);

    // 4. Update stat counters based on point type
    const statUpdates: Record<string, unknown> = {
      total_points: newTotalPoints,
      tier: newTier,
    };

    // Increment activity-specific counters
    if (params.sourceType === PointsSourceType.CHARACTER) {
      statUpdates.total_agents_created = stats.total_agents_created + 1;
    } else if (params.sourceType === PointsSourceType.CONTENT) {
      statUpdates.total_content_generated = stats.total_content_generated + 1;
    } else if (params.sourceType === PointsSourceType.SOCIAL_POST) {
      statUpdates.total_posts_published = stats.total_posts_published + 1;
    }

    // 5. Upsert user_stats with new totals
    const { error: updateError } = await supabase
      .from('user_stats')
      .update(statUpdates)
      .eq('wallet_address', params.walletAddress);

    if (updateError) {
      logger.error('Failed to update user_stats', {
        walletAddress: params.walletAddress,
        error: updateError.message,
      });
      throw new Error(`Failed to update user stats: ${updateError.message}`);
    }

    // 6. Check for newly unlocked achievements
    const newAchievements = await checkAndUnlockAchievements(params.walletAddress);

    logger.info('Points awarded successfully', {
      walletAddress: params.walletAddress,
      pointsAmount: params.pointsAmount,
      newTotalPoints,
      tier: newTier,
      newAchievementsCount: newAchievements.length,
    });

    return {
      points: pointsRecord,
      newAchievements,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('awardPoints failed', {
      walletAddress: params.walletAddress,
      error: message,
    });
    throw error;
  }
}
