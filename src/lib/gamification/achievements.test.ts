/**
 * Tests for Achievement Checker
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAndUnlockAchievements } from './achievements';
import {
  AchievementCategory,
  AchievementRequirementType,
  UserTier,
  type UserStats,
  type Achievement,
} from '@/types/database';

// Hoisted mock references
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

// Mock dependencies
vi.mock('@/lib/api/supabase', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  mockEq.mockReturnThis();
  mockSelect.mockReturnThis();
  mockInsert.mockReturnThis();
  mockUpdate.mockReturnThis();
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockOrder.mockReturnThis();

  mockFrom.mockReturnValue({
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
  });

  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
});

describe('Achievement Checker', () => {
  const testWallet = '5z6YBKv8VZ9QA3j4K8tYfN7kXp2Hq1Wr9Lm3Bn4Cx5Dy';

  const mockStats: UserStats = {
    wallet_address: testWallet,
    total_points: 100,
    current_streak_days: 1,
    longest_streak_days: 1,
    last_active_date: '2024-01-01',
    total_agents_created: 1,
    total_content_generated: 10,
    total_posts_published: 5,
    tier: UserTier.NEWCOMER,
    updated_at: new Date().toISOString(),
  };

  const mockAchievements: Achievement[] = [
    {
      id: 'achievement-1',
      slug: 'first-steps',
      name: 'First Steps',
      description: 'Create your first agent',
      icon: '🚀',
      category: AchievementCategory.CREATION,
      requirement_type: AchievementRequirementType.COUNT,
      requirement_value: 1,
      points_reward: 100,
      tier_required: null,
      created_at: new Date().toISOString(),
    },
    {
      id: 'achievement-2',
      slug: 'wordsmith',
      name: 'Wordsmith',
      description: 'Generate 10 text posts',
      icon: '✍️',
      category: AchievementCategory.CREATION,
      requirement_type: AchievementRequirementType.COUNT,
      requirement_value: 10,
      points_reward: 250,
      tier_required: null,
      created_at: new Date().toISOString(),
    },
  ];

  describe('checkAndUnlockAchievements', () => {
    it('should unlock qualifying achievements', async () => {
      // Mock user_stats select
      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockStats, error: null }),
        }),
      });

      // Mock achievements select (with LEFT JOIN)
      mockSelect.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: mockAchievements.map((a) => ({ ...a, user_achievements: [] })),
          error: null,
        }),
      });

      // Mock all inserts (user_achievements + user_points) - plain inserts
      mockInsert.mockResolvedValue({ error: null });

      // Mock user_stats update for bonus points
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await checkAndUnlockAchievements(testWallet);

      // Both achievements should be unlocked
      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe('first-steps');
      expect(result[1].slug).toBe('wordsmith');
      // 2 user_achievements inserts + 2 user_points inserts = 4
      expect(mockInsert).toHaveBeenCalledTimes(4);
    });

    it('should skip achievements that do not meet requirements', async () => {
      const statsWithoutQualification: UserStats = {
        ...mockStats,
        total_content_generated: 5, // Does not meet wordsmith requirement
      };

      // Mock user_stats select
      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: statsWithoutQualification, error: null }),
        }),
      });

      // Mock achievements select
      mockSelect.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: mockAchievements.map((a) => ({ ...a, user_achievements: [] })),
          error: null,
        }),
      });

      mockInsert.mockResolvedValue({ error: null });
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await checkAndUnlockAchievements(testWallet);

      // Only first-steps should be unlocked
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('first-steps');
      // 1 user_achievements insert + 1 user_points insert = 2
      expect(mockInsert).toHaveBeenCalledTimes(2);
    });

    it('should skip already unlocked achievements', async () => {
      // Mock user_stats select
      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockStats, error: null }),
        }),
      });

      // Mock achievements select (first-steps already unlocked)
      mockSelect.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: [
            { ...mockAchievements[0], user_achievements: [{ wallet_address: testWallet }] },
            { ...mockAchievements[1], user_achievements: [] },
          ],
          error: null,
        }),
      });

      mockInsert.mockResolvedValue({ error: null });
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await checkAndUnlockAchievements(testWallet);

      // Only wordsmith should be unlocked
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('wordsmith');
    });

    it('should award bonus points for unlocked achievements', async () => {
      // Mock user_stats select (first for achievement check, second for points update)
      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockStats, error: null }),
        }),
      });

      // Mock achievements select
      mockSelect.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: [{ ...mockAchievements[0], user_achievements: [] }],
          error: null,
        }),
      });

      // Mock all inserts (user_achievements + user_points) - plain inserts
      mockInsert.mockResolvedValue({ error: null });

      // Mock user_stats update for bonus points
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      await checkAndUnlockAchievements(testWallet);

      expect(mockInsert).toHaveBeenCalledWith({
        wallet_address: testWallet,
        points_type: 'referral',
        points_amount: 100,
        description: 'Unlocked achievement: First Steps',
        source_type: 'achievement',
        source_id: 'achievement-1',
      });
    });

    it('should handle streak-based achievements', async () => {
      const streakAchievement: Achievement = {
        id: 'achievement-3',
        slug: 'consistent-creator',
        name: 'Consistent Creator',
        description: '7-day generation streak',
        icon: '🔥',
        category: AchievementCategory.STREAK,
        requirement_type: AchievementRequirementType.STREAK,
        requirement_value: 7,
        points_reward: 500,
        tier_required: null,
        created_at: new Date().toISOString(),
      };

      const statsWithStreak: UserStats = {
        ...mockStats,
        current_streak_days: 7,
      };

      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: statsWithStreak, error: null }),
        }),
      });

      mockSelect.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: [{ ...streakAchievement, user_achievements: [] }],
          error: null,
        }),
      });

      mockInsert.mockResolvedValue({ error: null });
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await checkAndUnlockAchievements(testWallet);

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('consistent-creator');
    });

    it('should handle milestone-based achievements', async () => {
      const milestoneAchievement: Achievement = {
        id: 'achievement-4',
        slug: 'influencer-status',
        name: 'Influencer Status',
        description: 'Reach 1000 total points',
        icon: '👑',
        category: AchievementCategory.ENGAGEMENT,
        requirement_type: AchievementRequirementType.MILESTONE,
        requirement_value: 1000,
        points_reward: 0,
        tier_required: null,
        created_at: new Date().toISOString(),
      };

      const statsWithPoints: UserStats = {
        ...mockStats,
        total_points: 1000,
      };

      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: statsWithPoints, error: null }),
        }),
      });

      mockSelect.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: [{ ...milestoneAchievement, user_achievements: [] }],
          error: null,
        }),
      });

      mockInsert.mockResolvedValue({ error: null });

      const result = await checkAndUnlockAchievements(testWallet);

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('influencer-status');
    });

    it('should handle race condition on duplicate unlock', async () => {
      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockStats, error: null }),
        }),
      });

      mockSelect.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: [{ ...mockAchievements[0], user_achievements: [] }],
          error: null,
        }),
      });

      // Mock user_achievements insert with duplicate key error
      mockInsert.mockResolvedValueOnce({ error: { code: '23505' } });

      const result = await checkAndUnlockAchievements(testWallet);

      // Should return empty array (achievement already unlocked)
      expect(result).toHaveLength(0);
    });

    it('should return empty array if user stats not found', async () => {
      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
        }),
      });

      const result = await checkAndUnlockAchievements(testWallet);

      expect(result).toHaveLength(0);
    });
  });
});
