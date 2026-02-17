import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Address } from '@solana/kit';
import { TurnkeyKeyManager } from '../src/key-management/turnkey.js';

// Mock the Turnkey SDK
const mockSignRawPayload = vi.fn();
const mockGetWhoami = vi.fn();
const mockApiClient = vi.fn(() => ({
  signRawPayload: mockSignRawPayload,
  getWhoami: mockGetWhoami,
}));

vi.mock('@turnkey/sdk-server', () => ({
  Turnkey: vi.fn(function (this: Record<string, unknown>) {
    this.apiClient = mockApiClient;
    return this;
  }),
}));

describe('TurnkeyKeyManager', () => {
  const validOptions = {
    organizationId: 'org-test-123',
    apiPublicKey: 'pk-test-abc',
    apiPrivateKey: 'sk-test-xyz',
    signWith: 'So11111111111111111111111111111111111111112',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with valid options', () => {
      const km = new TurnkeyKeyManager(validOptions);
      expect(km).toBeDefined();
    });

    it('should throw if organizationId is missing', () => {
      expect(() => new TurnkeyKeyManager({
        ...validOptions,
        organizationId: '',
      })).toThrow('requires organizationId');
    });

    it('should throw if apiPublicKey is missing', () => {
      expect(() => new TurnkeyKeyManager({
        ...validOptions,
        apiPublicKey: '',
      })).toThrow('requires apiPublicKey');
    });

    it('should throw if apiPrivateKey is missing', () => {
      expect(() => new TurnkeyKeyManager({
        ...validOptions,
        apiPrivateKey: '',
      })).toThrow('requires apiPrivateKey');
    });

    it('should throw if signWith is missing', () => {
      expect(() => new TurnkeyKeyManager({
        ...validOptions,
        signWith: '',
      })).toThrow('requires signWith');
    });

    it('should use default base URL when not provided', () => {
      const km = new TurnkeyKeyManager(validOptions);
      expect(km).toBeDefined();
      // Turnkey constructor would be called with default base URL
    });

    it('should use custom base URL when provided', () => {
      const km = new TurnkeyKeyManager({
        ...validOptions,
        baseUrl: 'https://custom.turnkey.com',
      });
      expect(km).toBeDefined();
    });
  });

  describe('getPublicKey', () => {
    it('should return the configured signWith address', async () => {
      const km = new TurnkeyKeyManager(validOptions);
      const pubkey = await km.getPublicKey();
      expect(pubkey).toBe(validOptions.signWith);
    });
  });

  describe('signTransaction', () => {
    it('should call signRawPayload with hex-encoded payload', async () => {
      const km = new TurnkeyKeyManager(validOptions);
      const testMessage = new Uint8Array([1, 2, 3, 4, 5]);

      // Mock Turnkey response: R and S as 32-byte hex strings
      mockSignRawPayload.mockResolvedValueOnce({
        r: 'a'.repeat(64), // 32 bytes as hex
        s: 'b'.repeat(64), // 32 bytes as hex
      });

      const signature = await km.signTransaction(testMessage);

      expect(mockSignRawPayload).toHaveBeenCalledWith({
        signWith: validOptions.signWith,
        payload: '0102030405',
        encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
        hashFunction: 'HASH_FUNCTION_NOT_APPLICABLE',
      });

      // Should be 64 bytes (R + S concatenated)
      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBe(64);
    });

    it('should correctly concatenate R and S into 64-byte signature', async () => {
      const km = new TurnkeyKeyManager(validOptions);

      // Known R and S values
      const r = '01'.repeat(32); // 32 bytes of 0x01
      const s = '02'.repeat(32); // 32 bytes of 0x02

      mockSignRawPayload.mockResolvedValueOnce({ r, s });

      const signature = await km.signTransaction(new Uint8Array(32));

      // First 32 bytes should be 0x01, last 32 should be 0x02
      expect(signature.slice(0, 32)).toEqual(new Uint8Array(32).fill(1));
      expect(signature.slice(32, 64)).toEqual(new Uint8Array(32).fill(2));
    });

    it('should pad short R and S values with leading zeros', async () => {
      const km = new TurnkeyKeyManager(validOptions);

      // Short R value (less than 64 hex chars)
      mockSignRawPayload.mockResolvedValueOnce({
        r: 'ff'.repeat(30), // Only 30 bytes — needs padding
        s: 'ee'.repeat(32), // Full 32 bytes
      });

      const signature = await km.signTransaction(new Uint8Array(32));
      expect(signature.length).toBe(64);

      // First 2 bytes should be 0x00 (padding), then 30 bytes of 0xff
      expect(signature[0]).toBe(0);
      expect(signature[1]).toBe(0);
      expect(signature[2]).toBe(0xff);
    });

    it('should handle 0x-prefixed hex in R and S', async () => {
      const km = new TurnkeyKeyManager(validOptions);

      mockSignRawPayload.mockResolvedValueOnce({
        r: '0x' + 'ab'.repeat(32),
        s: '0x' + 'cd'.repeat(32),
      });

      const signature = await km.signTransaction(new Uint8Array(32));
      expect(signature.length).toBe(64);
      expect(signature[0]).toBe(0xab);
      expect(signature[32]).toBe(0xcd);
    });

    it('should throw if R is empty', async () => {
      const km = new TurnkeyKeyManager(validOptions);

      mockSignRawPayload.mockResolvedValueOnce({ r: '', s: 'ab'.repeat(32) });

      await expect(km.signTransaction(new Uint8Array(32)))
        .rejects.toThrow('empty r or s');
    });

    it('should throw if S is empty', async () => {
      const km = new TurnkeyKeyManager(validOptions);

      mockSignRawPayload.mockResolvedValueOnce({ r: 'ab'.repeat(32), s: '' });

      await expect(km.signTransaction(new Uint8Array(32)))
        .rejects.toThrow('empty r or s');
    });

    it('should propagate Turnkey API errors', async () => {
      const km = new TurnkeyKeyManager(validOptions);

      mockSignRawPayload.mockRejectedValueOnce(new Error('Turnkey API error'));

      await expect(km.signTransaction(new Uint8Array(32)))
        .rejects.toThrow('Turnkey API error');
    });
  });

  describe('signMessage', () => {
    it('should use the same signing logic as signTransaction', async () => {
      const km = new TurnkeyKeyManager(validOptions);
      const message = new TextEncoder().encode('Hello, world!');

      mockSignRawPayload.mockResolvedValueOnce({
        r: 'aa'.repeat(32),
        s: 'bb'.repeat(32),
      });

      const signature = await km.signMessage(message);

      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBe(64);
      expect(mockSignRawPayload).toHaveBeenCalledOnce();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when Turnkey API responds', async () => {
      const km = new TurnkeyKeyManager(validOptions);

      mockGetWhoami.mockResolvedValueOnce({ organizationId: validOptions.organizationId });

      const health = await km.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.provider).toBe('turnkey');
    });

    it('should return unhealthy when Turnkey API fails', async () => {
      const km = new TurnkeyKeyManager(validOptions);

      mockGetWhoami.mockRejectedValueOnce(new Error('Connection refused'));

      const health = await km.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.provider).toBe('turnkey');
    });

    it('should pass organizationId to getWhoami', async () => {
      const km = new TurnkeyKeyManager(validOptions);

      mockGetWhoami.mockResolvedValueOnce({});

      await km.healthCheck();

      expect(mockGetWhoami).toHaveBeenCalledWith({
        organizationId: validOptions.organizationId,
      });
    });
  });
});
