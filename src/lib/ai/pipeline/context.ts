/**
 * Pipeline Stage 2: Load Character Context
 * Loads character DNA and working memory from Mastra-native memory layer.
 *
 * Orchestration: Mastra workflow (simple linear stage — no branching).
 * For retry loops see pipeline/index.ts.
 */

import type { ValidatedInput, ProgressCallback } from './types';
import type { CharacterDNA } from '@/lib/ai/character-dna';
import { loadCharacterDNA } from '@/lib/ai/character-dna';
import { createAgentMemory } from '@/lib/ai/memory';
import { createAuthenticatedClient } from '@/lib/api/supabase';

/**
 * Character context combining DNA, working memory, and session info
 */
export interface CharacterContext {
  dna: CharacterDNA;
  /**
   * Current XML working memory for this character (Mastra resource-scoped).
   * Empty string if memory recall is unavailable.
   */
  workingMemory: string;
  /**
   * Semantically relevant memories from vector search.
   * Empty array until pgvector embedder is wired (non-blocking).
   */
  relevantMemories: string[];
  sessionContext: {
    generationType: string;
    timestamp: string;
    /** Unique ID for this generation session (for future thread history) */
    threadId: string;
  };
}

/**
 * Error thrown during context loading
 */
export class ContextLoadError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ContextLoadError';
  }
}

/**
 * Load character context for generation
 *
 * @param input - Validated pipeline input
 * @param onProgress - Progress callback
 * @returns Character context with DNA and working memory
 * @throws ContextLoadError if loading fails
 */
export const loadCharacterContext = async (
  input: ValidatedInput,
  onProgress: ProgressCallback
): Promise<CharacterContext> => {
  onProgress({
    stage: 'loading_context',
    message: 'Loading character DNA',
    metadata: { characterId: input.characterId },
  });

  try {
    const supabase = createAuthenticatedClient(input.jwtToken);

    // Load character DNA from database
    const dna = await loadCharacterDNA(input.characterId, supabase);

    onProgress({
      stage: 'loading_context',
      message: 'Recalling relevant memories',
      metadata: { characterId: dna.id },
    });

    // SECURITY: use dna.id (from DB) as characterId — never user-supplied input
    const memory = createAgentMemory(dna.id, dna.workingMemoryTemplate);

    let workingMemory = '';
    let relevantMemories: string[] = [];

    try {
      workingMemory = await memory.getWorkingMemory();
      relevantMemories = await memory.recallRelevant(input.inputPrompt, 5);
    } catch (error) {
      // Non-critical: proceed without memories if recall fails
      const message = error instanceof Error ? error.message : 'Unknown error';
      onProgress({
        stage: 'loading_context',
        message: `Memory recall failed (non-critical): ${message}`,
        metadata: { error: message },
      });
    }

    onProgress({
      stage: 'loading_context',
      message: 'Character context loaded',
      metadata: {
        characterName: dna.name,
        memoriesRecalled: relevantMemories.length,
        hasWorkingMemory: workingMemory.length > 0,
      },
    });

    return {
      dna,
      workingMemory,
      relevantMemories,
      sessionContext: {
        generationType: input.generationType,
        timestamp: new Date().toISOString(),
        threadId: crypto.randomUUID(),
      },
    };
  } catch (error) {
    if (error instanceof ContextLoadError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new ContextLoadError(`Failed to load character context: ${message}`);
  }
};
