/**
 * Model Router
 *
 * Routes generation requests to the correct provider based on content category:
 *   - 'text'        → Anthropic (Claude) via Vercel AI SDK generateText()
 *   - 'image'       → fal.ai via generateImage()
 *   - 'video'       → fal.ai via generateVideo()
 *   - 'image-text'  → Both in parallel (Promise.all)
 *   - 'video-text'  → Both in parallel (Promise.all)
 *
 * Workflow boundary note (see CLAUDE.md §Workflow Boundary: Mastra vs. LangGraph):
 *   This module implements a SIMPLE LINEAR pipeline per category — Mastra territory.
 *   Quality retry loops or multi-model tournament selection would move to LangGraph.
 *
 * Character DNA is loaded once per call from Supabase (service role) and used to
 * build the Claude system prompt with cache_control: ephemeral for prompt caching.
 *
 * Moderation is MANDATORY — moderateContent() runs on all generated content before
 * this function returns. Content that fails moderation is NOT stored or published.
 *
 * @module model-router
 */

import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createSupabaseServerClient } from '@/lib/api/supabase';
import { moderateContent } from '@/lib/ai/pipeline/moderation';
import { generateImage, generateVideo } from '@/lib/ai/fal-client';
import { logger } from '@/lib/utils/logger';
import type { Character } from '@/types/database';
import { ModerationStatus } from '@/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Mastra workflow / Workstream 3 content category discriminator.
 * Determines which provider(s) are called and how outputs are combined.
 */
export type ContentCategory =
  | 'text'
  | 'image'
  | 'image-text'
  | 'video'
  | 'video-text';

export interface GenerationRequest {
  /** Content category — drives model routing */
  category: ContentCategory;
  /** User-supplied prompt (may have already been enhanced upstream) */
  prompt: string;
  /** Character UUID from the `characters` table — used to load DNA */
  characterId: string;
  /** Claude model ID. Defaults to 'claude-sonnet-4-6' */
  textModel?: string;
  /** fal.ai image endpoint ID. Defaults to 'fal-ai/nano-banana-2' */
  imageModel?: string;
  /** fal.ai video endpoint ID. Defaults to 'fal-ai/veo3/fast' */
  videoModel?: string;
  imageOptions?: {
    aspectRatio?: string;
    resolution?: string;
  };
  videoOptions?: {
    duration?: string;
    resolution?: string;
    generateAudio?: boolean;
  };
  /** Optional progress callback — fired at meaningful pipeline stages */
  onProgress?: (stage: string, message?: string) => void;
}

export interface GenerationOutput {
  /** Generated text (present for 'text', 'image-text', 'video-text') */
  text?: string;
  /**
   * Raw fal.ai image URLs (present for 'image', 'image-text').
   * IMPORTANT: These are temporary fal.ai CDN URLs that expire in 7 days.
   * Callers MUST download and persist to Cloudflare R2 before storing references.
   */
  imageUrls?: string[];
  /**
   * Raw fal.ai video URL (present for 'video', 'video-text').
   * IMPORTANT: Temporary fal.ai CDN URL — expires in 7 days. Persist to R2.
   */
  videoUrl?: string;
  /** Anthropic request ID for tracing/debugging */
  anthropicRequestId?: string;
  /** fal.ai request ID for tracing/debugging */
  falRequestId?: string;
  /** Claude input token count */
  tokenUsageInput?: number;
  /** Claude output token count */
  tokenUsageOutput?: number;
  /**
   * Aggregate moderation outcome across all generated content.
   * 'rejected' — content blocked, nothing stored
   * 'flagged'  — content queued for human review
   * 'approved' — all stages passed
   */
  moderationStatus: 'approved' | 'rejected' | 'flagged';
  moderationDetails?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class ModelRouterError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ModelRouterError';
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TEXT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_IMAGE_MODEL = 'fal-ai/nano-banana-2';
const DEFAULT_VIDEO_MODEL = 'fal-ai/veo3/fast';

// ---------------------------------------------------------------------------
// Supabase service-role client
// ---------------------------------------------------------------------------

/**
 * Create a service-role Supabase client for server-side character DNA loading.
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS (content pipeline is server-side).
 */
const getServiceClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new ModelRouterError(
      'SUPABASE_SERVICE_ROLE_KEY environment variable is required'
    );
  }
  return createSupabaseServerClient(serviceRoleKey);
};

