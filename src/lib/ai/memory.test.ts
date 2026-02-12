/**
 * Mem0 Memory Layer Integration Tests
 * Tests for character memory isolation and namespace enforcement
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoisted mock references (available to vi.mock factories)
const { mockSearch, mockAdd, mockDelete } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockAdd: vi.fn(),
  mockDelete: vi.fn(),
}));

// Module mock (hoisted before imports)
vi.mock('mem0ai', () => ({
  MemoryClient: vi.fn(function () {
    return {
      search: mockSearch,
      add: mockAdd,
      delete: mockDelete,
    };
  }),
}));

import { createAgentMemory } from './memory';

describe('Mem0 Memory Layer', () => {
  beforeEach(() => {
    mockSearch.mockResolvedValue({
      results: [
        {
          id: 'mem-001',
          memory: 'Character prefers cyberpunk aesthetics',
          score: 0.92,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
    });
    mockAdd.mockResolvedValue({ id: 'mem-123' });
    mockDelete.mockResolvedValue({ success: true });
    process.env.MEM0_API_KEY = 'mock-mem0-key';
  });

  const validNamespace = 'char_550e8400-e29b-41d4-a716-446655440000';

  it('should accept valid namespace (char_<uuid>)', () => {
    expect(() => createAgentMemory(validNamespace)).not.toThrow();
  });

  it('should reject invalid namespace (no prefix)', () => {
    expect(() => createAgentMemory('550e8400-e29b-41d4-a716-446655440000')).toThrow();
  });

  it('should reject user-supplied namespace without char_ prefix', () => {
    expect(() => createAgentMemory('user_123e4567-e89b-12d3-a456-426614174000')).toThrow();
  });

  it('should reject malformed UUID in namespace', () => {
    expect(() => createAgentMemory('char_not-a-valid-uuid')).toThrow();
  });

  it('should use validated namespace as user_id in recall', async () => {
    const memory = createAgentMemory(validNamespace);
    await memory.recall('test query', { limit: 5 });

    expect(mockSearch).toHaveBeenCalledWith(
      'test query',
      expect.objectContaining({
        user_id: validNamespace,
        limit: 5,
      })
    );
  });

  it('should use validated namespace as user_id in store', async () => {
    const memory = createAgentMemory(validNamespace);
    await memory.store('New memory content', { key: 'value' });

    expect(mockAdd).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: 'New memory content',
        }),
      ]),
      expect.objectContaining({
        user_id: validNamespace,
        metadata: { key: 'value' },
      })
    );
  });

  it('should handle recall with default limit', async () => {
    const memory = createAgentMemory(validNamespace);
    await memory.recall('test query');

    expect(mockSearch).toHaveBeenCalledWith(
      'test query',
      expect.objectContaining({ limit: 10 })
    );
  });

  it('should handle empty results from Mem0', async () => {
    mockSearch.mockResolvedValueOnce({ results: [] });

    const memory = createAgentMemory(validNamespace);
    const results = await memory.recall('no matches');

    expect(results).toEqual([]);
  });

  it('should throw error when MEM0_API_KEY is missing', () => {
    delete process.env.MEM0_API_KEY;
    expect(() => createAgentMemory(validNamespace)).toThrow('MEM0_API_KEY');
  });
});
