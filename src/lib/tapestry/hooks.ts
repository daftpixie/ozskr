/**
 * Tapestry Social Graph Hooks
 *
 * Fire-and-forget lifecycle hooks that integrate the Tapestry social graph
 * into the agent creation and content publishing flows.
 *
 * IMPORTANT: Every exported function must:
 *  1. Never throw — all errors are caught and logged with logger.warn
 *  2. Check isTapestryConfigured() before making any SDK calls
 *  3. Be called with void + .catch(() => {}) at the call site
 *
 * These are intentionally decoupled from the primary request/response cycle.
 * A Tapestry failure MUST NOT affect agent creation or content publishing.
 *
 * Orchestration boundary: Mastra workflow (simple linear hook, no branching)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { tapestryService } from '@/lib/tapestry/service';
import { isTapestryConfigured } from '@/lib/tapestry/client';
import { logger } from '@/lib/utils/logger';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute a simple topical alignment score between two characters.
 *
 * Strategy (in order of preference):
 *  1. If both characters have topic_affinity arrays with at least 1 entry,
 *     count the number of lowercased entries in common.
 *  2. Otherwise fall back to persona string overlap: count meaningful words
 *     (>4 chars) that appear in both persona strings.
 *
 * Returns a numeric score; callers decide the threshold.
 */
function computeAlignmentScore(
  a: { persona: string; topic_affinity?: string[] },
  b: { persona: string; topic_affinity?: string[] }
): number {
  const aTopics = a.topic_affinity ?? [];
  const bTopics = b.topic_affinity ?? [];

  // Prefer topic_affinity keyword overlap when both sides have data
  if (aTopics.length > 0 && bTopics.length > 0) {
    const bSet = new Set(bTopics.map((t) => t.toLowerCase()));
    return aTopics.filter((t) => bSet.has(t.toLowerCase())).length;
  }

  // Fall back to meaningful word overlap in persona strings
  const wordRe = /\b\w{5,}\b/g;
  const aWords = new Set((a.persona.toLowerCase().match(wordRe) ?? []));
  const bWords = (b.persona.toLowerCase().match(wordRe) ?? []);
  return bWords.filter((w) => aWords.has(w)).length;
}

/** Minimum alignment score to trigger a mutual follow */
const TOPIC_ALIGN_THRESHOLD = 2;
/** Maximum mutual follows created per new agent (to avoid fan-out storms) */
const MAX_MUTUAL_FOLLOWS = 10;

// ---------------------------------------------------------------------------
// Exported hook: onAgentCreated
// ---------------------------------------------------------------------------

/**
 * Called fire-and-forget after a new agent's Tapestry profile is created.
 *
 * Finds existing agents whose topics align with the new agent and creates
 * mutual follows between them in the Tapestry social graph.
 *
 * Call site pattern (ai.ts):
 *   void onAgentCreated(characterId, profileId, character, supabase).catch(() => {});
 */
export async function onAgentCreated(
  characterId: string,
  tapestryProfileId: string,
  character: { name: string; persona: string; topic_affinity?: string[] },
  supabaseServiceClient: SupabaseClient
): Promise<void> {
  if (!isTapestryConfigured()) return;

  try {
    // Query all OTHER characters that already have a Tapestry profile
    const { data: existingChars, error } = await supabaseServiceClient
      .from('characters')
      .select('id, name, persona, topic_affinity, tapestry_profile_id')
      .neq('id', characterId)
      .not('tapestry_profile_id', 'is', null);

    if (error || !existingChars || existingChars.length === 0) {
      return;
    }

    // Score and filter aligned characters
    const aligned: Array<{ id: string; tapestryProfileId: string }> = [];

    for (const existing of existingChars) {
      if (typeof existing.tapestry_profile_id !== 'string') continue;

      const existingForScoring = {
        persona: typeof existing.persona === 'string' ? existing.persona : '',
        topic_affinity: Array.isArray(existing.topic_affinity)
          ? (existing.topic_affinity as string[])
          : [],
      };

      const score = computeAlignmentScore(character, existingForScoring);
      if (score >= TOPIC_ALIGN_THRESHOLD) {
        aligned.push({ id: existing.id, tapestryProfileId: existing.tapestry_profile_id });
      }

      if (aligned.length >= MAX_MUTUAL_FOLLOWS) break;
    }

    if (aligned.length === 0) return;

    const alignedProfileIds = aligned.map((a) => a.tapestryProfileId);

    logger.info('Tapestry: queuing mutual follows for new agent', {
      characterId,
      tapestryProfileId,
      alignedCount: aligned.length,
    });

    // New agent follows all aligned agents
    await tapestryService.bulkFollow(tapestryProfileId, alignedProfileIds);

    // Reciprocal: each aligned agent follows the new agent
    for (const { tapestryProfileId: existingTapestryId } of aligned) {
      await tapestryService.createFollow(existingTapestryId, tapestryProfileId);
    }
  } catch (err) {
    logger.warn('Tapestry onAgentCreated hook failed', {
      characterId,
      tapestryProfileId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Exported hook: mirrorContentToTapestry
// ---------------------------------------------------------------------------

/**
 * Called fire-and-forget after content is published to a social platform.
 *
 * Registers the published post as a content node in the Tapestry graph,
 * linked to the character's Tapestry profile. Silently skips if the
 * character hasn't been provisioned in Tapestry yet.
 *
 * Call site pattern (social.ts):
 *   void mirrorContentToTapestry({ tapestryProfileId, sourcePlatform, sourcePostId }).catch(() => {});
 */
export async function mirrorContentToTapestry(options: {
  tapestryProfileId: string | null | undefined;
  sourcePlatform: string;
  sourcePostId?: string;
  contentText?: string;
}): Promise<void> {
  if (!isTapestryConfigured()) return;

  const { tapestryProfileId, sourcePlatform, sourcePostId } = options;

  // Skip silently if this character hasn't been provisioned in Tapestry yet
  if (!tapestryProfileId) return;

  try {
    const contentId = crypto.randomUUID();

    const properties: Record<string, string | number | boolean> = {
      sourcePlatform,
      generatedBy: 'ozskr.ai',
    };

    if (sourcePostId) {
      properties.sourcePostId = sourcePostId;
    }

    const result = await tapestryService.createContent(
      contentId,
      tapestryProfileId,
      properties
    );

    if (result.error) {
      logger.warn('Tapestry mirrorContentToTapestry: createContent failed', {
        tapestryProfileId,
        sourcePlatform,
        sourcePostId,
        error: result.error,
      });
    }
  } catch (err) {
    logger.warn('Tapestry mirrorContentToTapestry hook failed', {
      tapestryProfileId,
      sourcePlatform,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
