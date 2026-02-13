/**
 * Twitter OAuth 2.0 PKCE Tests
 * Tests authorization URL generation, code exchange, and token refresh
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  generateAuthUrl,
  exchangeCode,
  refreshAccessToken,
  fetchTwitterUser,
  TwitterOAuthError,
} from './oauth';

describe('twitter/oauth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateAuthUrl', () => {
    it('should generate valid authorization URL with PKCE', async () => {
      const result = await generateAuthUrl('client-123', 'http://localhost:3000/callback');

      expect(result.authorizeUrl).toContain('https://twitter.com/i/oauth2/authorize');
      expect(result.authorizeUrl).toContain('client_id=client-123');
      expect(result.authorizeUrl).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback');
      expect(result.authorizeUrl).toContain('response_type=code');
      expect(result.authorizeUrl).toContain('code_challenge_method=S256');
      expect(result.authorizeUrl).toContain('code_challenge=');
      expect(result.authorizeUrl).toContain('scope=');
    });

    it('should include required scopes', async () => {
      const result = await generateAuthUrl('client-123', 'http://localhost:3000/callback');

      expect(result.authorizeUrl).toContain('tweet.read');
      expect(result.authorizeUrl).toContain('tweet.write');
      expect(result.authorizeUrl).toContain('users.read');
      expect(result.authorizeUrl).toContain('offline.access');
    });

    it('should generate unique state tokens', async () => {
      const result1 = await generateAuthUrl('client-123', 'http://localhost:3000/callback');
      const result2 = await generateAuthUrl('client-123', 'http://localhost:3000/callback');

      expect(result1.state).not.toBe(result2.state);
    });

    it('should generate unique code verifiers', async () => {
      const result1 = await generateAuthUrl('client-123', 'http://localhost:3000/callback');
      const result2 = await generateAuthUrl('client-123', 'http://localhost:3000/callback');

      expect(result1.codeVerifier).not.toBe(result2.codeVerifier);
    });

    it('should return state and codeVerifier strings', async () => {
      const result = await generateAuthUrl('client-123', 'http://localhost:3000/callback');

      expect(typeof result.state).toBe('string');
      expect(result.state.length).toBeGreaterThan(0);
      expect(typeof result.codeVerifier).toBe('string');
      expect(result.codeVerifier.length).toBeGreaterThan(0);
    });
  });

  describe('exchangeCode', () => {
    it('should exchange auth code for tokens', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          token_type: 'bearer',
          access_token: 'access-token-123',
          refresh_token: 'refresh-token-456',
          expires_in: 7200,
          scope: 'tweet.read tweet.write users.read offline.access',
        }),
      });

      const result = await exchangeCode(
        'auth-code',
        'verifier-123',
        'client-123',
        'http://localhost:3000/callback'
      );

      expect(result.access_token).toBe('access-token-123');
      expect(result.refresh_token).toBe('refresh-token-456');
      expect(result.expires_in).toBe(7200);

      // Verify request
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.twitter.com/2/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );

      const body = mockFetch.mock.calls[0][1].body;
      expect(body).toContain('grant_type=authorization_code');
      expect(body).toContain('code=auth-code');
      expect(body).toContain('code_verifier=verifier-123');
      expect(body).toContain('client_id=client-123');
    });

    it('should throw TwitterOAuthError on API failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid code',
      });

      await expect(
        exchangeCode('bad-code', 'verifier', 'client', 'http://localhost:3000/callback')
      ).rejects.toThrow(TwitterOAuthError);
    });

    it('should throw TwitterOAuthError on invalid response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ invalid: 'response' }),
      });

      await expect(
        exchangeCode('code', 'verifier', 'client', 'http://localhost:3000/callback')
      ).rejects.toThrow(TwitterOAuthError);
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh token using refresh_token grant', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          token_type: 'bearer',
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 7200,
          scope: 'tweet.read tweet.write users.read offline.access',
        }),
      });

      const result = await refreshAccessToken('old-refresh-token', 'client-123');

      expect(result.access_token).toBe('new-access-token');
      expect(result.refresh_token).toBe('new-refresh-token');

      const body = mockFetch.mock.calls[0][1].body;
      expect(body).toContain('grant_type=refresh_token');
      expect(body).toContain('refresh_token=old-refresh-token');
      expect(body).toContain('client_id=client-123');
    });

    it('should throw on refresh failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Token expired',
      });

      await expect(
        refreshAccessToken('bad-token', 'client-123')
      ).rejects.toThrow(TwitterOAuthError);
    });
  });

  describe('fetchTwitterUser', () => {
    it('should fetch user profile', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: '12345',
            name: 'Test User',
            username: 'testuser',
          },
        }),
      });

      const user = await fetchTwitterUser('access-token-123');

      expect(user.id).toBe('12345');
      expect(user.username).toBe('testuser');
      expect(user.name).toBe('Test User');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.twitter.com/2/users/me',
        expect.objectContaining({
          headers: { Authorization: 'Bearer access-token-123' },
        })
      );
    });

    it('should throw on profile fetch failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(fetchTwitterUser('bad-token')).rejects.toThrow(TwitterOAuthError);
    });
  });
});
