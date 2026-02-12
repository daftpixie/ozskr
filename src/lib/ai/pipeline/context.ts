/**
 * Pipeline Stage 2: Load Character Context
 * Loads character DNA and relevant memories from Mem0
 */

import type { ValidatedInput, ProgressCallback } from './types';
import type { CharacterDNA } from '@/lib/ai/character-dna';
import type { MemoryResult } from '@/lib/ai/memory';
import { loadCharacterDNA } from '@/lib/ai/character-dna';
import { createAgentMemory } from '@/lib/ai/memory';
import { createAuthenticatedClient } from '@/lib/api/supabase';

/**
 * Character context combining DNA, memories, and session info
 */
export interface CharacterContext {
  dna: CharacterDNA;
  memories: MemoryResult[];
  sessionContext: {
    generationType: string;
    timestamp: string;
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
 * @returns Character context with DNA and memories
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
      metadata: { namespace: dna.mem0Namespace },
    });

    // Create memory client with character's namespace
    const memory = createAgentMemory(dna.mem0Namespace);

    // Recall memories relevant to the input prompt (limit 5 for context efficiency)
    let memories: MemoryResult[] = [];
    try {
      memories = await memory.recall(input.inputPrompt, { limit: 5 });
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
        memoriesRecalled: memories.length,
      },
    });

    return {
      dna,
      memories,
      sessionContext: {
        generationType: input.generationType,
        timestamp: new Date().toISOString(),
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