// ---------------------------------------------------------------------------
// Character DNA loading
// ---------------------------------------------------------------------------

/**
 * Load character DNA from Supabase for system prompt construction.
 * Selects only the fields needed for prompt building.
 */
async function loadCharacterDna(
  characterId: string
): Promise<Pick<Character, 'name' | 'persona' | 'voice_tone' | 'guardrails' | 'topic_affinity'>> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('characters')
    .select('name, persona, voice_tone, guardrails, topic_affinity')
    .eq('id', characterId)
    .single();

  if (error || !data) {
    throw new ModelRouterError(
      `Failed to load character DNA for ${characterId}: ${error?.message ?? 'not found'}`
    );
  }

  return data as Pick<Character, 'name' | 'persona' | 'voice_tone' | 'guardrails' | 'topic_affinity'>;
}

/**
 * Build a Claude system prompt from character DNA.
 * The system prompt is injected with cache_control: ephemeral so Claude can
 * cache it across calls for the same character (prompt caching — see CLAUDE.md).
 */
function buildSystemPrompt(
  dna: Pick<Character, 'name' | 'persona' | 'voice_tone' | 'guardrails' | 'topic_affinity'>
): string {
  const guardrailSection =
    dna.guardrails && dna.guardrails.length > 0
      ? `\n\nContent guardrails (NEVER violate):\n${dna.guardrails.map((g) => `- ${g}`).join('\n')}`
      : '';

  const topicSection =
    dna.topic_affinity && dna.topic_affinity.length > 0
      ? `\n\nPreferred topics: ${dna.topic_affinity.join(', ')}`
      : '';

  return (
    `You are ${dna.name}, an AI social media influencer.\n\n` +
    `Personality: ${dna.persona}\n\n` +
    `Voice and tone: ${dna.voice_tone}` +
    topicSection +
    guardrailSection +
    `\n\nGenerate content that authentically reflects this character's voice. ` +
    `All generated content must include appropriate AI disclosure (e.g. #AIGenerated) ` +
    `and comply with platform terms of service.`
  );
}

// ---------------------------------------------------------------------------
// Moderation status mapping
// ---------------------------------------------------------------------------

/**
 * Map the pipeline ModerationStatus enum to the GenerationOutput union type.
 * The output type is intentionally narrower than the DB enum.
 */
function mapModerationStatus(
  status: ModerationStatus
): 'approved' | 'rejected' | 'flagged' {
  switch (status) {
    case ModerationStatus.APPROVED:
      return 'approved';
    case ModerationStatus.REJECTED:
      return 'rejected';
    case ModerationStatus.FLAGGED:
      return 'flagged';
    default:
      // PENDING / PROCESSING treated as flagged (human review)
      return 'flagged';
  }
}

// ---------------------------------------------------------------------------
// Category handlers
// ---------------------------------------------------------------------------

/**
 * Generate text using Claude with character DNA system prompt and prompt caching.
 *
 * Uses Vercel AI SDK generateText() with the anthropic provider.
 * cache_control: ephemeral is applied to the system prompt so Claude
 * can cache the character context across requests for the same character.
 */
