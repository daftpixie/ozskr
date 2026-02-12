/**
 * Pipeline Stage 3: Enhance Prompt
 * Uses Claude to enhance the input prompt with character context
 */

import { generateText } from 'ai';
import type { CharacterContext } from './context';
import type { ProgressCallback, TokenUsage } from './types';
import { getPrimaryModel } from '@/lib/ai/mastra';
import { traceClaudeCall, createTrace } from '@/lib/ai/telemetry';

/**
 * Error thrown during prompt enhancement
 */
export class PromptEnhanceError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'PromptEnhanceError';
  }
}

/**
 * Result from prompt enhancement
 */
export interface EnhanceResult {
  enhancedPrompt: string;
  tokenUsage: TokenUsage;
  cacheHit: boolean;
}

/**
 * Enhance input prompt using character context
 *
 * Uses Claude with the character's system prompt (cached) to rewrite
 * the user's input prompt in the character's voice and style.
 *
 * @param inputPrompt - Original user prompt
 * @param context - Character context with DNA and memories
 * @param onProgress - Progress callback
 * @returns Enhanced prompt with token usage
 * @throws PromptEnhanceError if enhancement fails
 */
export const enhancePrompt = async (
  inputPrompt: string,
  context: CharacterContext,
  onProgress: ProgressCallback
): Promise<EnhanceResult> => {
  onProgress({
    stage: 'enhancing',
    message: 'Enhancing prompt with character voice',
    metadata: { characterName: context.dna.name },
  });

  try {
    const model = getPrimaryModel();
    const trace = createTrace('prompt-enhancement', {
      characterId: context.dna.id,
      characterName: context.dna.name,
    });

    const result = await traceClaudeCall(
      trace,
      'enhance-prompt',
      async () => {
        return await generateText({
          model,
          system: context.dna.systemPrompt,
          prompt: `Enhance this prompt to match your character's voice and style. Keep the core intent but make it authentic to your persona.

<user_input>
${inputPrompt}
</user_input>

Enhanced prompt:`,
          maxTokens: 1024,
          temperature: 0.3,
        } as never);
      }
    );

    const enhancedPrompt = result.text.trim();

    // AI SDK generateText() returns usage with promptTokens/completionTokens
    const usage = result.usage as { promptTokens?: number; completionTokens?: number };
    const tokenUsage: TokenUsage = {
      input: usage.promptTokens || 0,
      output: usage.completionTokens || 0,
      cached: 0, // AI SDK doesn't expose cache stats directly
    };

    // Heuristic: if prompt tokens are low despite long system prompt, likely cached
    const cacheHit = (usage.promptTokens || 0) < 500;

    onProgress({
      stage: 'enhancing',
      message: 'Prompt enhancement complete',
      metadata: {
        originalLength: inputPrompt.length,
        enhancedLength: enhancedPrompt.length,
        tokenUsage,
        cacheHit,
      },
    });

    return {
      enhancedPrompt,
      tokenUsage,
      cacheHit,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new PromptEnhanceError(`Failed to enhance prompt: ${message}`);
  }
};
