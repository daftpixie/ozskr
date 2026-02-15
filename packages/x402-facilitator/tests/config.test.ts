import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigSchema, loadConfigFromEnv, GovernanceSchema } from '../src/config.js';

describe('GovernanceSchema', () => {
  it('applies defaults when empty', () => {
    const result = GovernanceSchema.parse({});
    expect(result.rateLimitPerMinute).toBe(60);
    expect(result.maxSettlementAmount).toBeUndefined();
    expect(result.allowedTokens).toBeUndefined();
    expect(result.allowedRecipients).toBeUndefined();
  });

  it('accepts full governance config', () => {
    const result = GovernanceSchema.parse({
      maxSettlementAmount: '10000000',
      allowedTokens: ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'],
      allowedRecipients: ['So11111111111111111111111111111111111111112'],
      rateLimitPerMinute: 30,
    });
    expect(result.maxSettlementAmount).toBe('10000000');
    expect(result.allowedTokens).toHaveLength(1);
    expect(result.rateLimitPerMinute).toBe(30);
  });

  it('rejects non-positive rate limit', () => {
    expect(() => GovernanceSchema.parse({ rateLimitPerMinute: 0 })).toThrow();
    expect(() => GovernanceSchema.parse({ rateLimitPerMinute: -1 })).toThrow();
  });
});

describe('ConfigSchema', () => {
  it('parses valid config with defaults', () => {
    const config = ConfigSchema.parse({
      solanaRpcUrl: 'https://api.devnet.solana.com',
      facilitatorKeypairPath: '/tmp/keypair.json',
      facilitatorPassphrase: 'my-secure-passphrase-123',
    });
    expect(config.solanaNetwork).toBe('devnet');
    expect(config.scryptMode).toBe('fast');
    expect(config.host).toBe('0.0.0.0');
    expect(config.port).toBe(4020);
    expect(config.logLevel).toBe('info');
    expect(config.governance.rateLimitPerMinute).toBe(60);
  });

  it('parses full config', () => {
    const config = ConfigSchema.parse({
      solanaRpcUrl: 'https://my-rpc.example.com',
      facilitatorKeypairPath: '/etc/facilitator/keypair.json',
      facilitatorPassphrase: 'super-secure-passphrase',
      solanaNetwork: 'mainnet-beta',
      scryptMode: 'production',
      host: '127.0.0.1',
      port: 8080,
      logLevel: 'debug',
      governance: {
        maxSettlementAmount: '5000000',
        allowedTokens: ['token1', 'token2'],
        rateLimitPerMinute: 10,
      },
    });
    expect(config.solanaNetwork).toBe('mainnet-beta');
    expect(config.port).toBe(8080);
    expect(config.governance.maxSettlementAmount).toBe('5000000');
  });

  it('rejects invalid RPC URL', () => {
    expect(() =>
      ConfigSchema.parse({
        solanaRpcUrl: 'not-a-url',
        facilitatorKeypairPath: '/tmp/key.json',
        facilitatorPassphrase: 'my-secure-passphrase-123',
      }),
    ).toThrow();
  });

  it('rejects missing keypair path', () => {
    expect(() =>
      ConfigSchema.parse({
        solanaRpcUrl: 'https://api.devnet.solana.com',
        facilitatorKeypairPath: '',
        facilitatorPassphrase: 'my-secure-passphrase-123',
      }),
    ).toThrow();
  });

  it('rejects short passphrase', () => {
    expect(() =>
      ConfigSchema.parse({
        solanaRpcUrl: 'https://api.devnet.solana.com',
        facilitatorKeypairPath: '/tmp/key.json',
        facilitatorPassphrase: 'short',
      }),
    ).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => ConfigSchema.parse({})).toThrow();
  });

  it('rejects invalid port', () => {
    expect(() =>
      ConfigSchema.parse({
        solanaRpcUrl: 'https://api.devnet.solana.com',
        facilitatorKeypairPath: '/tmp/key.json',
        facilitatorPassphrase: 'my-secure-passphrase-123',
        port: 99999,
      }),
    ).toThrow();
  });
});

describe('loadConfigFromEnv', () => {
  beforeEach(() => {
    vi.stubEnv('SOLANA_RPC_URL', 'https://api.devnet.solana.com');
    vi.stubEnv('FACILITATOR_KEYPAIR_PATH', '/tmp/keypair.json');
    vi.stubEnv('FACILITATOR_PASSPHRASE', 'test-passphrase-long-enough');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('loads config from environment variables', () => {
    const config = loadConfigFromEnv();
    expect(config.solanaRpcUrl).toBe('https://api.devnet.solana.com');
    expect(config.facilitatorKeypairPath).toBe('/tmp/keypair.json');
    expect(config.solanaNetwork).toBe('devnet');
  });

  it('parses governance from env vars', () => {
    vi.stubEnv('MAX_SETTLEMENT_AMOUNT', '5000000');
    vi.stubEnv('ALLOWED_TOKENS', 'token1,token2, token3');
    vi.stubEnv('RATE_LIMIT_PER_MINUTE', '20');

    const config = loadConfigFromEnv();
    expect(config.governance.maxSettlementAmount).toBe('5000000');
    expect(config.governance.allowedTokens).toEqual(['token1', 'token2', 'token3']);
    expect(config.governance.rateLimitPerMinute).toBe(20);
  });

  it('throws on missing required env vars', () => {
    vi.unstubAllEnvs();
    expect(() => loadConfigFromEnv()).toThrow();
  });
});
