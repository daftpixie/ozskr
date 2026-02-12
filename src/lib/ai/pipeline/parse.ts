/**
 * Pipeline Stage 1: Parse & Validate
 * Validates input parameters and verifies generation record exists
 */

import { z } from 'zod';
import type {
  PipelineInput,
  ValidatedInput,
  ProgressCallback,
} from './types';
import { createAuthenticatedClient } from '@/lib/api/supabase';
import { UuidSchema, GenerationTypeSchema } from '@/types/schemas';

/**
 * Error thrown during validation stage
 */
export class ValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Input validation schema
 */
const PipelineInputSchema = z.object({
  generationId: UuidSchema,
  characterId: UuidSchema,
  generationType: GenerationTypeSchema,
  inputPrompt: z.string().min(1).max(5000),
  modelParams: z.record(z.string(), z.unknown()).optional(),
  jwtToken: z.string().min(1),
});

/**
 * Parse and validate pipeline input
 * Verifies the generation record exists in the database
 *
 * @param input - Raw pipeline input
 * @param onProgress - Progress callback
 * @returns Validated input
 * @throws ValidationError if validation fails
 */
export const parseAndValidate = async (
  input: PipelineInput,
  onProgress: ProgressCallback
): Promise<ValidatedInput> => {
  onProgress({
    stage: 'parsing',
    message: 'Validating input parameters',
  });

  // Validate input schema
  const validationResult = PipelineInputSchema.safeParse(input);
  if (!validationResult.success) {
    throw new ValidationError(
      'Invalid pipeline input',
      validationResult.error.format()
    );
  }

  const validInput = validationResult.data;

  // Verify generation record exists
  onProgress({
    stage: 'parsing',
    message: 'Verifying generation record',
    metadata: { generationId: validInput.generationId },
  });

  try {
    const supabase = createAuthenticatedClient(validInput.jwtToken);

    const { data: generation, error } = await supabase
      .from('content_generations')
      .select('id, character_id')
      .eq('id', validInput.generationId)
      .single();

    if (error || !generation) {
      throw new ValidationError(
        `Generation record not found: ${validInput.generationId}`
      );
    }

    if (generation.character_id !== validInput.characterId) {
      throw new ValidationError(
        'Character ID mismatch between input and generation record'
      );
    }

    onProgress({
      stage: 'parsing',
      message: 'Input validation complete',
    });

    return {
      ...validInput,
      _validated: true,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new ValidationError(`Database verification failed: ${message}`);
  }
};
