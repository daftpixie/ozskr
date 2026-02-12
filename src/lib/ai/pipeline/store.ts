/**
 * Pipeline Stage 7: Store & Notify
 * Updates database with generation results and stores context in Mem0
 */

import type { CharacterContext } from './context';
import type { ProgressCallback, PipelineResult } from './types';
import { createAuthenticatedClient } from '@/lib/api/supabase';
import { createAgentMemory } from '@/lib/ai/memory';

/**
 * Error thrown during storage
 */
export class StorageError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Store generation results and update character state
 *
 * @param generationId - Generation record ID
 * @param result - Pipeline result to store
 * @param context - Character context
 * @param jwtToken - JWT for authenticated Supabase access
 * @param onProgress - Progress callback
 * @throws StorageError if storage fails
 */
export const storeAndNotify = async (
  generationId: string,
  result: Partial<PipelineResult>,
  context: CharacterContext,
  jwtToken: string,
  onProgress: ProgressCallback
): Promise<void> => {
  onProgress({
    stage: 'storing',
    message: 'Updating generation record',
    metadata: { generationId },
  });

  try {
    const supabase = createAuthenticatedClient(jwtToken);

    // Update content_generations record with all result fields
    const { error: updateError } = await supabase
      .from('content_generations')
      .update({
        enhanced_prompt: result.enhancedPrompt || null,
        model_used: result.modelUsed || 'unknown',
        output_text: result.outputText || null,
        output_url: result.outputUrl || null,
        quality_score: result.qualityScore || null,
        moderation_status: result.moderationStatus || 'pending',
        moderation_details: result.moderationDetails || null,
        token_usage: result.tokenUsage || { input: 0, output: 0, cached: 0 },
        cost_usd: result.costUsd?.toFixed(6) || null,
        latency_ms: result.latencyMs || null,
        cache_hit: result.cacheHit || false,
      })
      .eq('id', generationId);

    if (updateError) {
      throw new StorageError(
        `Failed to update generation record: ${updateError.message}`
      );
    }

    onProgress({
      stage: 'storing',
      message: 'Updating character stats',
    });

    // Update character's generation_count and last_generated_at
    const { error: characterError } = await supabase.rpc(
      'increment_generation_count',
      {
        character_id_param: context.dna.id,
      }
    );

    // If RPC doesn't exist, do manual update
    if (characterError?.code === '42883') {
      const { error: manualError } = await supabase
        .from('characters')
        .update({
          last_generated_at: new Date().toISOString(),
        })
        .eq('id', context.dna.id);

      if (manualError) {
        // Non-critical: log but don't fail
        onProgress({
          stage: 'storing',
          message: 'Warning: Failed to update character stats (non-critical)',
          metadata: { error: manualError.message },
        });
      }
    }

    onProgress({
      stage: 'storing',
      message: 'Storing generation context in Mem0',
    });

    // Store generation context in Mem0 for future recall
    try {
      const memory = createAgentMemory(context.dna.mem0Namespace);

      const memoryContent = `Generated ${context.sessionContext.generationType} content with quality score ${result.qualityScore?.toFixed(2) || 'N/A'}. Prompt: "${result.enhancedPrompt || 'N/A'}". Result: ${result.outputText?.slice(0, 200) || result.outputUrl || 'N/A'}.`;

      await memory.store(memoryContent, {
        generationId,
        generationType: context.sessionContext.generationType,
        qualityScore: result.qualityScore,
        timestamp: context.sessionContext.timestamp,
        moderationStatus: result.moderationStatus,
      });

      onProgress({
        stage: 'storing',
        message: 'Memory stored successfully',
      });
    } catch (error) {
      // Non-critical: log but don't fail
      const message = error instanceof Error ? error.message : 'Unknown error';
      onProgress({
        stage: 'storing',
        message: `Warning: Memory storage failed (non-critical): ${message}`,
        metadata: { error: message },
      });
    }

    onProgress({
      stage: 'complete',
      message: 'Generation pipeline complete',
      metadata: {
        generationId,
        moderationStatus: result.moderationStatus,
        qualityScore: result.qualityScore,
      },
    });
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new StorageError(`Storage operation failed: ${message}`);
  }
};
