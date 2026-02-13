/**
 * Error Tracker Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Hoist mocks for vi.mock factory functions
const { mockIncr, mockExpire, mockGet, mockScan, mockLoggerWarn } = vi.hoisted(() => ({
  mockIncr: vi.fn().mockResolvedValue(1),
  mockExpire: vi.fn().mockResolvedValue(true),
  mockGet: vi.fn().mockResolvedValue(0),
  mockScan: vi.fn().mockResolvedValue(['0', []]),
  mockLoggerWarn: vi.fn(),
}));

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: vi.fn(() => ({
      incr: mockIncr,
      expire: mockExpire,
      get: mockGet,
      scan: mockScan,
    })),
  },
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: mockLoggerWarn, error: vi.fn(), debug: vi.fn() },
}));

import { errorTrackingMiddleware, getErrorRates } from './error-tracker';

describe('Error Tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('errorTrackingMiddleware', () => {
    it('should not log warning for successful requests', async () => {
      const app = new Hono();
      app.use('*', errorTrackingMiddleware);
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test');
      expect(res.status).toBe(200);
      expect(mockLoggerWarn).not.toHaveBeenCalled();
    });

    it('should log warning for 500 errors', async () => {
      const app = new Hono();
      app.use('*', errorTrackingMiddleware);
      app.get('/fail', (c) => c.json({ error: 'boom' }, 500));

      const res = await app.request('/fail');
      expect(res.status).toBe(500);
      expect(mockLoggerWarn).toHaveBeenCalledWith('API error tracked', expect.objectContaining({ status: 500 }));
    });

    it('should not block the response even if Redis fails', async () => {
      mockIncr.mockRejectedValue(new Error('Redis down'));
      const app = new Hono();
      app.use('*', errorTrackingMiddleware);
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test');
      expect(res.status).toBe(200);
    });
  });

  describe('getErrorRates', () => {
    it('should return empty array when no keys exist', async () => {
      mockScan.mockResolvedValue(['0', []]);
      const rates = await getErrorRates();
      expect(rates).toEqual([]);
    });

    it('should calculate error rates from Redis counters', async () => {
      const hour = new Date();
      const hourKey = `${hour.getUTCFullYear()}-${String(hour.getUTCMonth() + 1).padStart(2, '0')}-${String(hour.getUTCDate()).padStart(2, '0')}:${String(hour.getUTCHours()).padStart(2, '0')}`;

      // First scan call returns error keys, second returns request keys
      mockScan
        .mockResolvedValueOnce(['0', [`ozskr:errors:${hourKey}:/api/test`]])
        .mockResolvedValueOnce(['0', [`ozskr:requests:${hourKey}:/api/test`]]);

      mockGet
        .mockResolvedValueOnce(5)   // errors
        .mockResolvedValueOnce(100); // requests

      const rates = await getErrorRates();
      expect(rates).toHaveLength(1);
      expect(rates[0].path).toBe('/api/test');
      expect(rates[0].errors).toBe(5);
      expect(rates[0].requests).toBe(100);
      expect(rates[0].errorRate).toBe(0.05);
    });
  });
});
