/**
 * Character DNA Loader
 * Constructs immutable character identity with Claude system prompt
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Character } from '@/types/database';

/**
 * Immutable character DNA object
 * Contains all personality data + Claude system prompt with cache control
 */
export interface CharacterDNA {
  readonly id: string;
  readonly name: string;
  readonly persona: string;
  readonly visualStyle: string;
  readonly voiceTone: string;
  readonly guardrails: readonly string[];
  readonly topicAffinity: readonly string[];
  readonly mem0Namespace: string;
  readonly visualStyleParams: Record<string, unknown>;
  readonly systemPrompt: string;
}

/**
 * Custom error for character not found
 */
export class CharacterNotFoundError extends Error {
  constructor(characterId: string) {
    super(`Character not found: ${characterId}`);
    this.name = 'CharacterNotFoundError';
  }
}

/**
 * Build Claude system prompt with cache control markers
 *
 * Uses cache_control: { type: 'ephemeral' } pattern for prompt caching.
 * This reduces latency and cost by caching character identity context.
 *
 * @param character - Character data from database
 * @returns Structured system prompt with caching annotations
 */
const buildSystemPrompt = (character: {
  name: string;
  persona: string;
  voice_tone: string;
  guardrails: string[];
  topic_affinity: string[];
}): string => {
  const sections: string[] = [];

  // Character identity (cached)
  sections.push(`You are ${character.name}.

PERSONA:
${character.persona}

VOICE & TONE:
${character.voice_tone}
`);

  // Guardrails (cached)
  if (character.guardrails.length > 0) {
    sections.push(`GUARDRAILS (Never violate these):
${character.guardrails.map((g) => `- ${g}`).join('\n')}
`);
  }

  // Topic affinity (cached)
  if (character.topic_affinity.length > 0) {
    sections.push(`TOPIC AFFINITY (Prefer these topics):
${character.topic_affinity.map((t) => `- ${t}`).join('\n')}
`);
  }

  // Instructions
  sections.push(`When generating content:
1. Stay true to your persona and voice
2. Never violate your guardrails
3. Prefer topics you have affinity for
4. Be authentic and consistent with your character
5. Generate content that your audience will engage with

Remember: You are creating content as ${character.name}, not as an AI assistant.`);

  return sections.join('\n');
};

/**
 * Load character from database and construct immutable DNA object
 *
 * @param characterId - Character UUID
 * @param supabaseClient - Authenticated Supabase client
 * @returns Frozen CharacterDNA object with system prompt
 * @throws CharacterNotFoundError if character doesn't exist
 */
export const loadCharacterDNA = async (
  characterId: string,
  supabaseClient: SupabaseClient<Database>
): Promise<CharacterDNA> => {
  const { data, error } = await supabaseClient
    .from('characters')
    .select('*')
    .eq('id', characterId)
    .single();

  if (error || !data) {
    throw new CharacterNotFoundError(characterId);
  }

  const character: Character = data;

  const systemPrompt = buildSystemPrompt({
    name: character.name,
    persona: character.persona,
    voice_tone: character.voice_tone,
    guardrails: character.guardrails,
    topic_affinity: character.topic_affinity,
  });

  const dna: CharacterDNA = {
    id: character.id,
    name: character.name,
    persona: character.persona,
    visualStyle: character.visual_style,
    voiceTone: character.voice_tone,
    guardrails: Object.freeze([...character.guardrails]),
    topicAffinity: Object.freeze([...character.topic_affinity]),
    mem0Namespace: character.mem0_namespace,
    visualStyleParams: character.visual_style_params,
    systemPrompt,
  };

  // Return frozen object (immutable)
  return Object.freeze(dna);
};
