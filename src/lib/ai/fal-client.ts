/**
 * fal.ai Client
 *
 * Server-side wrapper for fal.ai image and video generation.
 * Uses @fal-ai/serverless-client (v0.15.0) which re-exports the same
 * subscribe/config API as @fal-ai/client.
 *
 * IMPORTANT: fal.ai returns temporary CDN URLs that expire in 7 days.
 * This module returns the raw result only. Callers are responsible for
 * downloading the media and persisting it to Cloudflare R2 before returning
 * URLs to the client or storing references in the database.
 *
 * @module fal-client
 */

import * as fal from '@fal-ai/serverless-client';
import type { QueueStatus } from '@fal-ai/serverless-client';
import { logger } from '@/lib/utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImageGenerationResult {
  images: Array<{
    url: string;
    width: number;
    height: number;
    contentType: string;
  }>;
  description?: string;
  falRequestId?: string;
}

export interface VideoGenerationResult {
  video: {
    url: string;
    contentType: string;
  };
  falRequestId?: string;
}

/**
 * Typed error for fal.ai generation failures.
 * Carries the original fal.ai error message for observability.
 */
export class FalGenerationError extends Error {
  constructor(
    message: string,
    public readonly falMessage?: string,
    public readonly model?: string
  ) {
    super(message);
    this.name = 'FalGenerationError';
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Configure fal.ai credentials from environment.
 * Called lazily before each request so the module can be imported freely
 * without requiring FAL_KEY at module load time.
 */
const configureFal = (): void => {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    throw new FalGenerationError(
      'FAL_KEY environment variable is required for fal.ai generation'
    );
  }
  fal.config({ credentials: falKey });
};

/** Narrow the raw fal.ai subscribe result to the nano-banana-2 image shape. */
interface FalImageResponse {
  images?: Array<{
    url?: string;
    width?: number;
    height?: number;
    content_type?: string;
  }>;
  request_id?: string;
}

/** Narrow the raw fal.ai subscribe result to a video response shape. */
interface FalVideoResponse {
  video?: {
    url?: string;
    content_type?: string;
  };
  request_id?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate one or more images via fal.ai.
 *
 * Uses fal.subscribe() which polls or streams until the queue job completes,
 * then returns the final result.
 *
 * Supported model default: 'fal-ai/nano-banana-2'
 * Other FLUX models use the same aspect_ratio/resolution params.
 *
 * @param params.model     - fal.ai endpoint ID (e.g. 'fal-ai/nano-banana-2')
 * @param params.prompt    - Image generation prompt
 * @param params.aspectRatio - '1:1' | '16:9' | '9:16' | 'auto' (default '1:1')
 * @param params.resolution  - '1K' | '2K' | '4K' (default '1K')
 * @param params.numImages   - Number of images to generate (default 1)
 * @returns Raw image URLs and metadata. Caller MUST persist URLs to R2.
 * @throws FalGenerationError on generation failure
 */
export async function generateImage(params: {
  model: string;
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  numImages?: number;
}): Promise<ImageGenerationResult> {
  const {
    model,
    prompt,
    aspectRatio = '1:1',
    resolution = '1K',
    numImages = 1,
  } = params;

  logger.info('[fal-client] image generation start', {
    model,
    aspectRatio,
    resolution,
    numImages,
  });

  try {
    configureFal();

    const input = {
      prompt,
      aspect_ratio: aspectRatio,
      resolution,
      num_images: numImages,
      output_format: 'png',
      safety_tolerance: '4',
    };

    const raw = await fal.subscribe<typeof input, FalImageResponse>(model, {
      input,
      logs: false,
      onQueueUpdate: (status: QueueStatus) => {
        logger.debug('[fal-client] image queue update', {
          model,
          status: status.status,
        });
      },
    });

    const images = (raw.images ?? []).map((img) => ({
      url: img.url ?? '',
      width: img.width ?? 0,
      height: img.height ?? 0,
      contentType: img.content_type ?? 'image/png',
    }));

    if (images.length === 0 || !images[0].url) {
      throw new FalGenerationError(
        'fal.ai returned no image URLs',
        undefined,
        model
      );
    }

    logger.info('[fal-client] image generation complete', {
      model,
      imageCount: images.length,
      falRequestId: raw.request_id,
    });

    return {
      images,
      falRequestId: raw.request_id,
    };
  } catch (error) {
    if (error instanceof FalGenerationError) {
      throw error;
    }
    const falMessage = error instanceof Error ? error.message : String(error);
    logger.error('[fal-client] image generation error', {
      model,
      error: falMessage,
    });
    throw new FalGenerationError(
      `Image generation failed for model ${model}: ${falMessage}`,
      falMessage,
      model
    );
  }
}

/**
 * Generate a video via fal.ai.
 *
 * Uses fal.subscribe() with onQueueUpdate for progress reporting.
 * Video generation is long-running (30s–5min depending on model);
 * pass onProgress to surface status updates to the caller.
 *
 * Supported model default: 'fal-ai/veo3/fast'
 * Also supports: 'fal-ai/veo3', 'fal-ai/kling-video/v2.1/standard/text-to-video',
 * 'fal-ai/runway-gen3/alpha/text-to-video'
 *
 * @param params.model          - fal.ai endpoint ID
 * @param params.prompt         - Video generation prompt
 * @param params.duration       - '5s' | '7s' | '8s' (default '5s')
 * @param params.resolution     - '720p' | '1080p' | '4K' (default '720p')
 * @param params.generateAudio  - Whether to generate audio (default true)
 * @param params.aspectRatio    - '16:9' (default '16:9')
 * @param params.onProgress     - Optional callback for queue status updates
 * @returns Raw video URL and metadata. Caller MUST persist URL to R2.
 * @throws FalGenerationError on generation failure
 */
export async function generateVideo(params: {
  model: string;
  prompt: string;
  duration?: string;
  resolution?: string;
  generateAudio?: boolean;
  aspectRatio?: string;
  onProgress?: (status: string) => void;
}): Promise<VideoGenerationResult> {
  const {
    model,
    prompt,
    duration = '5s',
    resolution = '720p',
    generateAudio = true,
    aspectRatio = '16:9',
    onProgress,
  } = params;

  logger.info('[fal-client] video generation start', {
    model,
    duration,
    resolution,
    generateAudio,
    aspectRatio,
  });

  try {
    configureFal();

    const input = {
      prompt,
      duration,
      resolution,
      generate_audio: generateAudio,
      aspect_ratio: aspectRatio,
    };

    const raw = await fal.subscribe<typeof input, FalVideoResponse>(model, {
      input,
      logs: false,
      onQueueUpdate: (status: QueueStatus) => {
        const statusLabel = status.status;
        logger.debug('[fal-client] video queue update', {
          model,
          status: statusLabel,
        });
        if (onProgress) {
          onProgress(statusLabel);
        }
      },
    });

    const videoUrl = raw.video?.url;
    if (!videoUrl) {
      throw new FalGenerationError(
        'fal.ai returned no video URL',
        undefined,
        model
      );
    }

    const contentType = raw.video?.content_type ?? 'video/mp4';

    logger.info('[fal-client] video generation complete', {
      model,
      falRequestId: raw.request_id,
    });

    return {
      video: {
        url: videoUrl,
        contentType,
      },
      falRequestId: raw.request_id,
    };
  } catch (error) {
    if (error instanceof FalGenerationError) {
      throw error;
    }
    const falMessage = error instanceof Error ? error.message : String(error);
    logger.error('[fal-client] video generation error', {
      model,
      error: falMessage,
    });
    throw new FalGenerationError(
      `Video generation failed for model ${model}: ${falMessage}`,
      falMessage,
      model
    );
  }
}
