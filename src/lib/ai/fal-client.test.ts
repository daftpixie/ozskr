/**
 * Tests for fal.ai Client
 *
 * Verifies: generateImage happy path, typed result shape, FalGenerationError
 * on failure, generateVideo params, and onProgress callback firing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock references
// ---------------------------------------------------------------------------
const { mockSubscribe, mockConfig } = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockConfig: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// The production module does: import * as fal from '@fal-ai/serverless-client'
// The namespace import means we need to mock the module's named exports so
// `fal.subscribe` and `fal.config` resolve correctly.
vi.mock('@fal-ai/serverless-client', () => ({
  subscribe: mockSubscribe,
  config: mockConfig,
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------
import { generateImage, generateVideo, FalGenerationError } from './fal-client';

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const MOCK_IMAGE_URL = 'https://example.com/generated/img.png';
const MOCK_VIDEO_URL = 'https://example.com/generated/vid.mp4';

const MOCK_IMAGE_RESPONSE = {
  images: [
    {
      url: MOCK_IMAGE_URL,
      width: 1024,
      height: 1024,
      content_type: 'image/png',
    },
  ],
  request_id: 'req_img_123',
};

const MOCK_VIDEO_RESPONSE = {
  video: {
    url: MOCK_VIDEO_URL,
    content_type: 'video/mp4',
  },
  request_id: 'req_vid_456',
};

// ---------------------------------------------------------------------------
// Tests: generateImage
// ---------------------------------------------------------------------------

describe('generateImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FAL_KEY = 'test-fal-key';
    mockSubscribe.mockResolvedValue(MOCK_IMAGE_RESPONSE);
  });

  it('should call fal.subscribe with the correct model and input params', async () => {
    await generateImage({
      model: 'fal-ai/nano-banana-2',
      prompt: 'A futuristic cityscape at dusk',
      aspectRatio: '16:9',
      resolution: '2K',
      numImages: 2,
    });

    expect(mockSubscribe).toHaveBeenCalledOnce();
    expect(mockSubscribe).toHaveBeenCalledWith(
      'fal-ai/nano-banana-2',
      expect.objectContaining({
        input: expect.objectContaining({
          prompt: 'A futuristic cityscape at dusk',
          aspect_ratio: '16:9',
          resolution: '2K',
          num_images: 2,
          output_format: 'png',
          safety_tolerance: '4',
        }),
        logs: false,
      })
    );
  });

  it('should use default params when optional fields are omitted', async () => {
    await generateImage({
      model: 'fal-ai/nano-banana',
      prompt: 'Abstract art',
    });

    expect(mockSubscribe).toHaveBeenCalledWith(
      'fal-ai/nano-banana',
      expect.objectContaining({
        input: expect.objectContaining({
          aspect_ratio: '1:1',
          resolution: '1K',
          num_images: 1,
        }),
      })
    );
  });

  it('should return a typed ImageGenerationResult from the mocked response', async () => {
    const result = await generateImage({
      model: 'fal-ai/nano-banana-2',
      prompt: 'Solana blockchain visualization',
    });

    expect(result.images).toHaveLength(1);
    expect(result.images[0].url).toBe(MOCK_IMAGE_URL);
    expect(result.images[0].width).toBe(1024);
    expect(result.images[0].height).toBe(1024);
    expect(result.images[0].contentType).toBe('image/png');
    expect(result.falRequestId).toBe('req_img_123');
  });

  it('should throw FalGenerationError when fal.ai returns no images', async () => {
    mockSubscribe.mockResolvedValueOnce({ images: [], request_id: 'req_empty' });

    await expect(
      generateImage({ model: 'fal-ai/nano-banana', prompt: 'Empty result' })
    ).rejects.toThrow(FalGenerationError);
  });

  it('should throw FalGenerationError when fal.ai returns image with no URL', async () => {
    mockSubscribe.mockResolvedValueOnce({
      images: [{ url: '', width: 1024, height: 1024, content_type: 'image/png' }],
      request_id: 'req_no_url',
    });

    await expect(
      generateImage({ model: 'fal-ai/nano-banana', prompt: 'No URL' })
    ).rejects.toThrow(FalGenerationError);
  });

  it('should wrap unexpected errors in FalGenerationError with correct properties', async () => {
    mockSubscribe.mockRejectedValueOnce(new Error('Rate limit exceeded'));

    let caught: unknown;
    try {
      await generateImage({ model: 'fal-ai/nano-banana', prompt: 'Rate limited' });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(FalGenerationError);
    if (caught instanceof FalGenerationError) {
      expect(caught.name).toBe('FalGenerationError');
      expect(caught.falMessage).toBe('Rate limit exceeded');
      expect(caught.model).toBe('fal-ai/nano-banana');
    }
  });

  it('should throw FalGenerationError (not a generic Error) when FAL_KEY is missing', async () => {
    delete process.env.FAL_KEY;

    await expect(
      generateImage({ model: 'fal-ai/nano-banana', prompt: 'No key' })
    ).rejects.toThrow(FalGenerationError);
  });

  it('should call fal.config with the FAL_KEY credential', async () => {
    process.env.FAL_KEY = 'my-secret-fal-key';

    await generateImage({
      model: 'fal-ai/nano-banana',
      prompt: 'Configure test',
    });

    expect(mockConfig).toHaveBeenCalledWith(
      expect.objectContaining({ credentials: 'my-secret-fal-key' })
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: generateVideo
// ---------------------------------------------------------------------------

describe('generateVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FAL_KEY = 'test-fal-key';
    mockSubscribe.mockResolvedValue(MOCK_VIDEO_RESPONSE);
  });

  it('should call fal.subscribe with the correct video model and input params', async () => {
    await generateVideo({
      model: 'fal-ai/veo3/fast',
      prompt: 'Drone shot over Solana Beach at sunset',
      duration: '7s',
      resolution: '1080p',
      generateAudio: false,
      aspectRatio: '16:9',
    });

    expect(mockSubscribe).toHaveBeenCalledOnce();
    expect(mockSubscribe).toHaveBeenCalledWith(
      'fal-ai/veo3/fast',
      expect.objectContaining({
        input: expect.objectContaining({
          prompt: 'Drone shot over Solana Beach at sunset',
          duration: '7s',
          resolution: '1080p',
          generate_audio: false,
          aspect_ratio: '16:9',
        }),
        logs: false,
      })
    );
  });

  it('should use default params when optional fields are omitted', async () => {
    await generateVideo({
      model: 'fal-ai/veo3',
      prompt: 'Default params test',
    });

    expect(mockSubscribe).toHaveBeenCalledWith(
      'fal-ai/veo3',
      expect.objectContaining({
        input: expect.objectContaining({
          duration: '5s',
          resolution: '720p',
          generate_audio: true,
          aspect_ratio: '16:9',
        }),
      })
    );
  });

  it('should return a typed VideoGenerationResult from the mocked response', async () => {
    const result = await generateVideo({
      model: 'fal-ai/veo3/fast',
      prompt: 'Test video',
    });

    expect(result.video.url).toBe(MOCK_VIDEO_URL);
    expect(result.video.contentType).toBe('video/mp4');
    expect(result.falRequestId).toBe('req_vid_456');
  });

  it('should throw FalGenerationError when fal.ai returns no video URL', async () => {
    mockSubscribe.mockResolvedValueOnce({
      video: { url: undefined, content_type: 'video/mp4' },
      request_id: 'req_no_vid',
    });

    await expect(
      generateVideo({ model: 'fal-ai/veo3', prompt: 'No video' })
    ).rejects.toThrow(FalGenerationError);
  });

  it('should wrap unexpected errors in FalGenerationError for video', async () => {
    mockSubscribe.mockRejectedValueOnce(new Error('Video generation timed out'));

    await expect(
      generateVideo({ model: 'fal-ai/veo3', prompt: 'Timeout test' })
    ).rejects.toThrow(FalGenerationError);
  });

  it('should fire onProgress callback when queue updates are received', async () => {
    // Capture the onQueueUpdate handler passed to fal.subscribe
    let capturedOnQueueUpdate: ((status: { status: string }) => void) | null = null;

    mockSubscribe.mockImplementationOnce(
      (_model: string, opts: { onQueueUpdate?: (s: { status: string }) => void }) => {
        capturedOnQueueUpdate = opts.onQueueUpdate ?? null;
        // Simulate a queue update before resolving
        opts.onQueueUpdate?.({ status: 'IN_QUEUE' });
        opts.onQueueUpdate?.({ status: 'IN_PROGRESS' });
        return Promise.resolve(MOCK_VIDEO_RESPONSE);
      }
    );

    const progressStatuses: string[] = [];
    const onProgress = (status: string): void => {
      progressStatuses.push(status);
    };

    await generateVideo({
      model: 'fal-ai/veo3/fast',
      prompt: 'Progress test',
      onProgress,
    });

    expect(capturedOnQueueUpdate).not.toBeNull();
    expect(progressStatuses).toContain('IN_QUEUE');
    expect(progressStatuses).toContain('IN_PROGRESS');
  });

  it('should not throw when onProgress is not provided (no-op)', async () => {
    mockSubscribe.mockImplementationOnce(
      (_model: string, opts: { onQueueUpdate?: (s: { status: string }) => void }) => {
        opts.onQueueUpdate?.({ status: 'IN_QUEUE' });
        return Promise.resolve(MOCK_VIDEO_RESPONSE);
      }
    );

    // Should not throw even without onProgress
    await expect(
      generateVideo({ model: 'fal-ai/veo3', prompt: 'No progress handler' })
    ).resolves.toBeDefined();
  });

  it('should default video contentType to video/mp4 when not provided by fal.ai', async () => {
    mockSubscribe.mockResolvedValueOnce({
      video: { url: MOCK_VIDEO_URL, content_type: undefined },
      request_id: 'req_no_ct',
    });

    const result = await generateVideo({
      model: 'fal-ai/veo3/fast',
      prompt: 'No content type',
    });

    expect(result.video.contentType).toBe('video/mp4');
  });
});