async function handleText(
  request: GenerationRequest,
  dna: Pick<Character, 'name' | 'persona' | 'voice_tone' | 'guardrails' | 'topic_affinity'>
): Promise<Omit<GenerationOutput, 'moderationStatus' | 'moderationDetails'>> {
  const modelId = request.textModel ?? DEFAULT_TEXT_MODEL;
  const systemPrompt = buildSystemPrompt(dna);

  const result = await generateText({
    model: anthropic(modelId),
    messages: [
      {
        role: 'user',
        content: request.prompt,
      },
    ],
    system: systemPrompt,
    // Apply prompt caching to the system prompt via the Vercel AI SDK
    // providerOptions API. The anthropic provider maps cacheControl to
    // the Anthropic API's cache_control: { type: 'ephemeral' } header on the
    // system message, enabling KV caching of character DNA across calls.
    providerOptions: {
      anthropic: {
        cacheControl: { type: 'ephemeral' },
      },
    },
  });

  return {
    text: result.text.trim(),
    anthropicRequestId: undefined, // Vercel AI SDK does not expose request ID directly
    tokenUsageInput: result.usage.inputTokens ?? 0,
    tokenUsageOutput: result.usage.outputTokens ?? 0,
  };
}

/**
 * Generate an image via fal.ai.
 * Moderation runs on the prompt text (image content is checked via fal.ai's
 * built-in safety checker; Stage 2 AWS Rekognition is pending implementation).
 */
async function handleImage(
  request: GenerationRequest
): Promise<Omit<GenerationOutput, 'moderationStatus' | 'moderationDetails'>> {
  const model = request.imageModel ?? DEFAULT_IMAGE_MODEL;
  const result = await generateImage({
    model,
    prompt: request.prompt,
    aspectRatio: request.imageOptions?.aspectRatio,
    resolution: request.imageOptions?.resolution,
  });

  return {
    imageUrls: result.images.map((img) => img.url),
    falRequestId: result.falRequestId,
  };
}

/**
 * Generate a video via fal.ai.
 */
async function handleVideo(
  request: GenerationRequest
): Promise<Omit<GenerationOutput, 'moderationStatus' | 'moderationDetails'>> {
  const model = request.videoModel ?? DEFAULT_VIDEO_MODEL;
  const result = await generateVideo({
    model,
    prompt: request.prompt,
    duration: request.videoOptions?.duration,
    resolution: request.videoOptions?.resolution,
    generateAudio: request.videoOptions?.generateAudio,
    onProgress: (status) => {
      request.onProgress?.('generating', `Video queue: ${status}`);
    },
  });

  return {
    videoUrl: result.video.url,
    falRequestId: result.falRequestId,
  };
}

// ---------------------------------------------------------------------------
// No-op progress helper (avoids repeated null-checks in handlers)
// ---------------------------------------------------------------------------

function noop(_stage: string, _message?: string): void {
  // intentionally empty
}

// ---------------------------------------------------------------------------
// Main routing function
// ---------------------------------------------------------------------------

/**
 * Route a generation request to the appropriate model(s) and run the full
 * moderation pipeline before returning.
 *
 * Content that fails moderation is returned with moderationStatus 'rejected'
 * or 'flagged' — it is NOT stored or published. The caller is responsible for
 * inspecting moderationStatus before persisting the output.
 *
 * Progress stages fired via onProgress:
 *   'start'      — request received, loading character
 *   'generating' — model call(s) in flight
 *   'moderating' — moderation pipeline running
 *   'complete'   — all stages done
 *
 * @throws ModelRouterError on unrecoverable errors (character not found, bad env, etc.)
 */
