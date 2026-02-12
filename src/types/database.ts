/**
 * Database Types for ozskr.ai
 * Auto-generated type definitions matching the Supabase schema
 */

// =============================================================================
// ENUMS
// =============================================================================

export enum CharacterStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

export enum RunType {
  CONTENT_GENERATION = 'content_generation',
  ENGAGEMENT = 'engagement',
  ANALYSIS = 'analysis',
  TRADING = 'trading',
}

export enum RunStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ContentType {
  TWEET = 'tweet',
  THREAD = 'thread',
  IMAGE = 'image',
  VIDEO = 'video',
  MEME = 'meme',
}

export enum ModerationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FLAGGED = 'flagged',
}

// =============================================================================
// TABLE TYPES
// =============================================================================

export interface User {
  wallet_address: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  wallet_address: string;
  jwt_token: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface Character {
  id: string;
  wallet_address: string;
  name: string;
  persona: string;
  visual_style: string;
  voice_tone: string;
  guardrails: string[];
  topic_affinity: string[];
  mem0_namespace: string;
  status: CharacterStatus;
  created_at: string;
  updated_at: string;
}

export interface AgentRun {
  id: string;
  character_id: string;
  run_type: RunType;
  status: RunStatus;
  started_at: string | null;
  completed_at: string | null;
  result_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Content {
  id: string;
  character_id: string;
  content_type: ContentType;
  prompt_used: string;
  output_text: string | null;
  output_url: string | null;
  quality_score: number | null;
  moderation_status: ModerationStatus;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// INSERT TYPES (Optional fields for creation)
// =============================================================================

export type UserInsert = Pick<User, 'wallet_address'> &
  Partial<Pick<User, 'display_name' | 'avatar_url'>>;

export type SessionInsert = Pick<Session, 'wallet_address' | 'jwt_token' | 'expires_at'>;

export type CharacterInsert = Pick<
  Character,
  'wallet_address' | 'name' | 'persona' | 'visual_style' | 'voice_tone' | 'mem0_namespace'
> &
  Partial<Pick<Character, 'guardrails' | 'topic_affinity' | 'status'>>;

export type AgentRunInsert = Pick<AgentRun, 'character_id' | 'run_type'> &
  Partial<Pick<AgentRun, 'status' | 'started_at' | 'result_metadata'>>;

export type ContentInsert = Pick<Content, 'character_id' | 'content_type' | 'prompt_used'> &
  Partial<
    Pick<Content, 'output_text' | 'output_url' | 'quality_score' | 'moderation_status'>
  >;

// =============================================================================
// UPDATE TYPES (All fields optional)
// =============================================================================

export type UserUpdate = Partial<Pick<User, 'display_name' | 'avatar_url'>>;

export type CharacterUpdate = Partial<
  Pick<
    Character,
    'name' | 'persona' | 'visual_style' | 'voice_tone' | 'guardrails' | 'topic_affinity' | 'status'
  >
>;

export type AgentRunUpdate = Partial<
  Pick<AgentRun, 'status' | 'started_at' | 'completed_at' | 'result_metadata'>
>;

export type ContentUpdate = Partial<
  Pick<Content, 'output_text' | 'output_url' | 'quality_score' | 'moderation_status'>
>;

// =============================================================================
// DATABASE TYPE (Supabase-compatible)
// =============================================================================

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: UserInsert;
        Update: UserUpdate;
      };
      sessions: {
        Row: Session;
        Insert: SessionInsert;
        Update: never; // Sessions are immutable
      };
      characters: {
        Row: Character;
        Insert: CharacterInsert;
        Update: CharacterUpdate;
      };
      agent_runs: {
        Row: AgentRun;
        Insert: AgentRunInsert;
        Update: AgentRunUpdate;
      };
      content: {
        Row: Content;
        Insert: ContentInsert;
        Update: ContentUpdate;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      character_status: CharacterStatus;
      run_type: RunType;
      run_status: RunStatus;
      content_type: ContentType;
      moderation_status: ModerationStatus;
    };
  };
}
