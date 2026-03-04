/**
 * Pipeline Stage 7: Store & Notify
 * Updates database with generation results and updates Mastra working memory.
 *
 * Orchestration: Mastra workflow (simple linear stage — no branching).
 */

import type { CharacterContext } from './context';
import type { ProgressCallback, PipelineResult } from './types';
import { createAuthenticatedClient } from '@/lib/api/supabase';
import { createAgentMemory } from '@/lib/ai/memory';
import { PointsType, PointsSourceType } from '@/types/database';

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
 * Build updated working memory XML from the current state and this generation's insights.
 * Appends new content insights to the existing XML structure.
 */
export function buildUpdatedWorkingMemory(
  currentWorkingMemory: string,
  result: Partial<PipelineResult>,
  sessionContext: CharacterContext['sessionContext']
): string {
  const qualityScore = result.qualityScore?.toFixed(2) ?? 'N/A';
  const generationType = sessionContext.generationType;
  const timestamp = sessionContext.timestamp;
  const snippet = result.outputText?.slice(0, 120) || result.outputUrl || 'N/A';

  // If there's no existing working memory or it's minimal, return a fresh record
  if (!currentWorkingMemory || currentWorkingMemory.trim().length < 10) {
    return `<agent_working_memory>
  <audience_preferences>None learned yet</audience_preferences>
  <top_performing_content>
    <entry timestamp="${timestamp}" type="${generationType}" quality="${qualityScore}">${snippet}</entry>
  </top_performing_content>
  <posting_patterns>Generated ${generationType} content</posting_patterns>
  <topic_resonance>No data yet</topic_resonance>
  <style_adaptations>Using default persona settings</style_adaptations>
</agent_working_memory>`;
  }

  // Append a new entry into top_performing_content if quality is reasonable
  const qualityNum = result.qualityScore ?? 0;
  if (qualityNum >= 0.6) {
    const newEntry = `<entry timestamp="${timestamp}" type="${generationType}" quality="${qualityScore}">${snippet}</entry>`;
    if (currentWorkingMemory.includes('</top_performing_content>')) {
      return currentWorkingMemory.replace(
        '</top_performing_content>',
        `  ${newEntry}\n  </top_performing_content>`
      );
    }
  }

  // Return unchanged if quality was low or structure not recognized
  return currentWorkingMemory;
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
      message: 'Updating working memory with generation insights',
    });

    // Update Mastra working memory with insights from this generation
    // SECURITY: use dna.id (from DB) — never user-supplied value
    try {
      const memory = createAgentMemory(context.dna.id, context.dna.workingMemoryTemplate);

      const updatedWorkingMemory = buildUpdatedWorkingMemory(
        context.workingMemory,
        result,
        context.sessionContext
      );

      await memory.updateWorkingMemory(updatedWorkingMemory);

      onProgress({
        stage: 'storing',
        message: 'Working memory updated successfully',
      });
    } catch (error) {
      // Non-critical: memory update failure does not block pipeline completion
      const message = error instanceof Error ? error.message : 'Unknown error';
      onProgress({
        stage: 'storing',
        message: `Warning: Memory update failed (non-critical): ${message}`,
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

    // Award points for content generation (async, don't fail the pipeline)
    // Fetch character to get wallet_address
    void (async () => {
      try {
        const { data: character } = await supabase
          .from('characters')
          .select('wallet_address')
          .eq('id', context.dna.id)
          .single();

        if (character) {
          const { awardPoints, POINTS_VALUES } = await import('@/lib/gamification/points');
          const generationType = context.sessionContext.generationType;
          const pointsMap: Record<string, number> = {
            text: POINTS_VALUES.CONTENT_GENERATED_TEXT,
            image: POINTS_VALUES.CONTENT_GENERATED_IMAGE,
            video: POINTS_VALUES.CONTENT_GENERATED_VIDEO,
          };
          const pointsAmount = pointsMap[generationType] || POINTS_VALUES.CONTENT_GENERATED_TEXT;

          await awardPoints({
            walletAddress: character.wallet_address,
            pointsType: PointsType.GENERATION,
            pointsAmount,
            description: `Generated ${generationType} content`,
            sourceType: PointsSourceType.CONTENT,
            sourceId: generationId,
          });
        }
      } catch {
        // Ignore gamification errors
      }
    })();
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new StorageError(`Storage operation failed: ${message}`);
  }
};