export async function routeGeneration(
  request: GenerationRequest
): Promise<GenerationOutput> {
  const progress = request.onProgress ?? noop;
  const { category, characterId, prompt } = request;

  logger.info('[model-router] generation start', {
    category,
    characterId,
    textModel: request.textModel ?? DEFAULT_TEXT_MODEL,
    imageModel: request.imageModel ?? DEFAULT_IMAGE_MODEL,
    videoModel: request.videoModel ?? DEFAULT_VIDEO_MODEL,
  });

  progress('start', `Loading character DNA for ${characterId}`);

  // Load character DNA for text-based categories
  let dna: Pick<
    Character,
    'name' | 'persona' | 'voice_tone' | 'guardrails' | 'topic_affinity'
  > | null = null;

  const needsDna = category === 'text' || category === 'image-text' || category === 'video-text';
  if (needsDna) {
    dna = await loadCharacterDna(characterId);
  }

  progress('generating', `Routing ${category} generation`);

  try {
    switch (category) {
      // ------------------------------------------------------------------
      // Text only
      // ------------------------------------------------------------------
      case 'text': {
        if (!dna) throw new ModelRouterError('Character DNA required for text generation');

        progress('generating', 'Generating text with Claude');
        const raw = await handleText(request, dna);

        progress('moderating', 'Running content moderation');
        const modResult = await moderateContent(
          { text: raw.text },
          (p) => progress('moderating', p.message)
        );

        const moderationStatus = mapModerationStatus(modResult.status);

        logger.info('[model-router] text generation complete', {
          characterId,
          moderationStatus,
          tokenUsageInput: raw.tokenUsageInput,
          tokenUsageOutput: raw.tokenUsageOutput,
        });

        progress('complete', 'Generation complete');

        return {
          ...raw,
          moderationStatus,
          moderationDetails: modResult.details,
        };
      }

      // ------------------------------------------------------------------
      // Image only
      // ------------------------------------------------------------------
      case 'image': {
        progress('generating', 'Generating image with fal.ai');
        const raw = await handleImage(request);

        // Moderate the prompt text; fal.ai's safety checker covers the image itself
        progress('moderating', 'Running prompt moderation');
        const modResult = await moderateContent(
          { text: prompt },
          (p) => progress('moderating', p.message)
        );

        const moderationStatus = mapModerationStatus(modResult.status);

        logger.info('[model-router] image generation complete', {
          characterId,
          moderationStatus,
          imageCount: raw.imageUrls?.length ?? 0,
          falRequestId: raw.falRequestId,
        });

        progress('complete', 'Generation complete');

        return {
          ...raw,
          moderationStatus,
          moderationDetails: modResult.details,
        };
      }

      // ------------------------------------------------------------------
      // Video only
      // ------------------------------------------------------------------
      case 'video': {
        progress('generating', 'Generating video with fal.ai');
        const raw = await handleVideo(request);

        // Moderate the prompt text; fal.ai safety checker covers the video
        progress('moderating', 'Running prompt moderation');
        const modResult = await moderateContent(
          { text: prompt },
          (p) => progress('moderating', p.message)
        );

        const moderationStatus = mapModerationStatus(modResult.status);

        logger.info('[model-router] video generation complete', {
          characterId,
          moderationStatus,
          falRequestId: raw.falRequestId,
        });

        progress('complete', 'Generation complete');

        return {
          ...raw,
          moderationStatus,
          moderationDetails: modResult.details,
        };
      }

      // ------------------------------------------------------------------
      // Image + Text (parallel)
      // ------------------------------------------------------------------
      case 'image-text': {
        if (!dna) throw new ModelRouterError('Character DNA required for image-text generation');

        progress('generating', 'Generating text and image in parallel');

        const [textRaw, imageRaw] = await Promise.all([
          handleText(request, dna),
          handleImage(request),
        ]);

        // Moderate both: text output and prompt (covers image)
        progress('moderating', 'Running moderation on text and image');

        const [textMod, imageMod] = await Promise.all([
          moderateContent(
            { text: textRaw.text },
            (p) => progress('moderating', `[text] ${p.message}`)
          ),
          moderateContent(
            { text: prompt },
            (p) => progress('moderating', `[image] ${p.message}`)
          ),
        ]);

        // Aggregate: use the worst outcome across both moderation results
        const worstStatus = aggregateModerationStatus(
          textMod.status,
          imageMod.status
        );
        const moderationStatus = mapModerationStatus(worstStatus);

        logger.info('[model-router] image-text generation complete', {
          characterId,
          moderationStatus,
          tokenUsageInput: textRaw.tokenUsageInput,
          tokenUsageOutput: textRaw.tokenUsageOutput,
          imageCount: imageRaw.imageUrls?.length ?? 0,
          falRequestId: imageRaw.falRequestId,
        });

        progress('complete', 'Generation complete');

        return {
          text: textRaw.text,
          imageUrls: imageRaw.imageUrls,
          anthropicRequestId: textRaw.anthropicRequestId,
          falRequestId: imageRaw.falRequestId,
          tokenUsageInput: textRaw.tokenUsageInput,
          tokenUsageOutput: textRaw.tokenUsageOutput,
          moderationStatus,
          moderationDetails: {
            text: textMod.details,
            image: imageMod.details,
          },
        };
      }

      // ------------------------------------------------------------------
      // Video + Text (parallel)
      // ------------------------------------------------------------------
      case 'video-text': {
        if (!dna) throw new ModelRouterError('Character DNA required for video-text generation');

        progress('generating', 'Generating text and video in parallel');

        const [textRaw, videoRaw] = await Promise.all([
          handleText(request, dna),
          handleVideo(request),
        ]);

        // Moderate both: text output and prompt (covers video)
        progress('moderating', 'Running moderation on text and video');

        const [textMod, videoMod] = await Promise.all([
          moderateContent(
            { text: textRaw.text },
            (p) => progress('moderating', `[text] ${p.message}`)
          ),
          moderateContent(
            { text: prompt },
            (p) => progress('moderating', `[video] ${p.message}`)
          ),
        ]);

        const worstStatus = aggregateModerationStatus(
          textMod.status,
          videoMod.status
        );
        const moderationStatus = mapModerationStatus(worstStatus);

        logger.info('[model-router] video-text generation complete', {
          characterId,
          moderationStatus,
          tokenUsageInput: textRaw.tokenUsageInput,
          tokenUsageOutput: textRaw.tokenUsageOutput,
          falRequestId: videoRaw.falRequestId,
        });

        progress('complete', 'Generation complete');

        return {
          text: textRaw.text,
          videoUrl: videoRaw.videoUrl,
          anthropicRequestId: textRaw.anthropicRequestId,
          falRequestId: videoRaw.falRequestId,
          tokenUsageInput: textRaw.tokenUsageInput,
          tokenUsageOutput: textRaw.tokenUsageOutput,
          moderationStatus,
          moderationDetails: {
            text: textMod.details,
            video: videoMod.details,
          },
        };
      }

      default: {
        // TypeScript exhaustiveness check
        const exhaustiveCheck: never = category;
        throw new ModelRouterError(
          `Unknown content category: ${exhaustiveCheck}`
        );
      }
    }
  } catch (error) {
    if (error instanceof ModelRouterError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[model-router] generation failed', {
      category,
      characterId,
      error: message,
    });
    throw new ModelRouterError(
      `Generation failed for category '${category}': ${message}`,
      error
    );
  }
}

// ---------------------------------------------------------------------------
// Moderation aggregation
// ---------------------------------------------------------------------------

/**
 * Aggregate two moderation statuses and return the worst outcome.
 * Priority order: REJECTED > FLAGGED > PENDING/PROCESSING > APPROVED
 */
function aggregateModerationStatus(
  a: ModerationStatus,
  b: ModerationStatus
): ModerationStatus {
  const priority = (s: ModerationStatus): number => {
    switch (s) {
      case ModerationStatus.REJECTED:
        return 4;
      case ModerationStatus.FLAGGED:
        return 3;
      case ModerationStatus.PROCESSING:
        return 2;
      case ModerationStatus.PENDING:
        return 1;
      case ModerationStatus.APPROVED:
        return 0;
    }
  };

  return priority(a) >= priority(b) ? a : b;
}
