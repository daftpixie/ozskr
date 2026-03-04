/**
 * Mastra-native Runtime Agent Memory
 * Replaces Mem0 for user-facing AI influencer agent memory.
 *
 * NOTE: Mem0 dev workflow memory (tools/mem0-mcp/) is completely separate
 * and is NOT affected by this file. This is RUNTIME agent memory only.
 *
 * Architecture:
 * - Working Memory: structured XML state that persists across all generation
 *   threads per agent (resource-scoped via Mastra Memory)
 * - Semantic Recall: TODO — requires embedder setup; returns [] for now
 * - Thread History: per-session, managed externally via Mastra threadId
 *
 * Orchestration boundary: Mastra workflow (simple linear pipeline — this file).
 * LangGraph is reserved for multi-step retry loops defined in pipeline/index.ts.
 *
 * Memory isolation: characterId is used as resourceId — server-side enforcement.
 * SECURITY: Never accept resourceId/namespace from user input. Always load from DB.
 */

import { Memory } from '@mastra/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Default working memory XML template
// ---------------------------------------------------------------------------
export const DEFAULT_WORKING_MEMORY_TEMPLATE = `
<agent_working_memory>
  <audience_preferences>None learned yet</audience_preferences>
  <top_performing_content>No data yet</top_performing_content>
  <posting_patterns>No patterns detected</posting_patterns>
  <topic_resonance>No data yet</topic_resonance>
  <style_adaptations>Using default persona settings</style_adaptations>
</agent_working_memory>
`.trim();

// ---------------------------------------------------------------------------
// Security: characterId must be a valid UUID from the database
// NEVER accept a raw user-supplied string without this validation.
// ---------------------------------------------------------------------------
const CharacterIdSchema = z
  .string()
  .uuid('characterId must be a valid UUID — load from database, never from user input');

// ---------------------------------------------------------------------------
// AgentMemory interface
// ---------------------------------------------------------------------------

/**
 * Isolated memory interface for a single AI influencer agent.
 *
 * Method contract:
 * - getWorkingMemory(): returns current XML working memory (or the default template)
 * - updateWorkingMemory(): overwrites working memory with new XML content
 * - recallRelevant(): semantic recall placeholder — returns [] until pgvector embedder is wired
 */
export interface AgentMemory {
  /**
   * Get the current working memory XML for this character.
   * Returns the default template if no working memory has been stored yet.
   */
  getWorkingMemory(): Promise<string>;

  /**
   * Overwrite the working memory with updated XML content.
   * Called after each successful generation to capture learned insights.
   */
  updateWorkingMemory(content: string): Promise<void>;

  /**
   * Semantic recall of relevant memories for a given query.
   * TODO: Wire pgvector embedder for production semantic search.
   * Currently returns empty array (non-blocking — callers must handle []).
   */
  recallRelevant(query: string, limit?: number): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// Shared Memory instance (module-level singleton, per process)
// Shared across all createAgentMemory() calls to reuse the storage pool.
// ---------------------------------------------------------------------------

let _sharedMemoryInstance: Memory | null = null;

function getSharedMemory(workingMemoryTemplate: string): Memory {
  if (!_sharedMemoryInstance) {
    // InMemoryStore: fast, zero-config, no external dependency.
    // Working memory is resource-scoped so it survives thread changes within a session.
    // TODO(Phase 8): replace InMemoryStore with PostgresStore when @mastra/pg resolves
    // its peer dependency on @mastra/core >=1.4.1. Track: feat/mem0-dev-memory.
    const storage = new InMemoryStore();

    _sharedMemoryInstance = new Memory({
      storage,
      options: {
        workingMemory: {
          enabled: true,
          template: workingMemoryTemplate,
          // resource scope: working memory shared across all threads for a character
          scope: 'resource',
        },
        // Disable conversation history — the pipeline does not use Mastra message threads
        lastMessages: false,
        // Disable semantic recall until embedder is configured
        semanticRecall: false,
      },
    });
  }
  return _sharedMemoryInstance;
}

// ---------------------------------------------------------------------------
// Thread ID convention
// Working memory is resource-scoped so the canonical thread only needs to
// exist once per character. We derive a deterministic ID from characterId.
// ---------------------------------------------------------------------------
function canonicalThreadId(characterId: string): string {
  return `wm-${characterId}`;
}

// ---------------------------------------------------------------------------
// createAgentMemory
// ---------------------------------------------------------------------------

/**
 * Create an isolated AgentMemory instance for a character.
 *
 * SECURITY: characterId MUST come from the database (characters.id).
 * It is validated as a UUID here. Never pass a user-supplied string directly.
 *
 * @param characterId - Character UUID loaded from the database
 * @param workingMemoryTemplate - Optional XML template override (null = platform default)
 * @returns AgentMemory instance isolated to this character
 * @throws ZodError if characterId is not a valid UUID
 */
export function createAgentMemory(
  characterId: string,
  workingMemoryTemplate?: string | null
): AgentMemory {
  // SECURITY: validate UUID format before using as resourceId
  const resourceId = CharacterIdSchema.parse(characterId);

  const template = workingMemoryTemplate ?? DEFAULT_WORKING_MEMORY_TEMPLATE;
  const memory = getSharedMemory(template);
  const threadId = canonicalThreadId(resourceId);

  // Ensure the canonical thread exists (idempotent)
  let threadInitialized = false;
  const ensureThread = async (): Promise<void> => {
    if (threadInitialized) return;
    try {
      const existing = await memory.getThreadById({ threadId });
      if (!existing) {
        await memory.saveThread({
          thread: {
            id: threadId,
            resourceId,
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: { characterId: resourceId, purpose: 'working-memory' },
          },
        });
      }
      threadInitialized = true;
    } catch {
      // Non-fatal: thread creation failure degrades gracefully
      threadInitialized = true;
    }
  };

  return {
    async getWorkingMemory(): Promise<string> {
      await ensureThread();
      try {
        const wm = await memory.getWorkingMemory({ threadId, resourceId });
        return wm ?? template;
      } catch {
        // Non-fatal: return default template if storage is unavailable
        return template;
      }
    },

    async updateWorkingMemory(content: string): Promise<void> {
      await ensureThread();
      try {
        await memory.updateWorkingMemory({
          threadId,
          resourceId,
          workingMemory: content,
        });
      } catch {
        // Non-fatal: working memory update failure does not block content pipeline
      }
    },

    async recallRelevant(_query: string, _limit?: number): Promise<string[]> {
      // TODO(Phase 8): implement pgvector semantic recall.
      // Requires: embedder configured in Memory constructor + PgVector adapter.
      // See: https://mastra.ai/docs/memory/semantic-recall
      return [];
    },
  };
}
