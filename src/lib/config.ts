/**
 * Environment Configuration
 * Typed configuration with Zod validation
 * IMPORTANT: This is SERVER-ONLY - do not import from client components
 */

import { z } from 'zod';

const envSchema = z.object({
  // Solana
  NEXT_PUBLIC_HELIUS_RPC_URL: z.string().url(),
  NEXT_PUBLIC_SOLANA_NETWORK: z.enum(['devnet', 'mainnet-beta']).default('devnet'),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Auth
  JWT_SECRET: z.string().min(32),

  // AI Services
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-'),
  FAL_KEY: z.string().min(1),
  MEM0_API_KEY: z.string().min(1),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // Trigger.dev
  TRIGGER_API_KEY: z.string().min(1),
  TRIGGER_API_URL: z.string().url(),

  // Ayrshare
  AYRSHARE_API_KEY: z.string().min(1),

  // Langfuse
  LANGFUSE_SECRET_KEY: z.string().min(1),
  LANGFUSE_PUBLIC_KEY: z.string().min(1),
  LANGFUSE_BASEURL: z.string().url(),

  // Cloudflare R2
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Type inference from schema
export type Config = z.infer<typeof envSchema>;

// Lazy validation — only validates when accessed
// This prevents build-time failures when env vars aren't needed
let _config: Config | null = null;

/**
 * Get validated environment configuration
 * Validates on first access, then caches result
 * @throws Error if required environment variables are missing or invalid
 */
export function getConfig(): Config {
  if (!_config) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const missing = result.error.issues
        .map((i) => `  ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      throw new Error(`Missing or invalid environment variables:\n${missing}`);
    }
    _config = result.data;
  }
  return _config;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Get Solana network (devnet or mainnet-beta)
 */
export function getSolanaNetwork(): 'devnet' | 'mainnet-beta' {
  return (process.env.NEXT_PUBLIC_SOLANA_NETWORK as 'devnet' | 'mainnet-beta') || 'devnet';
}
