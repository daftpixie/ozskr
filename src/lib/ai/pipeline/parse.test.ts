/**
 * Pipeline Stage 1: Parse & Validate Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GenerationType } from '@/types/database';

// Hoisted mock references
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

// Module mock
vi.mock('@/lib/api/supabase', () => ({
  createAuthenticatedClient: vi.fn(() => ({
    from: mockFrom,
    rpc: vi.fn(),
  })),
  createSupabaseClient: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}));

import { parseAndValidate, ValidationError } from './parse';
import type { PipelineInput } from './types';
import { createMockProgressCallback } from '@/test/mocks/ai';

describe('Pipeline Stage 1: Parse & Validate', () => {
  const { callback: onProgress, calls: progressCalls } = createMockProgressCallback();

  beforeEach(() => {
    progressCalls.length = 0;

    // Default: generation record exists with matching character_id
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          character_id: '550e8400-e29b-41d4-a716-446655440000',
        },
        error: null,
      }),
    }));
  });

  const validInput: PipelineInput = {
    generationId: '123e4567-e89b-12d3-a456-426614174000',
    characterId: '550e8400-e29b-41d4-a716-446655440000',
    generationType: GenerationType.TEXT,
    inputPrompt: 'Create a tweet about Solana',
    modelParams: { temperature: 0.8 },
    jwtToken: 'mock-jwt-token',
  };

  it('should validate and return ValidatedInput for valid input', async () => {
    const result = await parseAndValidate(validInput, onProgress);

    expect(result).toEqual({
      ...validInput,
      _validated: true,
    });

    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls[0]).toEqual({
      stage: 'parsing',
      message: 'Validating input parameters',
    });
  });

  it('should reject invalid UUID for generationId', async () => {
    const invalidInput: PipelineInput = {
      ...validInput,
      generationId: 'not-a-uuid',
    };

    await expect(parseAndValidate(invalidInput, onProgress)).rejects.toThrow(
      ValidationError
    );
  });

  it('should reject invalid generation type', async () => {
    const invalidInput: PipelineInput = {
      ...validInput,
      generationType: 'invalid' as never,
    };

    await expect(parseAndValidate(invalidInput, onProgress)).rejects.toThrow(
      ValidationError
    );
  });

  it('should reject prompt exceeding 5000 characters', async () => {
    const invalidInput: PipelineInput = {
      ...validInput,
      inputPrompt: 'a'.repeat(5001),
    };

    await expect(parseAndValidate(invalidInput, onProgress)).rejects.toThrow(
      ValidationError
    );
  });

  it('should reject empty prompt', async () => {
    const invalidInput: PipelineInput = {
      ...validInput,
      inputPrompt: '',
    };

    await expect(parseAndValidate(invalidInput, onProgress)).rejects.toThrow(
      ValidationError
    );
  });

  it('should return error when generation record not found', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      }),
    }));

    await expect(parseAndValidate(validInput, onProgress)).rejects.toThrow(
      ValidationError
    );
  });

  it('should emit progress events during validation', async () => {
    await parseAndValidate(validInput, onProgress);

    expect(progressCalls.length).toBeGreaterThanOrEqual(3);
    expect(progressCalls.some((p) => p.stage === 'parsing')).toBe(true);
    expect(progressCalls.some((p) => p.message.includes('Verifying generation record'))).toBe(true);
    expect(progressCalls.some((p) => p.message.includes('complete'))).toBe(true);
  });
});
