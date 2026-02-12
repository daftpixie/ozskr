/**
 * AI Routes Tests
 * Tests for character management and content generation endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

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
  createSupabaseClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
  createSupabaseServerClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

import { Hono } from 'hono';
import { ai } from './ai';
import { MOCK_WALLET_ADDRESS } from '@/test/mocks/solana';
import { createMockCharacterDNA } from '@/test/mocks/ai';

// Mock jose JWT functions
vi.mock('jose', () => ({
  SignJWT: vi.fn(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue('mock-jwt-token'),
  })),
  jwtVerify: vi.fn(() =>
    Promise.resolve({
      payload: { wallet_address: MOCK_WALLET_ADDRESS },
    })
  ),
}));

describe('AI Routes', () => {
  let app: Hono;
  const mockCharacter = createMockCharacterDNA();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';

    app = new Hono();
    app.route('/ai', ai);

    // Default: generation record and character data exist
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === 'characters') {
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({
            data: {
              id: mockCharacter.id,
              wallet_address: MOCK_WALLET_ADDRESS,
              name: mockCharacter.name,
              persona: mockCharacter.persona,
              visual_style: mockCharacter.visualStyle,
              voice_tone: mockCharacter.voiceTone,
              guardrails: [...mockCharacter.guardrails],
              topic_affinity: [...mockCharacter.topicAffinity],
              mem0_namespace: mockCharacter.mem0Namespace,
              status: 'active',
              visual_style_params: mockCharacter.visualStyleParams,
              social_accounts: {},
              generation_count: 0,
              last_generated_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          }),
        };
      }
      if (tableName === 'content_generations') {
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockResolvedValue({ data: [], error: null }),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({
            data: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              character_id: mockCharacter.id,
              generation_type: 'text',
              input_prompt: 'Test prompt',
              model_used: 'pending',
              model_params: {},
              moderation_status: 'pending',
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        };
      }
      if (tableName === 'character_memory') {
        return {
          insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  const authHeaders = {
    Authorization: 'Bearer mock-jwt-token',
  };

  describe('POST /ai/characters', () => {
    it('should create character and return 201', async () => {
      const res = await app.request('/ai/characters', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'TestBot',
          persona: 'A test character with friendly personality',
          visualStyle: 'Modern minimalist aesthetic',
          voiceTone: 'Friendly and casual',
          guardrails: ['No politics'],
          topicAffinity: ['Technology', 'AI'],
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.name).toBe('TestBot');
      expect(json.id).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      const res = await app.request('/ai/characters', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'TestBot',
          // Missing persona, visualStyle, voiceTone
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /ai/characters', () => {
    it('should return paginated list of characters', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [
            {
              id: mockCharacter.id,
              wallet_address: MOCK_WALLET_ADDRESS,
              name: 'TestBot',
              persona: 'Test',
              visual_style: 'Modern',
              voice_tone: 'Friendly',
              guardrails: [],
              topic_affinity: [],
              mem0_namespace: mockCharacter.mem0Namespace,
              status: 'active',
              visual_style_params: {},
              social_accounts: {},
              generation_count: 5,
              last_generated_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          error: null,
        }),
      }));

      const res = await app.request('/ai/characters?page=1&limit=20', {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.pagination).toBeDefined();
    });
  });

  describe('GET /ai/characters/:id', () => {
    it('should return character with stats', async () => {
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'characters') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: mockCharacter.id,
                wallet_address: MOCK_WALLET_ADDRESS,
                name: mockCharacter.name,
                persona: mockCharacter.persona,
                visual_style: mockCharacter.visualStyle,
                voice_tone: mockCharacter.voiceTone,
                guardrails: [...mockCharacter.guardrails],
                topic_affinity: [...mockCharacter.topicAffinity],
                mem0_namespace: mockCharacter.mem0Namespace,
                status: 'active',
                visual_style_params: mockCharacter.visualStyleParams,
                social_accounts: {},
                generation_count: 10,
                last_generated_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          };
        }
        if (tableName === 'content_generations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          };
        }
        return {};
      });

      const res = await app.request(
        `/ai/characters/${mockCharacter.id}`,
        {
          method: 'GET',
          headers: authHeaders,
        }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.id).toBe(mockCharacter.id);
      expect(json.recentGenerations).toBeDefined();
    });

    it('should return 404 when character not found or wrong owner', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      }));

      const res = await app.request(
        '/ai/characters/550e8400-e29b-41d4-a716-446655440000',
        {
          method: 'GET',
          headers: authHeaders,
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /ai/characters/:id', () => {
    it('should update non-DNA fields', async () => {
      // First call: ownership check, Second call: update
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Ownership verification
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockCharacter.id },
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
              id: mockCharacter.id,
              wallet_address: MOCK_WALLET_ADDRESS,
              name: 'UpdatedBot',
              persona: mockCharacter.persona,
              visual_style: mockCharacter.visualStyle,
              voice_tone: mockCharacter.voiceTone,
              guardrails: [...mockCharacter.guardrails],
              topic_affinity: [...mockCharacter.topicAffinity],
              mem0_namespace: mockCharacter.mem0Namespace,
              status: 'paused',
              visual_style_params: mockCharacter.visualStyleParams,
              social_accounts: {},
              generation_count: 10,
              last_generated_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          }),
        };
      });

      const res = await app.request(
        `/ai/characters/${mockCharacter.id}`,
        {
          method: 'PUT',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'UpdatedBot',
            status: 'paused',
          }),
        }
      );

      expect(res.status).toBe(200);
    });
  });

  describe('POST /ai/characters/:id/generate', () => {
    it('should create pending generation and return 202', async () => {
      const generationId = '123e4567-e89b-12d3-a456-426614174000';

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'characters') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockCharacter.id },
              error: null,
            }),
          };
        }
        if (tableName === 'content_generations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
            insert: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: generationId,
                character_id: mockCharacter.id,
                generation_type: 'text',
                input_prompt: 'Test prompt',
                model_used: 'pending',
                model_params: {},
                moderation_status: 'pending',
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          };
        }
        return {};
      });

      const res = await app.request(
        `/ai/characters/${mockCharacter.id}/generate`,
        {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            generationType: 'text',
            inputPrompt: 'Create a tweet about Solana',
          }),
        }
      );

      expect(res.status).toBe(202);
      const json = await res.json();
      expect(json.generationId).toBe(generationId);
      expect(json.status).toBe('pending');
    });

    it('should return 429 when rate limited', async () => {
      const recentGens = Array.from({ length: 30 }, (_, i) => ({
        id: `gen-${i}`,
      }));

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'characters') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockCharacter.id },
              error: null,
            }),
          };
        }
        if (tableName === 'content_generations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({
              data: recentGens,
              error: null,
            }),
          };
        }
        return {};
      });

      const res = await app.request(
        `/ai/characters/${mockCharacter.id}/generate`,
        {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            generationType: 'text',
            inputPrompt: 'Test',
          }),
        }
      );

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('3600');
    });
  });
});
