/**
 * Twitter Token Store Tests
 * Tests encrypted token storage, retrieval, and auto-refresh
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoisted mocks
const { mockFrom, mockRpc, mockRefreshAccessToken } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockRefreshAccessToken: vi.fn(),
}));

vi.mock('@/lib/api/supabase', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock('./oauth', () => ({
  refreshAccessToken: mockRefreshAccessToken,
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { storeTokens, getAccessToken, deleteTokens, TokenStoreError } from './token-store';

describe('twitter/token-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.TWITTER_TOKEN_ENCRYPTION_KEY = 'a'.repeat(32);
    process.env.TWITTER_CLIENT_ID = 'test-client-id';
  });

  describe('storeTokens', () => {
    it('should encrypt and upsert tokens', async () => {
      // Mock encrypt RPC
      mockRpc.mockResolvedValue({ data: 'encrypted-value', error: null });

      // Mock upsert
      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ upsert: upsertMock });

      await storeTokens(
        'social-account-1',
        {
          token_type: 'bearer',
          access_token: 'access-123',
          refresh_token: 'refresh-456',
          expires_in: 7200,
          scope: 'tweet.read tweet.write',
        },
        'twitter-user-1'
      );

      // Should call encrypt RPC twice (access + refresh)
      expect(mockRpc).toHaveBeenCalledTimes(2);
      expect(mockRpc).toHaveBeenCalledWith('pgp_sym_encrypt_text', {
        plaintext_value: 'access-123',
        encryption_key: 'a'.repeat(32),
      });
      expect(mockRpc).toHaveBeenCalledWith('pgp_sym_encrypt_text', {
        plaintext_value: 'refresh-456',
        encryption_key: 'a'.repeat(32),
      });

      // Should upsert into twitter_tokens
      expect(mockFrom).toHaveBeenCalledWith('twitter_tokens');
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          social_account_id: 'social-account-1',
          access_token_encrypted: 'encrypted-value',
          refresh_token_encrypted: 'encrypted-value',
          twitter_user_id: 'twitter-user-1',
        }),
        { onConflict: 'social_account_id' }
      );
    });

    it('should throw TokenStoreError on upsert failure', async () => {
      mockRpc.mockResolvedValue({ data: 'encrypted', error: null });
      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: { message: 'constraint violation' } }),
      });

      await expect(
        storeTokens(
          'social-account-1',
          {
            token_type: 'bearer',
            access_token: 'access',
            refresh_token: 'refresh',
            expires_in: 7200,
            scope: 'tweet.read',
          },
          'twitter-user-1'
        )
      ).rejects.toThrow(TokenStoreError);
    });

    it('should throw when encryption key is missing', async () => {
      delete process.env.TWITTER_TOKEN_ENCRYPTION_KEY;

      await expect(
        storeTokens(
          'social-account-1',
          {
            token_type: 'bearer',
            access_token: 'access',
            expires_in: 7200,
            scope: 'tweet.read',
          },
          'twitter-user-1'
        )
      ).rejects.toThrow(TokenStoreError);
    });
  });

  describe('getAccessToken', () => {
    it('should return decrypted token when not expired', async () => {
      // Mock select for token retrieval
      const futureExpiry = new Date(Date.now() + 3600_000).toISOString();
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            social_account_id: 'social-account-1',
            access_token_encrypted: 'enc-access',
            refresh_token_encrypted: 'enc-refresh',
            expires_at: futureExpiry,
            twitter_user_id: 'tw-user-1',
            updated_at: new Date().toISOString(),
          },
          error: null,
        }),
      });

      // Mock decrypt RPC
      mockRpc.mockResolvedValue({ data: 'decrypted-access-token', error: null });

      const token = await getAccessToken('social-account-1');

      expect(token).toBe('decrypted-access-token');
      expect(mockRpc).toHaveBeenCalledWith('pgp_sym_decrypt_text', {
        encrypted_value: 'enc-access',
        encryption_key: 'a'.repeat(32),
      });
    });

    it('should auto-refresh when token is expired', async () => {
      const pastExpiry = new Date(Date.now() - 60_000).toISOString();

      // First call: select returns expired token
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            social_account_id: 'social-account-1',
            access_token_encrypted: 'enc-old-access',
            refresh_token_encrypted: 'enc-refresh',
            expires_at: pastExpiry,
            twitter_user_id: 'tw-user-1',
            updated_at: new Date().toISOString(),
          },
          error: null,
        }),
      });

      // Decrypt call for refresh token
      mockRpc
        .mockResolvedValueOnce({ data: 'old-refresh-token', error: null }) // decrypt refresh
        .mockResolvedValueOnce({ data: 'enc-new-access', error: null })   // encrypt new access
        .mockResolvedValueOnce({ data: 'enc-new-refresh', error: null }); // encrypt new refresh

      // Mock refresh
      mockRefreshAccessToken.mockResolvedValue({
        token_type: 'bearer',
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 7200,
        scope: 'tweet.read tweet.write',
      });

      // Second call: upsert for storing new tokens
      mockFrom.mockReturnValueOnce({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      const token = await getAccessToken('social-account-1');

      expect(token).toBe('new-access-token');
      expect(mockRefreshAccessToken).toHaveBeenCalledWith(
        'old-refresh-token',
        'test-client-id'
      );
    });

    it('should throw when no tokens exist', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      });

      await expect(getAccessToken('nonexistent')).rejects.toThrow(TokenStoreError);
    });
  });

  describe('deleteTokens', () => {
    it('should delete tokens for a social account', async () => {
      // First call: select for revocation lookup
      const selectEqMock = vi.fn().mockReturnThis();
      const singleMock = vi.fn().mockResolvedValue({
        data: { access_token_encrypted: 'enc-access' },
        error: null,
      });
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({ eq: selectEqMock }),
      });
      selectEqMock.mockReturnValue({ single: singleMock });

      // Mock decrypt for revocation
      mockRpc.mockResolvedValueOnce({ data: 'decrypted-token', error: null });

      // Mock global fetch for revocation call
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

      // Second call: delete
      const deleteMock = vi.fn();
      const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
      deleteMock.mockReturnValue({ eq: deleteEqMock });
      mockFrom.mockReturnValueOnce({ delete: deleteMock });

      process.env.TWITTER_CLIENT_ID = 'test-client-id';

      await deleteTokens('social-account-1');

      expect(mockFrom).toHaveBeenCalledWith('twitter_tokens');
      global.fetch = originalFetch;
    });

    it('should throw on delete failure', async () => {
      // First call: select for revocation (returns nothing)
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      // Second call: delete fails
      const deleteMock = vi.fn();
      const eqMock = vi.fn().mockResolvedValue({ error: { message: 'db error' } });
      deleteMock.mockReturnValue({ eq: eqMock });
      mockFrom.mockReturnValueOnce({ delete: deleteMock });

      process.env.TWITTER_CLIENT_ID = 'test-client-id';

      await expect(deleteTokens('social-account-1')).rejects.toThrow(TokenStoreError);
    });
  });
});
