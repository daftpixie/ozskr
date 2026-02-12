/**
 * Schedules Routes Tests
 * Tests content scheduling management endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { ScheduleType, ScheduleContentType } from '@/types/database';

// Hoisted mock references
const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

// Module mocks
vi.mock('@/lib/api/supabase', () => ({
  createAuthenticatedClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock('jose', () => ({
  SignJWT: vi.fn(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue('mock-jwt-token'),
  })),
  jwtVerify: vi.fn(() =>
    Promise.resolve({
      payload: { wallet_address: 'So11111111111111111111111111111111111111112' },
    })
  ),
}));

import { schedules } from './schedules';

const MOCK_WALLET_ADDRESS = 'So11111111111111111111111111111111111111112';

describe('Schedules Routes', () => {
  let app: Hono;
  const mockCharacterId = '550e8400-e29b-41d4-a716-446655440000';
  const mockScheduleId = '987e6543-e21b-12d3-a456-426614174000';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';

    app = new Hono();
    app.route('/schedules', schedules);
  });

  const authHeaders = {
    Authorization: 'Bearer mock-jwt-token',
  };

  describe('POST /schedules', () => {
    it('should create schedule with valid data', async () => {
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'characters') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockCharacterId },
              error: null,
            }),
          };
        }
        if (tableName === 'content_schedules') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: mockScheduleId,
                character_id: mockCharacterId,
                schedule_type: ScheduleType.RECURRING,
                cron_expression: '0 9 * * *',
                next_run_at: '2024-01-16T09:00:00Z',
                content_type: ScheduleContentType.TEXT,
                prompt_template: 'Daily tweet about crypto',
                is_active: true,
                auto_publish: false,
                last_run_at: null,
                run_count: 0,
                created_at: '2024-01-15T10:00:00Z',
                updated_at: '2024-01-15T10:00:00Z',
              },
              error: null,
            }),
          };
        }
        return {};
      });

      const res = await app.request('/schedules', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          characterId: mockCharacterId,
          scheduleType: 'recurring',
          cronExpression: '0 9 * * *',
          nextRunAt: '2024-01-16T09:00:00Z',
          contentType: 'text',
          promptTemplate: 'Daily tweet about crypto',
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.id).toBe(mockScheduleId);
      expect(json.scheduleType).toBe('recurring');
    });

    it('should validate required fields', async () => {
      const res = await app.request('/schedules', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          characterId: mockCharacterId,
          // Missing scheduleType, nextRunAt, etc.
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should require cron_expression for recurring schedules', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockCharacterId },
          error: null,
        }),
      }));

      const res = await app.request('/schedules', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          characterId: mockCharacterId,
          scheduleType: 'recurring',
          // Missing cronExpression
          nextRunAt: '2024-01-16T09:00:00Z',
          contentType: 'text',
          promptTemplate: 'Daily tweet about crypto',
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Cron expression is required');
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await app.request('/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          characterId: mockCharacterId,
          scheduleType: 'one_time',
          nextRunAt: '2024-01-16T09:00:00Z',
          contentType: 'text',
          promptTemplate: 'Test prompt',
        }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /schedules', () => {
    it('should list schedules filtered by wallet ownership', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: count query
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              count: 1,
              error: null,
            }),
          };
        }
        // Second call: select query
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({
            data: [
              {
                id: mockScheduleId,
                character_id: mockCharacterId,
                schedule_type: ScheduleType.RECURRING,
                cron_expression: '0 9 * * *',
                next_run_at: '2024-01-16T09:00:00Z',
                content_type: ScheduleContentType.TEXT,
                prompt_template: 'Daily tweet',
                is_active: true,
                auto_publish: false,
                last_run_at: null,
                run_count: 0,
                created_at: '2024-01-15T10:00:00Z',
                updated_at: '2024-01-15T10:00:00Z',
                characters: { wallet_address: MOCK_WALLET_ADDRESS },
              },
            ],
            error: null,
          }),
        };
      });

      const res = await app.request('/schedules?page=1&limit=20', {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.pagination).toBeDefined();
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await app.request('/schedules', {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /schedules/:id', () => {
    it('should return single schedule with ownership check', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: mockScheduleId,
            character_id: mockCharacterId,
            schedule_type: ScheduleType.RECURRING,
            cron_expression: '0 9 * * *',
            next_run_at: '2024-01-16T09:00:00Z',
            content_type: ScheduleContentType.TEXT,
            prompt_template: 'Daily tweet',
            is_active: true,
            auto_publish: false,
            last_run_at: null,
            run_count: 0,
            created_at: '2024-01-15T10:00:00Z',
            updated_at: '2024-01-15T10:00:00Z',
            characters: { wallet_address: MOCK_WALLET_ADDRESS },
          },
          error: null,
        }),
      }));

      const res = await app.request(`/schedules/${mockScheduleId}`, {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.id).toBe(mockScheduleId);
    });

    it('should return 404 when schedule not found', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      }));

      const res = await app.request(`/schedules/${mockScheduleId}`, {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(404);
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await app.request(`/schedules/${mockScheduleId}`, {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /schedules/:id', () => {
    it('should update schedule fields', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Ownership check
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: mockScheduleId,
                characters: { wallet_address: MOCK_WALLET_ADDRESS },
              },
              error: null,
            }),
          };
        }
        // Update result
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: mockScheduleId,
              character_id: mockCharacterId,
              schedule_type: ScheduleType.RECURRING,
              cron_expression: '0 10 * * *',
              next_run_at: '2024-01-16T10:00:00Z',
              content_type: ScheduleContentType.TEXT,
              prompt_template: 'Updated prompt',
              is_active: false,
              auto_publish: false,
              last_run_at: null,
              run_count: 0,
              created_at: '2024-01-15T10:00:00Z',
              updated_at: '2024-01-15T11:00:00Z',
            },
            error: null,
          }),
        };
      });

      const res = await app.request(`/schedules/${mockScheduleId}`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: false,
          promptTemplate: 'Updated prompt',
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.isActive).toBe(false);
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await app.request(`/schedules/${mockScheduleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: false }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /schedules/:id', () => {
    it('should remove schedule with ownership check', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Ownership check
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: mockScheduleId,
                characters: { wallet_address: MOCK_WALLET_ADDRESS },
              },
              error: null,
            }),
          };
        }
        // Delete
        return {
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      });

      const res = await app.request(`/schedules/${mockScheduleId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await app.request(`/schedules/${mockScheduleId}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /schedules/:id/trigger', () => {
    it('should trigger immediate run by setting next_run_at to now', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Ownership check
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: mockScheduleId,
                characters: { wallet_address: MOCK_WALLET_ADDRESS },
              },
              error: null,
            }),
          };
        }
        // Update
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: mockScheduleId,
              character_id: mockCharacterId,
              schedule_type: ScheduleType.RECURRING,
              cron_expression: '0 9 * * *',
              next_run_at: new Date().toISOString(),
              content_type: ScheduleContentType.TEXT,
              prompt_template: 'Daily tweet',
              is_active: true,
              auto_publish: false,
              last_run_at: null,
              run_count: 0,
              created_at: '2024-01-15T10:00:00Z',
              updated_at: '2024-01-15T11:00:00Z',
            },
            error: null,
          }),
        };
      });

      const res = await app.request(`/schedules/${mockScheduleId}/trigger`, {
        method: 'POST',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toContain('triggered');
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await app.request(`/schedules/${mockScheduleId}/trigger`, {
        method: 'POST',
      });

      expect(res.status).toBe(401);
    });
  });
});
