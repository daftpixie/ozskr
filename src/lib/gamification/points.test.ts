/**
 * Tests for Points Engine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { awardPoints, POINTS_VALUES } from './points';
import { PointsType, PointsSourceType, UserTier } from '@/types/database';

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

vi.mock('./tiers', () => ({
  getTierForPoints: vi.fn((points: number) => {
    if (points >= 50000) return UserTier.LEGEND;
    if (points >= 10000) return UserTier.MOGUL;
    if (points >= 2000) return UserTier.INFLUENCER;
    if (points >= 500) return UserTier.CREATOR;
    return UserTier.NEWCOMER;
  }),
}));

vi.mock('./achievements', () => ({
  checkAndUnlockAchievements: vi.fn().mockResolvedValue([]),
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

// Set up mock chain
beforeEach(() => {
  vi.clearAllMocks();

  // Reset mock chain
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

  // Set SUPABASE_SERVICE_ROLE_KEY
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
});

describe('Points Engine', () => {
  const testWallet = '5z6YBKv8VZ9QA3j4K8tYfN7kXp2Hq1Wr9Lm3Bn4Cx5Dy';

  describe('awardPoints', () => {
    it('should insert into user_points and update user_stats', async () => {
      const mockPoints = {
        id: 'points-123',
        wallet_address: testWallet,
        points_type: PointsType.CREATION,
        points_amount: POINTS_VALUES.AGENT_CREATED,
        description: 'Created agent: Test',
        source_type: PointsSourceType.CHARACTER,
        source_id: 'char-123',
        created_at: new Date().toISOString(),
      };

      const mockStats = {
        wallet_address: testWallet,
        total_points: 100,
        current_streak_days: 1,
        longest_streak_days: 1,
        last_active_date: '2024-01-01',
        total_agents_created: 0,
        total_content_generated: 0,
        total_posts_published: 0,
        tier: UserTier.NEWCOMER,
        updated_at: new Date().toISOString(),
      };

      // Mock user_points insert
      mockInsert.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockPoints, error: null }),
        }),
      });

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

      const result = await awardPoints({
        walletAddress: testWallet,
        pointsType: PointsType.CREATION,
        pointsAmount: POINTS_VALUES.AGENT_CREATED,
        description: 'Created agent: Test',
        sourceType: PointsSourceType.CHARACTER,
        sourceId: 'char-123',
      });

      expect(result.points).toEqual(mockPoints);
      expect(mockInsert).toHaveBeenCalledWith({
        wallet_address: testWallet,
        points_type: PointsType.CREATION,
        points_amount: POINTS_VALUES.AGENT_CREATED,
        description: 'Created agent: Test',
        source_type: PointsSourceType.CHARACTER,
        source_id: 'char-123',
      });
    });

    it('should create user_stats if not exists', async () => {
      const mockPoints = {
        id: 'points-123',
        wallet_address: testWallet,
        points_type: PointsType.CREATION,
        points_amount: POINTS_VALUES.AGENT_CREATED,
        description: 'Created agent: Test',
        source_type: PointsSourceType.CHARACTER,
        source_id: 'char-123',
        created_at: new Date().toISOString(),
      };

      const mockNewStats = {
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

      // Mock user_points insert
      mockInsert.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockPoints, error: null }),
        }),
      });

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

      const result = await awardPoints({
        walletAddress: testWallet,
        pointsType: PointsType.CREATION,
        pointsAmount: POINTS_VALUES.AGENT_CREATED,
        description: 'Created agent: Test',
        sourceType: PointsSourceType.CHARACTER,
        sourceId: 'char-123',
      });

      expect(result.points).toEqual(mockPoints);
    });

    it('should increment total_agents_created for CHARACTER source', async () => {
      const mockPoints = {
        id: 'points-123',
        wallet_address: testWallet,
        points_type: PointsType.CREATION,
        points_amount: POINTS_VALUES.AGENT_CREATED,
        description: 'Created agent',
        source_type: PointsSourceType.CHARACTER,
        source_id: 'char-123',
        created_at: new Date().toISOString(),
      };

      const mockStats = {
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

      mockInsert.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockPoints, error: null }),
        }),
      });

      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockStats, error: null }),
        }),
      });

      const mockUpdateFn = vi.fn().mockResolvedValue({ error: null });
      mockUpdate.mockReturnValueOnce({
        eq: mockUpdateFn,
      });

      await awardPoints({
        walletAddress: testWallet,
        pointsType: PointsType.CREATION,
        pointsAmount: POINTS_VALUES.AGENT_CREATED,
        description: 'Created agent',
        sourceType: PointsSourceType.CHARACTER,
        sourceId: 'char-123',
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          total_agents_created: 1,
        })
      );
    });

    it('should increment total_content_generated for CONTENT source', async () => {
      const mockPoints = {
        id: 'points-123',
        wallet_address: testWallet,
        points_type: PointsType.GENERATION,
        points_amount: POINTS_VALUES.CONTENT_GENERATED_TEXT,
        description: 'Generated content',
        source_type: PointsSourceType.CONTENT,
        source_id: 'content-123',
        created_at: new Date().toISOString(),
      };

      const mockStats = {
        wallet_address: testWallet,
        total_points: 50,
        current_streak_days: 1,
        longest_streak_days: 1,
        last_active_date: '2024-01-01',
        total_agents_created: 1,
        total_content_generated: 0,
        total_posts_published: 0,
        tier: UserTier.NEWCOMER,
        updated_at: new Date().toISOString(),
      };

      mockInsert.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockPoints, error: null }),
        }),
      });

      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockStats, error: null }),
        }),
      });

      mockUpdate.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      await awardPoints({
        walletAddress: testWallet,
        pointsType: PointsType.GENERATION,
        pointsAmount: POINTS_VALUES.CONTENT_GENERATED_TEXT,
        description: 'Generated content',
        sourceType: PointsSourceType.CONTENT,
        sourceId: 'content-123',
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          total_content_generated: 1,
        })
      );
    });

    it('should recalculate tier after points award', async () => {
      const mockPoints = {
        id: 'points-123',
        wallet_address: testWallet,
        points_type: PointsType.CREATION,
        points_amount: 450, // Will push user to CREATOR tier (500)
        description: 'Test',
        source_type: PointsSourceType.CHARACTER,
        source_id: 'char-123',
        created_at: new Date().toISOString(),
      };

      const mockStats = {
        wallet_address: testWallet,
        total_points: 450, // Already has 450, adding 450 more = 900 (CREATOR tier)
        current_streak_days: 1,
        longest_streak_days: 1,
        last_active_date: '2024-01-01',
        total_agents_created: 9,
        total_content_generated: 0,
        total_posts_published: 0,
        tier: UserTier.NEWCOMER,
        updated_at: new Date().toISOString(),
      };

      mockInsert.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockPoints, error: null }),
        }),
      });

      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockStats, error: null }),
        }),
      });

      mockUpdate.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      await awardPoints({
        walletAddress: testWallet,
        pointsType: PointsType.CREATION,
        pointsAmount: 450,
        description: 'Test',
        sourceType: PointsSourceType.CHARACTER,
        sourceId: 'char-123',
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: UserTier.CREATOR,
          total_points: 900,
        })
      );
    });

    it('should call checkAndUnlockAchievements after awarding points', async () => {
      const mockPoints = {
        id: 'points-123',
        wallet_address: testWallet,
        points_type: PointsType.CREATION,
        points_amount: POINTS_VALUES.AGENT_CREATED,
        description: 'Test',
        source_type: PointsSourceType.CHARACTER,
        source_id: 'char-123',
        created_at: new Date().toISOString(),
      };

      const mockStats = {
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

      mockInsert.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockPoints, error: null }),
        }),
      });

      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockStats, error: null }),
        }),
      });

      mockUpdate.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const { checkAndUnlockAchievements } = await import('./achievements');

      await awardPoints({
        walletAddress: testWallet,
        pointsType: PointsType.CREATION,
        pointsAmount: POINTS_VALUES.AGENT_CREATED,
        description: 'Test',
        sourceType: PointsSourceType.CHARACTER,
        sourceId: 'char-123',
      });

      expect(checkAndUnlockAchievements).toHaveBeenCalledWith(testWallet);
    });
  });
});
