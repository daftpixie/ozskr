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
  PROCESSING = 'processing',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FLAGGED = 'flagged',
}

export enum GenerationType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
}

export enum SwapStatus {
  PENDING = 'pending',
  SIMULATED = 'simulated',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

export enum ScheduleType {
  ONE_TIME = 'one_time',
  RECURRING = 'recurring',
}

export enum ScheduleContentType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
}

export enum SocialPlatform {
  TWITTER = 'twitter',
  INSTAGRAM = 'instagram',
  TIKTOK = 'tiktok',
  YOUTUBE = 'youtube',
}

export enum SocialPostStatus {
  QUEUED = 'queued',
  POSTED = 'posted',
  FAILED = 'failed',
  DELETED = 'deleted',
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
  visual_style_params: Record<string, unknown>;
  social_accounts: Record<string, unknown>;
  generation_count: number;
  last_generated_at: string | null;
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

export interface ContentGeneration {
  id: string;
  character_id: string;
  generation_type: GenerationType;
  input_prompt: string;
  enhanced_prompt: string | null;
  model_used: string;
  model_params: Record<string, unknown>;
  output_url: string | null;
  output_text: string | null;
  quality_score: number | null;
  moderation_status: ModerationStatus;
  moderation_details: Record<string, unknown> | null;
  token_usage: Record<string, unknown>;
  cost_usd: string | null;
  latency_ms: number | null;
  cache_hit: boolean;
  created_at: string;
}

export interface CharacterMemory {
  id: string;
  character_id: string;
  mem0_namespace: string;
  memory_count: number;
  last_synced_at: string | null;
  total_retrievals: number;
  created_at: string;
  updated_at: string;
}

export interface SwapHistory {
  id: string;
  wallet_address: string;
  input_mint: string;
  output_mint: string;
  input_amount: string;
  output_amount: string | null;
  slippage_bps: number;
  priority_fee_lamports: string;
  jupiter_order_id: string | null;
  transaction_signature: string | null;
  status: SwapStatus;
  error_message: string | null;
  simulation_result: Record<string, unknown> | null;
  created_at: string;
  confirmed_at: string | null;
}

export interface Watchlist {
  id: string;
  wallet_address: string;
  token_mint: string;
  token_symbol: string;
  token_name: string;
  added_at: string;
}

export interface TokenBalanceCache {
  wallet_address: string;
  token_mint: string;
  balance: string;
  decimals: number;
  usd_value: string | null;
  last_updated_at: string;
}

export interface ContentSchedule {
  id: string;
  character_id: string;
  schedule_type: ScheduleType;
  cron_expression: string | null;
  next_run_at: string;
  content_type: ScheduleContentType;
  prompt_template: string;
  is_active: boolean;
  auto_publish: boolean;
  last_run_at: string | null;
  run_count: number;
  created_at: string;
  updated_at: string;
}

export interface SocialAccount {
  id: string;
  wallet_address: string;
  platform: SocialPlatform;
  platform_account_id: string;
  platform_username: string;
  ayrshare_profile_key: string;
  is_connected: boolean;
  connected_at: string;
  last_posted_at: string | null;
  created_at: string;
}

export interface SocialPost {
  id: string;
  content_generation_id: string;
  social_account_id: string;
  platform: SocialPlatform;
  post_id: string | null;
  post_url: string | null;
  status: SocialPostStatus;
  posted_at: string | null;
  error_message: string | null;
  engagement_metrics: Record<string, unknown>;
  last_metrics_update: string | null;
  created_at: string;
}

export interface AnalyticsSnapshot {
  id: string;
  character_id: string;
  snapshot_date: string;
  total_generations: number;
  total_posts: number;
  total_engagement: Record<string, unknown>;
  avg_quality_score: number | null;
  top_performing_content_id: string | null;
  created_at: string;
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
  Partial<Pick<Character, 'guardrails' | 'topic_affinity' | 'status' | 'visual_style_params' | 'social_accounts'>>;

export type AgentRunInsert = Pick<AgentRun, 'character_id' | 'run_type'> &
  Partial<Pick<AgentRun, 'status' | 'started_at' | 'result_metadata'>>;

export type ContentInsert = Pick<Content, 'character_id' | 'content_type' | 'prompt_used'> &
  Partial<
    Pick<Content, 'output_text' | 'output_url' | 'quality_score' | 'moderation_status'>
  >;

export type ContentGenerationInsert = Pick<
  ContentGeneration,
  'character_id' | 'generation_type' | 'input_prompt' | 'model_used'
> &
  Partial<
    Pick<
      ContentGeneration,
      | 'enhanced_prompt'
      | 'model_params'
      | 'output_url'
      | 'output_text'
      | 'quality_score'
      | 'moderation_status'
      | 'moderation_details'
      | 'token_usage'
      | 'cost_usd'
      | 'latency_ms'
      | 'cache_hit'
    >
  >;

export type CharacterMemoryInsert = Pick<CharacterMemory, 'character_id' | 'mem0_namespace'> &
  Partial<Pick<CharacterMemory, 'memory_count' | 'last_synced_at' | 'total_retrievals'>>;

export type SwapHistoryInsert = Pick<
  SwapHistory,
  'wallet_address' | 'input_mint' | 'output_mint' | 'input_amount'
> &
  Partial<
    Pick<
      SwapHistory,
      | 'output_amount'
      | 'slippage_bps'
      | 'priority_fee_lamports'
      | 'jupiter_order_id'
      | 'transaction_signature'
      | 'status'
      | 'error_message'
      | 'simulation_result'
      | 'confirmed_at'
    >
  >;

export type WatchlistInsert = Pick<
  Watchlist,
  'wallet_address' | 'token_mint' | 'token_symbol' | 'token_name'
>;

export type TokenBalanceCacheInsert = Pick<
  TokenBalanceCache,
  'wallet_address' | 'token_mint' | 'balance' | 'decimals'
> &
  Partial<Pick<TokenBalanceCache, 'usd_value' | 'last_updated_at'>>;

export type ContentScheduleInsert = Pick<
  ContentSchedule,
  'character_id' | 'schedule_type' | 'next_run_at' | 'content_type' | 'prompt_template'
> &
  Partial<Pick<ContentSchedule, 'cron_expression' | 'is_active' | 'auto_publish' | 'last_run_at' | 'run_count'>>;

export type SocialAccountInsert = Pick<
  SocialAccount,
  'wallet_address' | 'platform' | 'platform_account_id' | 'platform_username' | 'ayrshare_profile_key'
> &
  Partial<Pick<SocialAccount, 'is_connected' | 'connected_at' | 'last_posted_at'>>;

export type SocialPostInsert = Pick<
  SocialPost,
  'content_generation_id' | 'social_account_id' | 'platform' | 'status'
> &
  Partial<
    Pick<
      SocialPost,
      'post_id' | 'post_url' | 'posted_at' | 'error_message' | 'engagement_metrics' | 'last_metrics_update'
    >
  >;

export type AnalyticsSnapshotInsert = Pick<
  AnalyticsSnapshot,
  'character_id' | 'snapshot_date'
> &
  Partial<
    Pick<
      AnalyticsSnapshot,
      | 'total_generations'
      | 'total_posts'
      | 'total_engagement'
      | 'avg_quality_score'
      | 'top_performing_content_id'
    >
  >;


// =============================================================================
// UPDATE TYPES (All fields optional)
// =============================================================================

export type UserUpdate = Partial<Pick<User, 'display_name' | 'avatar_url'>>;

export type CharacterUpdate = Partial<
  Pick<
    Character,
    'name' | 'persona' | 'visual_style' | 'voice_tone' | 'guardrails' | 'topic_affinity' | 'status' | 'visual_style_params' | 'social_accounts' | 'generation_count' | 'last_generated_at'
  >
>;

export type AgentRunUpdate = Partial<
  Pick<AgentRun, 'status' | 'started_at' | 'completed_at' | 'result_metadata'>
>;

export type ContentUpdate = Partial<
  Pick<Content, 'output_text' | 'output_url' | 'quality_score' | 'moderation_status'>
>;

export type ContentGenerationUpdate = Partial<
  Pick<
    ContentGeneration,
    | 'enhanced_prompt'
    | 'output_url'
    | 'output_text'
    | 'quality_score'
    | 'moderation_status'
    | 'moderation_details'
    | 'token_usage'
    | 'cost_usd'
    | 'latency_ms'
    | 'cache_hit'
  >
>;

export type CharacterMemoryUpdate = Partial<
  Pick<CharacterMemory, 'memory_count' | 'last_synced_at' | 'total_retrievals'>
>;

export type SwapHistoryUpdate = Partial<
  Pick<
    SwapHistory,
    | 'output_amount'
    | 'transaction_signature'
    | 'status'
    | 'error_message'
    | 'simulation_result'
    | 'confirmed_at'
  >
>;

export type TokenBalanceCacheUpdate = Partial<
  Pick<TokenBalanceCache, 'balance' | 'decimals' | 'usd_value' | 'last_updated_at'>
>;

export type ContentScheduleUpdate = Partial<
  Pick<
    ContentSchedule,
    | 'schedule_type'
    | 'cron_expression'
    | 'next_run_at'
    | 'content_type'
    | 'prompt_template'
    | 'is_active'
    | 'auto_publish'
    | 'last_run_at'
    | 'run_count'
  >
>;

export type SocialAccountUpdate = Partial<
  Pick<SocialAccount, 'is_connected' | 'last_posted_at'>
>;

export type SocialPostUpdate = Partial<
  Pick<
    SocialPost,
    | 'post_id'
    | 'post_url'
    | 'status'
    | 'posted_at'
    | 'error_message'
    | 'engagement_metrics'
    | 'last_metrics_update'
  >
>;

export type AnalyticsSnapshotUpdate = Partial<
  Pick<
    AnalyticsSnapshot,
    | 'total_generations'
    | 'total_posts'
    | 'total_engagement'
    | 'avg_quality_score'
    | 'top_performing_content_id'
  >
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
      content_generations: {
        Row: ContentGeneration;
        Insert: ContentGenerationInsert;
        Update: ContentGenerationUpdate;
      };
      character_memory: {
        Row: CharacterMemory;
        Insert: CharacterMemoryInsert;
        Update: CharacterMemoryUpdate;
      };
      swap_history: {
        Row: SwapHistory;
        Insert: SwapHistoryInsert;
        Update: SwapHistoryUpdate;
      };
      watchlist: {
        Row: Watchlist;
        Insert: WatchlistInsert;
        Update: never; // Watchlist items are immutable
      };
      token_balances_cache: {
        Row: TokenBalanceCache;
        Insert: TokenBalanceCacheInsert;
        Update: TokenBalanceCacheUpdate;
      };
      content_schedules: {
        Row: ContentSchedule;
        Insert: ContentScheduleInsert;
        Update: ContentScheduleUpdate;
      };
      social_accounts: {
        Row: SocialAccount;
        Insert: SocialAccountInsert;
        Update: SocialAccountUpdate;
      };
      social_posts: {
        Row: SocialPost;
        Insert: SocialPostInsert;
        Update: SocialPostUpdate;
      };
      analytics_snapshots: {
        Row: AnalyticsSnapshot;
        Insert: AnalyticsSnapshotInsert;
        Update: AnalyticsSnapshotUpdate;
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
      generation_type: GenerationType;
      swap_status: SwapStatus;
      schedule_type: ScheduleType;
      schedule_content_type: ScheduleContentType;
      social_platform: SocialPlatform;
      social_post_status: SocialPostStatus;
    };
  };
}
