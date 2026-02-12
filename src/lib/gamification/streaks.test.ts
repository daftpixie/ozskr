/**
 * Tests for Streak Tracker
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateStreak } from './streaks';
import { UserTier, type UserStats } from '@/types/database';

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

beforeEach(() => {
  vi.clearAllMocks();

  mockEq.mockReturnThis();
  mockSelect.mockReturnThis();
  mockInsert.mockReturnThis();
  mockUpdate.mockReturnThis();
  mockSingle.mockResolvedValue({ data: null, error: null });

  mockFrom.mockReturnValue({
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
  });

  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
});

describe('Streak Tracker', () => {
  const testWallet = '5z6YBKv8VZ9QA3j4K8tYfN7kXp2Hq1Wr9Lm3Bn4Cx5Dy';

  describe('updateStreak', () => {
    it('should increment streak when last active was yesterday', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDate = yesterday.toISOString().split('T')[0];

      const mockStats: UserStats = {
        wallet_address: testWallet,
        total_points: 100,
        current_streak_days: 5,
        longest_streak_days: 5,
        last_active_date: yesterdayDate,
        total_agents_created: 1,
        total_content_generated: 10,
        total_posts_published: 5,
        tier: UserTier.NEWCOMER,
        updated_at: new Date().toISOString(),
      };

      // Mock user_stats select
      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockStats, error: null }),
        }),
      });

      // Mock user_stats update
      const mockUpdateFn = vi.fn().mockResolvedValue({ error: null });
      mockUpdate.mockReturnValueOnce({
        eq: mockUpdateFn,
      });

      // Mock user_points insert (plain insert, no chain)
      mockInsert.mockResolvedValueOnce({ error: null });

      // Mock user_stats update for points
      mockUpdate.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await updateStreak(testWallet);

      expect(result.currentStreak).toBe(6);
      expect(result.isNewDay).toBe(true);
      expect(result.streakBonusAwarded).toBe(150); // 25 * 6 days
      expect(mockUpdateFn).toHaveBeenCalledWith('wallet_address', testWallet);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          current_streak_days: 6,
          longest_streak_days: 6,
        })
      );
    });

    it('should not change streak when already active today', async () => {
      const today = new Date().toISOString().split('T')[0];

      const mockStats: UserStats = {
        wallet_address: testWallet,
        total_points: 100,
        current_streak_days: 3,
        longest_streak_days: 5,
        last_active_date: today,
        total_agents_created: 1,
        total_content_generated: 10,
        total_posts_published: 5,
        tier: UserTier.NEWCOMER,
        updated_at: new Date().toISOString(),
      };

      // Mock user_stats select
      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockStats, error: null }),
        }),
      });

      const result = await updateStreak(testWallet);

      expect(result.currentStreak).toBe(3);
      expect(result.isNewDay).toBe(false);
      expect(result.streakBonusAwarded).toBe(0);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should reset streak to 1 when missed a day', async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoDate = twoDaysAgo.toISOString().split('T')[0];

      const mockStats: UserStats = {
        wallet_address: testWallet,
        total_points: 100,
        current_streak_days: 10,
        longest_streak_days: 10,
        last_active_date: twoDaysAgoDate,
        total_agents_created: 1,
        total_content_generated: 10,
        total_posts_published: 5,
        tier: UserTier.NEWCOMER,
        updated_at: new Date().toISOString(),
      };

      // Mock user_stats select
      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockStats, error: null }),
        }),
      });

      // Mock user_stats update
      mockUpdate.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await updateStreak(testWallet);

      expect(result.currentStreak).toBe(1);
      expect(result.isNewDay).toBe(true);
      expect(result.streakBonusAwarded).toBe(0); // No bonus on first day
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          current_streak_days: 1,
          longest_streak_days: 10, // Should preserve longest streak
        })
      );
    });

    it('should update longest streak when current exceeds it', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDate = yesterday.toISOString().split('T')[0];

      const mockStats: UserStats = {
        wallet_address: testWallet,
        total_points: 100,
        current_streak_days: 9,
        longest_streak_days: 9,
        last_active_date: yesterdayDate,
        total_agents_created: 1,
        total_content_generated: 10,
        total_posts_published: 5,
        tier: UserTier.NEWCOMER,
        updated_at: new Date().toISOString(),
      };

      // Mock user_stats select
      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockStats, error: null }),
        }),
      });

      // Mock user_stats update
      mockUpdate.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      // Mock user_points insert (plain insert, no chain)
      mockInsert.mockResolvedValueOnce({ error: null });

      // Mock user_stats update for points
      mockUpdate.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await updateStreak(testWallet);

      expect(result.currentStreak).toBe(10);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          current_streak_days: 10,
          longest_streak_days: 10,
        })
      );
    });

    it('should cap streak bonus at 30 days', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDate = yesterday.toISOString().split('T')[0];

      const mockStats: UserStats = {
        wallet_address: testWallet,
        total_points: 1000,
        current_streak_days: 40,
        longest_streak_days: 40,
        last_active_date: yesterdayDate,
        total_agents_created: 1,
        total_content_generated: 100,
        total_posts_published: 50,
        tier: UserTier.CREATOR,
        updated_at: new Date().toISOString(),
      };

      // Mock user_stats select
      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockStats, error: null }),
        }),
      });

      // Mock user_stats update
      mockUpdate.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      // Mock user_points insert (plain insert, no chain)
      mockInsert.mockResolvedValueOnce({ error: null });

      // Mock user_stats update for points
      mockUpdate.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await updateStreak(testWallet);

      expect(result.currentStreak).toBe(41);
      expect(result.streakBonusAwarded).toBe(750); // 25 * 30 (capped)
    });

    it('should create user_stats if not exists', async () => {
      const mockNewStats: UserStats = {
        wallet_address: testWallet,
        total_points: 0,
        current_streak_days: 0,
        longest_streak_days: 0,
        last_active_date: null,
        total_agents_created: 0,
        total_content_generated: 0,
        total_posts_published: 0,
        tier: UserTier.NEWCOMER,
        updated_at: new Date().toISOString(),
      };

      // Mock user_stats select (not found)
      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        }),
      });

      // Mock user_stats insert
      mockInsert.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockNewStats, error: null }),
        }),
      });

      // Mock user_stats update
      mockUpdate.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await updateStreak(testWallet);

      expect(result.currentStreak).toBe(1);
      expect(result.isNewDay).toBe(true);
      expect(result.streakBonusAwarded).toBe(0);
    });

    it('should start streak at 1 when last_active_date is null', async () => {
      const mockStats: UserStats = {
        wallet_address: testWallet,
        total_points: 0,
        current_streak_days: 0,
        longest_streak_days: 0,
        last_active_date: null,
        total_agents_created: 0,
        total_content_generated: 0,
        total_posts_published: 0,
        tier: UserTier.NEWCOMER,
        updated_at: new Date().toISOString(),
      };

      // Mock user_stats select
      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockStats, error: null }),
        }),
      });

      // Mock user_stats update
      mockUpdate.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await updateStreak(testWallet);

      expect(result.currentStreak).toBe(1);
      expect(result.isNewDay).toBe(true);
      expect(result.streakBonusAwarded).toBe(0);
    });
  });
});
