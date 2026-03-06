/**
 * Tests for Model Router
 *
 * Verifies: per-category routing to correct provider(s), parallel calls for
 * composite categories, moderation status propagation, and onProgress callback
 * firing at expected pipeline stages.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModerationStatus } from '@/types/database';

// ---------------------------------------------------------------------------
// Hoisted mock references
// ---------------------------------------------------------------------------
const {
  mockGenerateText,
  mockAnthropic,
  mockFalSubscribe,
  mockFalConfig,
  mockModerateContent,
  mockSupabaseSingle,
} = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockAnthropic: vi.fn(),
  mockFalSubscribe: vi.fn(),
  mockFalConfig: vi.fn(),
  mockModerateContent: vi.fn(),
  mockSupabaseSingle: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('ai', () => ({
  generateText: mockGenerateText,
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: mockAnthropic,
}));

vi.mock('@fal-ai/serverless-client', () => ({
  subscribe: mockFalSubscribe,
  config: mockFalConfig,
}));

vi.mock('@/lib/ai/pipeline/moderation', () => ({
  moderateContent: mockModerateContent,
}));

// Mock Supabase — the model-router uses createSupabaseServerClient internally
// which calls createClient from @supabase/supabase-js.
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(function () {
    return {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockSupabaseSingle,
      })),
    };
  }),
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
import { routeGeneration, ModelRouterError } from './model-router';
import type { GenerationRequest } from './model-router';

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const MOCK_CHARACTER_DNA = {
  name: 'CryptoWiz',
  persona: 'A witty crypto analyst with deep Solana expertise.',
  voice_tone: 'Confident, technical, with occasional humor.',
  guardrails: ['No financial advice', 'No price predictions'],
  topic_affinity: ['DeFi', 'NFTs', 'Solana ecosystem'],
};

const MOCK_IMAGE_URL = 'https://fal.ai/mock/image.png';
const MOCK_VIDEO_URL = 'https://fal.ai/mock/video.mp4';
const MOCK_TEXT_OUTPUT = 'Solana just hit 65k TPS. Bullish. #AIGenerated';

const APPROVED_MODERATION = {
  status: ModerationStatus.APPROVED,
  details: { flagged: false },
};

const REJECTED_MODERATION = {
  status: ModerationStatus.REJECTED,
  details: { flagged: true, reason: 'High-severity content violation' },
};

const FLAGGED_MODERATION = {
  status: ModerationStatus.FLAGGED,
  details: { flagged: true, reason: 'Queued for manual review' },
};

const BASE_REQUEST: GenerationRequest = {
  category: 'text',
  prompt: 'Write a tweet about Solana performance',
  characterId: 'char-uuid-123',
};

// ---------------------------------------------------------------------------
// beforeEach: set up happy-path defaults
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Env vars required by the module
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
  process.env.FAL_KEY = 'test-fal-key';

  // Supabase: return mock character DNA
  mockSupabaseSingle.mockResolvedValue({
    data: MOCK_CHARACTER_DNA,
    error: null,
  });

  // generateText: approved text output
  mockGenerateText.mockResolvedValue({
    text: MOCK_TEXT_OUTPUT,
    usage: { inputTokens: 150, outputTokens: 80 },
  });

  // mockAnthropic: return a provider model object (the router passes this to generateText)
  mockAnthropic.mockReturnValue({ provider: 'anthropic', modelId: 'claude-sonnet-4-6' });

  // fal.subscribe: happy image response
  mockFalSubscribe.mockResolvedValue({
    images: [
      {
        url: MOCK_IMAGE_URL,
        width: 1024,
        height: 1024,
        content_type: 'image/png',
      },
    ],
    request_id: 'req_img_001',
  });

  // moderation: approve by default
  mockModerateContent.mockResolvedValue(APPROVED_MODERATION);
});

// ---------------------------------------------------------------------------
// Tests: text
// ---------------------------------------------------------------------------

describe("routeGeneration category: 'text'", () => {
  it('should call generateText and run moderation, returning text output', async () => {
    const output = await routeGeneration({ ...BASE_REQUEST, category: 'text' });

    expect(mockGenerateText).toHaveBeenCalledOnce();
    expect(mockModerateContent).toHaveBeenCalledOnce();
    expect(output.text).toBe(MOCK_TEXT_OUTPUT);
    expect(output.moderationStatus).toBe('approved');
  });

  it('should include tokenUsageInput and tokenUsageOutput in the output', async () => {
    const output = await routeGeneration({ ...BASE_REQUEST, category: 'text' });

    expect(output.tokenUsageInput).toBe(150);
    expect(output.tokenUsageOutput).toBe(80);
  });

  it('should NOT call fal.subscribe for text-only generation', async () => {
    await routeGeneration({ ...BASE_REQUEST, category: 'text' });

    expect(mockFalSubscribe).not.toHaveBeenCalled();
  });

  it('should load character DNA from Supabase for text category', async () => {
    await routeGeneration({ ...BASE_REQUEST, category: 'text' });

    // single() should have been called to load the character
    expect(mockSupabaseSingle).toHaveBeenCalledOnce();
  });

  it('should propagate REJECTED moderation status', async () => {
    mockModerateContent.mockResolvedValueOnce(REJECTED_MODERATION);

    const output = await routeGeneration({ ...BASE_REQUEST, category: 'text' });

    expect(output.moderationStatus).toBe('rejected');
    expect(output.moderationDetails).toBeDefined();
  });

  it('should propagate FLAGGED moderation status', async () => {
    mockModerateContent.mockResolvedValueOnce(FLAGGED_MODERATION);

    const output = await routeGeneration({ ...BASE_REQUEST, category: 'text' });

    expect(output.moderationStatus).toBe('flagged');
  });

  it('should fire onProgress at start, generating, moderating, and complete stages', async () => {
    const stages: string[] = [];
    const onProgress = (stage: string): void => {
      stages.push(stage);
    };

    await routeGeneration({ ...BASE_REQUEST, category: 'text', onProgress });

    expect(stages).toContain('start');
    expect(stages).toContain('generating');
    expect(stages).toContain('moderating');
    expect(stages).toContain('complete');
  });

  it('should throw ModelRouterError when character is not found in Supabase', async () => {
    mockSupabaseSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    await expect(
      routeGeneration({ ...BASE_REQUEST, category: 'text' })
    ).rejects.toThrow(ModelRouterError);
  });
});

// ---------------------------------------------------------------------------
// Tests: image
// ---------------------------------------------------------------------------

describe("routeGeneration category: 'image'", () => {
  it('should call fal.subscribe and run moderation, returning imageUrls', async () => {
    const output = await routeGeneration({ ...BASE_REQUEST, category: 'image' });

    expect(mockFalSubscribe).toHaveBeenCalledOnce();
    expect(mockModerateContent).toHaveBeenCalledOnce();
    expect(output.imageUrls).toEqual([MOCK_IMAGE_URL]);
    expect(output.moderationStatus).toBe('approved');
  });

  it('should NOT call generateText for image-only generation', async () => {
    await routeGeneration({ ...BASE_REQUEST, category: 'image' });

    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('should NOT load character DNA from Supabase for image-only category', async () => {
    await routeGeneration({ ...BASE_REQUEST, category: 'image' });

    expect(mockSupabaseSingle).not.toHaveBeenCalled();
  });

  it('should include falRequestId in output', async () => {
    const output = await routeGeneration({ ...BASE_REQUEST, category: 'image' });

    expect(output.falRequestId).toBe('req_img_001');
  });

  it('should pass the specified imageModel to fal.subscribe', async () => {
    await routeGeneration({
      ...BASE_REQUEST,
      category: 'image',
      imageModel: 'fal-ai/nano-banana-pro',
    });

    expect(mockFalSubscribe).toHaveBeenCalledWith(
      'fal-ai/nano-banana-pro',
      expect.anything()
    );
  });

  it('should propagate REJECTED moderation for image generation', async () => {
    mockModerateContent.mockResolvedValueOnce(REJECTED_MODERATION);

    const output = await routeGeneration({ ...BASE_REQUEST, category: 'image' });

    expect(output.moderationStatus).toBe('rejected');
  });

  it('should fire onProgress stages for image generation', async () => {
    const stages: string[] = [];
    await routeGeneration({
      ...BASE_REQUEST,
      category: 'image',
      onProgress: (s) => { stages.push(s); },
    });

    expect(stages).toContain('start');
    expect(stages).toContain('generating');
    expect(stages).toContain('moderating');
    expect(stages).toContain('complete');
  });
});

// ---------------------------------------------------------------------------
// Tests: image-text (parallel)
// ---------------------------------------------------------------------------

describe("routeGeneration category: 'image-text'", () => {
  it('should call both generateText and fal.subscribe (in parallel)', async () => {
    const output = await routeGeneration({ ...BASE_REQUEST, category: 'image-text' });

    expect(mockGenerateText).toHaveBeenCalledOnce();
    expect(mockFalSubscribe).toHaveBeenCalledOnce();
    expect(output.text).toBe(MOCK_TEXT_OUTPUT);
    expect(output.imageUrls).toEqual([MOCK_IMAGE_URL]);
  });

  it('should run moderation on both text and image (2 moderation calls)', async () => {
    await routeGeneration({ ...BASE_REQUEST, category: 'image-text' });

    expect(mockModerateContent).toHaveBeenCalledTimes(2);
  });

  it('should return approved when both text and image moderation pass', async () => {
    mockModerateContent
      .mockResolvedValueOnce(APPROVED_MODERATION)
      .mockResolvedValueOnce(APPROVED_MODERATION);

    const output = await routeGeneration({ ...BASE_REQUEST, category: 'image-text' });

    expect(output.moderationStatus).toBe('approved');
  });

  it('should return rejected when image moderation is rejected (worst outcome wins)', async () => {
    mockModerateContent
      .mockResolvedValueOnce(APPROVED_MODERATION)  // text: approved
      .mockResolvedValueOnce(REJECTED_MODERATION);  // image: rejected

    const output = await routeGeneration({ ...BASE_REQUEST, category: 'image-text' });

    expect(output.moderationStatus).toBe('rejected');
  });

  it('should return rejected when text moderation is rejected', async () => {
    mockModerateContent
      .mockResolvedValueOnce(REJECTED_MODERATION)  // text: rejected
      .mockResolvedValueOnce(APPROVED_MODERATION);  // image: approved

    const output = await routeGeneration({ ...BASE_REQUEST, category: 'image-text' });

    expect(output.moderationStatus).toBe('rejected');
  });

  it('should return flagged when one is flagged and the other approved', async () => {
    mockModerateContent
      .mockResolvedValueOnce(FLAGGED_MODERATION)   // text: flagged
      .mockResolvedValueOnce(APPROVED_MODERATION); // image: approved

    const output = await routeGeneration({ ...BASE_REQUEST, category: 'image-text' });

    expect(output.moderationStatus).toBe('flagged');
  });

  it('should load character DNA from Supabase for image-text', async () => {
    await routeGeneration({ ...BASE_REQUEST, category: 'image-text' });

    expect(mockSupabaseSingle).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Tests: video
// ---------------------------------------------------------------------------

describe("routeGeneration category: 'video'", () => {
  beforeEach(() => {
    // Override fal mock to return a video response
    mockFalSubscribe.mockResolvedValue({
      video: { url: MOCK_VIDEO_URL, content_type: 'video/mp4' },
      request_id: 'req_vid_001',
    });
  });

  it('should call fal.subscribe and return videoUrl', async () => {
    const output = await routeGeneration({ ...BASE_REQUEST, category: 'video' });

    expect(mockFalSubscribe).toHaveBeenCalledOnce();
    expect(output.videoUrl).toBe(MOCK_VIDEO_URL);
    expect(output.moderationStatus).toBe('approved');
  });

  it('should NOT call generateText for video-only generation', async () => {
    await routeGeneration({ ...BASE_REQUEST, category: 'video' });

    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('should NOT load character DNA for video-only category', async () => {
    await routeGeneration({ ...BASE_REQUEST, category: 'video' });

    expect(mockSupabaseSingle).not.toHaveBeenCalled();
  });

  it('should pass the specified videoModel to fal.subscribe', async () => {
    await routeGeneration({
      ...BASE_REQUEST,
      category: 'video',
      videoModel: 'fal-ai/veo3.1',
    });

    expect(mockFalSubscribe).toHaveBeenCalledWith(
      'fal-ai/veo3.1',
      expect.anything()
    );
  });

  it('should forward video onProgress status updates via the request onProgress', async () => {
    let capturedOnQueueUpdate: ((s: { status: string }) => void) | null = null;

    mockFalSubscribe.mockImplementationOnce(
      (_model: string, opts: { onQueueUpdate?: (s: { status: string }) => void }) => {
        capturedOnQueueUpdate = opts.onQueueUpdate ?? null;
        opts.onQueueUpdate?.({ status: 'IN_PROGRESS' });
        return Promise.resolve({
          video: { url: MOCK_VIDEO_URL, content_type: 'video/mp4' },
          request_id: 'req_progress',
        });
      }
    );

    const progressMessages: string[] = [];
    const onProgress = (_stage: string, message?: string): void => {
      if (message) progressMessages.push(message);
    };

    await routeGeneration({ ...BASE_REQUEST, category: 'video', onProgress });

    expect(capturedOnQueueUpdate).not.toBeNull();
    expect(progressMessages.some((m) => m.includes('IN_PROGRESS'))).toBe(true);
  });

  it('should propagate REJECTED moderation for video', async () => {
    mockModerateContent.mockResolvedValueOnce(REJECTED_MODERATION);

    const output = await routeGeneration({ ...BASE_REQUEST, category: 'video' });

    expect(output.moderationStatus).toBe('rejected');
  });
});

// ---------------------------------------------------------------------------
// Tests: video-text (parallel)
// ---------------------------------------------------------------------------

describe("routeGeneration category: 'video-text'", () => {
  beforeEach(() => {
    mockFalSubscribe.mockResolvedValue({
      video: { url: MOCK_VIDEO_URL, content_type: 'video/mp4' },
      request_id: 'req_vid_text_001',
    });
  });

  it('should call both generateText and fal.subscribe and return both outputs', async () => {
    const output = await routeGeneration({ ...BASE_REQUEST, category: 'video-text' });

    expect(mockGenerateText).toHaveBeenCalledOnce();
    expect(mockFalSubscribe).toHaveBeenCalledOnce();
    expect(output.text).toBe(MOCK_TEXT_OUTPUT);
    expect(output.videoUrl).toBe(MOCK_VIDEO_URL);
  });

  it('should run moderation twice (text + video) for video-text', async () => {
    await routeGeneration({ ...BASE_REQUEST, category: 'video-text' });

    expect(mockModerateContent).toHaveBeenCalledTimes(2);
  });

  it('should load character DNA from Supabase for video-text', async () => {
    await routeGeneration({ ...BASE_REQUEST, category: 'video-text' });

    expect(mockSupabaseSingle).toHaveBeenCalledOnce();
  });

  it('should use the worst moderation outcome across text and video', async () => {
    mockModerateContent
      .mockResolvedValueOnce(FLAGGED_MODERATION)   // text
      .mockResolvedValueOnce(REJECTED_MODERATION); // video

    const output = await routeGeneration({ ...BASE_REQUEST, category: 'video-text' });

    expect(output.moderationStatus).toBe('rejected');
  });
});

// ---------------------------------------------------------------------------
// Tests: error handling
// ---------------------------------------------------------------------------

describe('routeGeneration: error handling', () => {
  it('should throw ModelRouterError when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(
      routeGeneration({ ...BASE_REQUEST, category: 'text' })
    ).rejects.toThrow(ModelRouterError);
  });

  it('should wrap generateText failures in ModelRouterError', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('Anthropic API timeout'));

    await expect(
      routeGeneration({ ...BASE_REQUEST, category: 'text' })
    ).rejects.toThrow(ModelRouterError);
  });

  it('should wrap fal.subscribe failures in ModelRouterError for image', async () => {
    mockFalSubscribe.mockRejectedValueOnce(new Error('fal.ai queue full'));

    await expect(
      routeGeneration({ ...BASE_REQUEST, category: 'image' })
    ).rejects.toThrow(ModelRouterError);
  });

  it('should re-throw ModelRouterError without wrapping it again', async () => {
    mockSupabaseSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB connection refused' },
    });

    const err = await routeGeneration({ ...BASE_REQUEST, category: 'text' })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ModelRouterError);
    // Should NOT be double-wrapped
    if (err instanceof ModelRouterError) {
      expect(err.cause).not.toBeInstanceOf(ModelRouterError);
    }
  });
});
