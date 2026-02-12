/**
 * Mem0 Memory Layer Integration
 * Character memory isolation with namespace enforcement
 */

import { MemoryClient } from 'mem0ai';
import { z } from 'zod';

/**
 * Namespace validation schema
 * CRITICAL: Must match char_<uuid> pattern for security isolation
 */
const Mem0NamespaceSchema = z
  .string()
  .regex(
    /^char_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'Namespace must be in format: char_<uuid>'
  );

/**
 * Memory result from Mem0 recall operation
 */
export interface MemoryResult {
  id: string;
  memory: string;
  metadata?: Record<string, unknown>;
  score?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Agent memory interface
 * Provides isolated memory operations per character
 */
export interface AgentMemory {
  /**
   * Recall memories matching a query
   */
  recall(query: string, options?: { limit?: number }): Promise<MemoryResult[]>;

  /**
   * Store a new memory
   */
  store(content: string, metadata?: Record<string, unknown>): Promise<void>;

  /**
   * Forget (delete) a specific memory
   */
  forget(memoryId: string): Promise<void>;
}

/**
 * Create an isolated memory instance for a character
 *
 * SECURITY: The namespace parameter MUST come from database (characters.mem0_namespace),
 * NEVER from user input. This ensures character memory isolation.
 *
 * @param mem0Namespace - Character namespace from database (char_<uuid> format)
 * @returns AgentMemory instance with isolated namespace
 */
export const createAgentMemory = (mem0Namespace: string): AgentMemory => {
  // Validate namespace format for security
  const validatedNamespace = Mem0NamespaceSchema.parse(mem0Namespace);

  const apiKey = process.env.MEM0_API_KEY;
  if (!apiKey) {
    throw new Error('MEM0_API_KEY environment variable is required');
  }

  const memClient = new MemoryClient({ apiKey });

  return {
    async recall(query: string, options?: { limit?: number }): Promise<MemoryResult[]> {
      try {
        const result = await memClient.search(query, {
          user_id: validatedNamespace,
          limit: options?.limit ?? 10,
        });

        // Handle Mem0 API response structure
        const results = (result as unknown as { results?: unknown[] })?.results ?? [];

        return results.map((item: unknown) => {
          const record = item as Record<string, unknown>;
          return {
            id: String(record.id ?? ''),
            memory: String(record.memory ?? ''),
            metadata: (record.metadata as Record<string, unknown>) ?? {},
            score: typeof record.score === 'number' ? record.score : undefined,
            created_at: typeof record.created_at === 'string' ? record.created_at : undefined,
            updated_at: typeof record.updated_at === 'string' ? record.updated_at : undefined,
          };
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to recall memories: ${message}`);
      }
    },

    async store(content: string, metadata?: Record<string, unknown>): Promise<void> {
      try {
        // Mem0 add expects messages array format
        await memClient.add(
          [{ role: 'user', content }] as never,
          {
            user_id: validatedNamespace,
            metadata,
          } as never
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to store memory: ${message}`);
      }
    },

    async forget(memoryId: string): Promise<void> {
      try {
        await memClient.delete(memoryId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to forget memory: ${message}`);
      }
    },
  };
};
