/**
 * Twitter Token Store
 * Encrypted OAuth token storage in Supabase using pgcrypto
 *
 * Tokens are AES-256 encrypted at rest using a server-side encryption key.
 * The encryption key MUST come from TWITTER_TOKEN_ENCRYPTION_KEY env var
 * (or Infisical). It is never exposed to the client.
 *
 * Supports automatic token refresh when access tokens expire.
 */

import { createSupabaseServerClient } from '@/lib/api/supabase';
import { refreshAccessToken, type TokenResponse } from './oauth';
import { logger } from '@/lib/utils/logger';

/**
 * Stored token record shape (from twitter_tokens table)
 */
export interface StoredToken {
  social_account_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  expires_at: string;
  twitter_user_id: string;
  updated_at: string;
}

export class TokenStoreError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'TokenStoreError';
  }
}

/**
 * Get the encryption key from environment
 */
const getEncryptionKey = (): string => {
  const key = process.env.TWITTER_TOKEN_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new TokenStoreError(
      'TWITTER_TOKEN_ENCRYPTION_KEY must be set and at least 32 characters'
    );
  }
  return key;
};

/**
 * Get a Supabase server client for token operations
 */
const getSupabase = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new TokenStoreError('SUPABASE_SERVICE_ROLE_KEY is required for token storage');
  }
  return createSupabaseServerClient(serviceRoleKey);
};

/**
 * Encrypt a plaintext value using pgcrypto's pgp_sym_encrypt via RPC
 */
const encrypt = async (
  supabase: ReturnType<typeof getSupabase>,
  plaintext: string
): Promise<string> => {
  const key = getEncryptionKey();
  const { data, error } = await supabase.rpc('pgp_sym_encrypt_text', {
    plaintext_value: plaintext,
    encryption_key: key,
  });
  if (error) {
    throw new TokenStoreError('Failed to encrypt token', error);
  }
  return data as string;
};

/**
 * Decrypt an encrypted value using pgcrypto's pgp_sym_decrypt via RPC
 */
const decrypt = async (
  supabase: ReturnType<typeof getSupabase>,
  ciphertext: string
): Promise<string> => {
  const key = getEncryptionKey();
  const { data, error } = await supabase.rpc('pgp_sym_decrypt_text', {
    encrypted_value: ciphertext,
    encryption_key: key,
  });
  if (error) {
    throw new TokenStoreError('Failed to decrypt token', error);
  }
  return data as string;
};

/**
 * Store OAuth tokens for a social account
 *
 * @param socialAccountId - ID of the social_accounts row
 * @param tokens - Token response from OAuth flow
 * @param twitterUserId - Twitter user ID
 */
export const storeTokens = async (
  socialAccountId: string,
  tokens: TokenResponse,
  twitterUserId: string
): Promise<void> => {
  const supabase = getSupabase();

  const [accessEncrypted, refreshEncrypted] = await Promise.all([
    encrypt(supabase, tokens.access_token),
    tokens.refresh_token
      ? encrypt(supabase, tokens.refresh_token)
      : Promise.resolve(''),
  ]);

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error } = await supabase
    .from('twitter_tokens')
    .upsert(
      {
        social_account_id: socialAccountId,
        access_token_encrypted: accessEncrypted,
        refresh_token_encrypted: refreshEncrypted,
        expires_at: expiresAt,
        twitter_user_id: twitterUserId,
      },
      { onConflict: 'social_account_id' }
    );

  if (error) {
    throw new TokenStoreError('Failed to store tokens', error);
  }

  logger.info('Twitter tokens stored', { socialAccountId });
};

/**
 * Retrieve a valid access token for a social account.
 * Automatically refreshes if expired.
 *
 * @param socialAccountId - ID of the social_accounts row
 * @returns Decrypted access token ready for API calls
 */
export const getAccessToken = async (socialAccountId: string): Promise<string> => {
  const supabase = getSupabase();

  const { data: row, error } = await supabase
    .from('twitter_tokens')
    .select('*')
    .eq('social_account_id', socialAccountId)
    .single();

  if (error || !row) {
    throw new TokenStoreError(
      `No Twitter tokens found for social account ${socialAccountId}`,
      error
    );
  }

  const stored = row as StoredToken;
  const expiresAt = new Date(stored.expires_at);
  const now = new Date();

  // Refresh 60 seconds before actual expiry to avoid race conditions
  const bufferMs = 60_000;
  if (expiresAt.getTime() - bufferMs > now.getTime()) {
    // Token is still valid
    return decrypt(supabase, stored.access_token_encrypted);
  }

  // Token expired or about to expire — refresh it
  logger.info('Twitter token expired, refreshing', { socialAccountId });

  if (!stored.refresh_token_encrypted) {
    throw new TokenStoreError('No refresh token available — user must re-authorize');
  }

  const refreshTokenValue = await decrypt(supabase, stored.refresh_token_encrypted);
  const clientId = process.env.TWITTER_CLIENT_ID;
  if (!clientId) {
    throw new TokenStoreError('TWITTER_CLIENT_ID environment variable is required');
  }

  const newTokens = await refreshAccessToken(refreshTokenValue, clientId);

  // Store the new tokens (Twitter rotates refresh tokens on each refresh)
  await storeTokens(socialAccountId, newTokens, stored.twitter_user_id);

  return newTokens.access_token;
};

/**
 * Delete stored tokens when a user disconnects their Twitter account
 *
 * @param socialAccountId - ID of the social_accounts row
 */
export const deleteTokens = async (socialAccountId: string): Promise<void> => {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('twitter_tokens')
    .delete()
    .eq('social_account_id', socialAccountId);

  if (error) {
    throw new TokenStoreError('Failed to delete tokens', error);
  }

  logger.info('Twitter tokens deleted', { socialAccountId });
};
