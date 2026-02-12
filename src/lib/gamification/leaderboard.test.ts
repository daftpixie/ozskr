/**
 * Tests for Leaderboard Refresh
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refreshLeaderboard } from './leaderboard';
import { LeaderboardPeriod, UserTier } from '@/types/database';

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
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockGte = vi.fn();
const mockOrder = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  mockEq.mockReturnThis();
  mockIn.mockReturnThis();
  mockGte.mockReturnThis();
  mockSelect.mockReturnThis();
  mockInsert.mockReturnThis();
  mockDelete.mockReturnThis();
  mockOrder.mockResolvedValue({ data: [], error: null });

  mockFrom.mockReturnValue({
    insert: mockInsert,
    select: mockSelect,
    delete: mockDelete,
  });

  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
});

describe('Leaderboard Refresh', () => {
  describe('refreshLeaderboard - all_time period', () => {
    it('should rank users by total_points from user_stats', async () => {
      const mockStatsData = [
        {
          wallet_address: 'wallet1',
          total_points: 1000,
          tier: UserTier.INFLUENCER,
        },
        {
          wallet_address: 'wallet2',
          total_points: 500,
          tier: UserTier.CREATOR,
        },
        {
          wallet_address: 'wallet3',
          total_points: 2000,
          tier: UserTier.MOGUL,
        },
      ];

      const mockUsersData = [
        { wallet_address: 'wallet1', display_name: 'User 1' },
        { wallet_address: 'wallet2', display_name: 'User 2' },
        { wallet_address: 'wallet3', display_name: null },
      ];

      // Mock user_stats select
      mockSelect.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({ data: mockStatsData, error: null }),
      });

      // Mock users select
      mockSelect.mockReturnValueOnce({
        in: vi.fn().mockResolvedValue({ data: mockUsersData, error: null }),
      });

      // Mock leaderboard_cache delete
      mockDelete.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      // Mock leaderboard_cache insert
      mockInsert.mockResolvedValue({ error: null });

      await refreshLeaderboard(LeaderboardPeriod.ALL_TIME);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            wallet_address: 'wallet1',
            display_name: 'User 1',
            total_points: 1000,
            rank: 1,
            tier: UserTier.INFLUENCER,
            period: LeaderboardPeriod.ALL_TIME,
          }),
          expect.objectContaining({
            wallet_address: 'wallet2',
            display_name: 'User 2',
            total_points: 500,
            rank: 2,
            tier: UserTier.CREATOR,
          }),
          expect.objectContaining({
            wallet_address: 'wallet3',
            display_name: null,
            total_points: 2000,
            rank: 3,
            tier: UserTier.MOGUL,
          }),
        ])
      );
    });

    it('should delete old cache entries before inserting new ones', async () => {
      const mockStatsData = [
        {
          wallet_address: 'wallet1',
          total_points: 1000,
          tier: UserTier.INFLUENCER,
        },
      ];

      mockSelect.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({ data: mockStatsData, error: null }),
      });

      mockSelect.mockReturnValueOnce({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      const mockDeleteFn = vi.fn().mockResolvedValue({ error: null });
      mockDelete.mockReturnValueOnce({
        eq: mockDeleteFn,
      });

      mockInsert.mockResolvedValue({ error: null });

      await refreshLeaderboard(LeaderboardPeriod.ALL_TIME);

      expect(mockDeleteFn).toHaveBeenCalledWith('period', LeaderboardPeriod.ALL_TIME);
    });
  });

  describe('refreshLeaderboard - time-based periods', () => {
    it('should sum user_points within daily window', async () => {
      const mockPointsData = [
        { wallet_address: 'wallet1', points_amount: 50 },
        { wallet_address: 'wallet1', points_amount: 30 },
        { wallet_address: 'wallet2', points_amount: 100 },
      ];

      const mockStatsData = [
        { wallet_address: 'wallet1', tier: UserTier.NEWCOMER },
        { wallet_address: 'wallet2', tier: UserTier.CREATOR },
      ];

      const mockUsersData = [
        { wallet_address: 'wallet1', display_name: 'User 1' },
        { wallet_address: 'wallet2', display_name: 'User 2' },
      ];

      // Mock user_points select
      mockSelect.mockReturnValueOnce({
        gte: vi.fn().mockResolvedValue({ data: mockPointsData, error: null }),
      });

      // Mock user_stats select
      mockSelect.mockReturnValueOnce({
        in: vi.fn().mockResolvedValue({ data: mockStatsData, error: null }),
      });

      // Mock users select
      mockSelect.mockReturnValueOnce({
        in: vi.fn().mockResolvedValue({ data: mockUsersData, error: null }),
      });

      // Mock leaderboard_cache delete
      mockDelete.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      // Mock leaderboard_cache insert
      mockInsert.mockResolvedValue({ error: null });

      await refreshLeaderboard(LeaderboardPeriod.DAILY);

      // wallet2 should be rank 1 (100 points), wallet1 rank 2 (80 points)
      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            wallet_address: 'wallet2',
            total_points: 100,
            rank: 1,
          }),
          expect.objectContaining({
            wallet_address: 'wallet1',
            total_points: 80,
            rank: 2,
          }),
        ])
      );
    });

    it('should handle weekly period correctly', async () => {
      const mockPointsData = [
        { wallet_address: 'wallet1', points_amount: 150 },
      ];

      const mockStatsData = [
        { wallet_address: 'wallet1', tier: UserTier.CREATOR },
      ];

      const mockUsersData = [
        { wallet_address: 'wallet1', display_name: 'User 1' },
      ];

      mockSelect.mockReturnValueOnce({
        gte: vi.fn().mockResolvedValue({ data: mockPointsData, error: null }),
      });

      mockSelect.mockReturnValueOnce({
        in: vi.fn().mockResolvedValue({ data: mockStatsData, error: null }),
      });

      mockSelect.mockReturnValueOnce({
        in: vi.fn().mockResolvedValue({ data: mockUsersData, error: null }),
      });

      mockDelete.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockInsert.mockResolvedValue({ error: null });

      await refreshLeaderboard(LeaderboardPeriod.WEEKLY);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            period: LeaderboardPeriod.WEEKLY,
            total_points: 150,
          }),
        ])
      );
    });

    it('should handle monthly period correctly', async () => {
      const mockPointsData = [
        { wallet_address: 'wallet1', points_amount: 500 },
      ];

      const mockStatsData = [
        { wallet_address: 'wallet1', tier: UserTier.INFLUENCER },
      ];

      const mockUsersData = [
        { wallet_address: 'wallet1', display_name: 'User 1' },
      ];

      mockSelect.mockReturnValueOnce({
        gte: vi.fn().mockResolvedValue({ data: mockPointsData, error: null }),
      });

      mockSelect.mockReturnValueOnce({
        in: vi.fn().mockResolvedValue({ data: mockStatsData, error: null }),
      });

      mockSelect.mockReturnValueOnce({
        in: vi.fn().mockResolvedValue({ data: mockUsersData, error: null }),
      });

      mockDelete.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockInsert.mockResolvedValue({ error: null });

      await refreshLeaderboard(LeaderboardPeriod.MONTHLY);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            period: LeaderboardPeriod.MONTHLY,
            total_points: 500,
          }),
        ])
      );
    });
  });

  describe('refreshLeaderboard - ranking', () => {
    it('should correctly rank users by descending points', async () => {
      const mockStatsData = [
        { wallet_address: 'wallet1', total_points: 100, tier: UserTier.NEWCOMER },
        { wallet_address: 'wallet2', total_points: 500, tier: UserTier.CREATOR },
        { wallet_address: 'wallet3', total_points: 200, tier: UserTier.NEWCOMER },
      ];

      mockSelect.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({ data: mockStatsData, error: null }),
      });

      mockSelect.mockReturnValueOnce({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      mockDelete.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockInsert.mockResolvedValue({ error: null });

      await refreshLeaderboard(LeaderboardPeriod.ALL_TIME);

      const insertCall = mockInsert.mock.calls[0][0] as Array<{
        wallet_address: string;
        rank: number;
        total_points: number;
      }>;

      expect(insertCall[0].wallet_address).toBe('wallet1');
      expect(insertCall[0].rank).toBe(1);
      expect(insertCall[1].wallet_address).toBe('wallet2');
      expect(insertCall[1].rank).toBe(2);
      expect(insertCall[2].wallet_address).toBe('wallet3');
      expect(insertCall[2].rank).toBe(3);
    });
  });

  describe('refreshLeaderboard - empty results', () => {
    it('should handle no users gracefully', async () => {
      mockSelect.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      // Mock users select (for display names - still called with empty walletAddresses)
      mockSelect.mockReturnValueOnce({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      mockDelete.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      await refreshLeaderboard(LeaderboardPeriod.ALL_TIME);

      // Should not insert anything
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should handle no points in time window gracefully', async () => {
      mockSelect.mockReturnValueOnce({
        gte: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      mockDelete.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      await refreshLeaderboard(LeaderboardPeriod.DAILY);

      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe('refreshLeaderboard - error handling', () => {
    it('should throw error on database failure', async () => {
      mockSelect.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      await expect(refreshLeaderboard(LeaderboardPeriod.ALL_TIME)).rejects.toThrow(
        'Failed to fetch user_stats'
      );
    });
  });
});
