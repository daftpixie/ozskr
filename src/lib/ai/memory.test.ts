/**
 * Mastra-native Runtime Agent Memory Tests
 * Tests for character memory isolation and UUID enforcement.
 *
 * NOTE: mem0ai (tools/mem0-mcp/) is NOT mocked here — this file tests the
 * Mastra-based runtime memory layer only.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock references
// ---------------------------------------------------------------------------
const { mockGetWorkingMemory, mockUpdateWorkingMemory, mockSaveThread, mockGetThreadById } =
  vi.hoisted(() => ({
    mockGetWorkingMemory: vi.fn(),
    mockUpdateWorkingMemory: vi.fn(),
    mockSaveThread: vi.fn(),
    mockGetThreadById: vi.fn(),
  }));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Mock @mastra/memory so tests don't require a database
vi.mock('@mastra/memory', () => ({
  Memory: vi.fn(function () {
    return {
      getWorkingMemory: mockGetWorkingMemory,
      updateWorkingMemory: mockUpdateWorkingMemory,
      saveThread: mockSaveThread,
      getThreadById: mockGetThreadById,
    };
  }),
}));

// Mock InMemoryStore from @mastra/core/storage
vi.mock('@mastra/core/storage', () => ({
  InMemoryStore: vi.fn(function () {
    return {};
  }),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks are established)
// ---------------------------------------------------------------------------
import { createAgentMemory, DEFAULT_WORKING_MEMORY_TEMPLATE } from './memory';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('Mastra Runtime Agent Memory', () => {
  const validCharacterId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: thread not found (so it gets created)
    mockGetThreadById.mockResolvedValue(null);
    mockSaveThread.mockResolvedValue({
      id: `wm-${validCharacterId}`,
      resourceId: validCharacterId,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
    });

    // Default: return the platform default template
    mockGetWorkingMemory.mockResolvedValue(DEFAULT_WORKING_MEMORY_TEMPLATE);
    mockUpdateWorkingMemory.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // Security: ID validation
  // -------------------------------------------------------------------------

  it('should accept a valid UUID characterId', () => {
    expect(() => createAgentMemory(validCharacterId)).not.toThrow();
  });

  it('should reject a non-UUID string (plain string)', () => {
    expect(() => createAgentMemory('not-a-uuid')).toThrow();
  });

  it('should reject a Mem0-style namespace (char_ prefix)', () => {
    expect(() => createAgentMemory('char_550e8400-e29b-41d4-a716-446655440000')).toThrow();
  });

  it('should reject an empty string', () => {
    expect(() => createAgentMemory('')).toThrow();
  });

  it('should reject a user_id-style namespace', () => {
    expect(() => createAgentMemory('user_123e4567-e89b-12d3-a456-426614174000')).toThrow();
  });

  // -------------------------------------------------------------------------
  // getWorkingMemory
  // -------------------------------------------------------------------------

  it('should return working memory from Mastra Memory', async () => {
    const expectedXml = '<agent_working_memory><test>data</test></agent_working_memory>';
    mockGetWorkingMemory.mockResolvedValueOnce(expectedXml);

    const memory = createAgentMemory(validCharacterId);
    const result = await memory.getWorkingMemory();

    expect(result).toBe(expectedXml);
  });

  it('should return the default template when Mastra returns null', async () => {
    mockGetWorkingMemory.mockResolvedValueOnce(null);

    const memory = createAgentMemory(validCharacterId);
    const result = await memory.getWorkingMemory();

    expect(result).toBe(DEFAULT_WORKING_MEMORY_TEMPLATE);
    expect(result).toContain('<agent_working_memory>');
  });

  it('should return the default template when getWorkingMemory throws', async () => {
    mockGetWorkingMemory.mockRejectedValueOnce(new Error('Storage unavailable'));

    const memory = createAgentMemory(validCharacterId);
    const result = await memory.getWorkingMemory();

    expect(result).toBe(DEFAULT_WORKING_MEMORY_TEMPLATE);
  });

  it('should use custom template when provided', async () => {
    const customTemplate = '<custom_memory><field>value</field></custom_memory>';
    mockGetWorkingMemory.mockResolvedValueOnce(null); // null = use template

    const memory = createAgentMemory(validCharacterId, customTemplate);
    const result = await memory.getWorkingMemory();

    // null → falls back to template
    expect(result).toBe(customTemplate);
  });

  // -------------------------------------------------------------------------
  // updateWorkingMemory
  // -------------------------------------------------------------------------

  it('should call Mastra updateWorkingMemory with the characterId as resourceId', async () => {
    const memory = createAgentMemory(validCharacterId);
    const newXml = '<agent_working_memory><updated>true</updated></agent_working_memory>';

    await memory.updateWorkingMemory(newXml);

    expect(mockUpdateWorkingMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: validCharacterId,
        workingMemory: newXml,
      })
    );
  });

  it('should not throw when updateWorkingMemory fails (non-critical)', async () => {
    mockUpdateWorkingMemory.mockRejectedValueOnce(new Error('Write failed'));

    const memory = createAgentMemory(validCharacterId);

    // Should not throw — update failure is non-critical
    await expect(memory.updateWorkingMemory('<test/>')).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // recallRelevant (semantic recall stub)
  // -------------------------------------------------------------------------

  it('should return empty array from recallRelevant (semantic recall placeholder)', async () => {
    const memory = createAgentMemory(validCharacterId);
    const result = await memory.recallRelevant('create a tweet about Solana', 5);

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should accept any query string for recallRelevant', async () => {
    const memory = createAgentMemory(validCharacterId);
    await expect(memory.recallRelevant('some query')).resolves.toEqual([]);
    await expect(memory.recallRelevant('')).resolves.toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Memory isolation — two different characterIds use different resourceIds
  // -------------------------------------------------------------------------

  it('should use characterId as the Mastra resourceId (isolation)', async () => {
    const characterId1 = '550e8400-e29b-41d4-a716-446655440000';
    const characterId2 = '660e8400-e29b-41d4-a716-446655440001';

    const memory1 = createAgentMemory(characterId1);
    const memory2 = createAgentMemory(characterId2);

    const xml1 = '<agent_working_memory><agent>one</agent></agent_working_memory>';
    const xml2 = '<agent_working_memory><agent>two</agent></agent_working_memory>';

    mockUpdateWorkingMemory.mockResolvedValue(undefined);

    await memory1.updateWorkingMemory(xml1);
    await memory2.updateWorkingMemory(xml2);

    // First call should use characterId1 as resourceId
    expect(mockUpdateWorkingMemory).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ resourceId: characterId1, workingMemory: xml1 })
    );

    // Second call should use characterId2 as resourceId
    expect(mockUpdateWorkingMemory).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ resourceId: characterId2, workingMemory: xml2 })
    );
  });

  // -------------------------------------------------------------------------
  // Thread initialization
  // -------------------------------------------------------------------------

  it('should create a canonical thread if none exists', async () => {
    mockGetThreadById.mockResolvedValueOnce(null); // thread doesn't exist

    const memory = createAgentMemory(validCharacterId);
    await memory.getWorkingMemory();

    // Should have checked for existing thread then created it
    expect(mockGetThreadById).toHaveBeenCalled();
    expect(mockSaveThread).toHaveBeenCalledWith(
      expect.objectContaining({
        thread: expect.objectContaining({
          resourceId: validCharacterId,
          id: `wm-${validCharacterId}`,
        }),
      })
    );
  });

  it('should not recreate the thread if it already exists', async () => {
    mockGetThreadById.mockResolvedValueOnce({
      id: `wm-${validCharacterId}`,
      resourceId: validCharacterId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const memory = createAgentMemory(validCharacterId);
    await memory.getWorkingMemory();

    expect(mockGetThreadById).toHaveBeenCalled();
    expect(mockSaveThread).not.toHaveBeenCalled();
  });
});
