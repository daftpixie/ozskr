import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigSchema, loadConfigFromEnv } from '../src/config.js';

// ---------------------------------------------------------------------------
// Schema Validation Tests
// ---------------------------------------------------------------------------

describe('ConfigSchema', () => {
  it('should parse valid complete config', () => {
    const result = ConfigSchema.parse({
      solanaRpcUrl: 'https://api.devnet.solana.com',
      agentKeypairPath: '/home/user/.config/ozskr/agent-keypair.json',
      solanaNetwork: 'devnet',
      x402FacilitatorUrl: 'https://x402.example.com/facilitator',
      logLevel: 'debug',
    });

    expect(result.solanaRpcUrl).toBe('https://api.devnet.solana.com');
    expect(result.agentKeypairPath).toBe('/home/user/.config/ozskr/agent-keypair.json');
    expect(result.solanaNetwork).toBe('devnet');
    expect(result.x402FacilitatorUrl).toBe('https://x402.example.com/facilitator');
    expect(result.logLevel).toBe('debug');
  });

  it('should apply defaults for optional fields', () => {
    const result = ConfigSchema.parse({
      solanaRpcUrl: 'https://api.devnet.solana.com',
      agentKeypairPath: '/tmp/keypair.json',
    });

    expect(result.solanaNetwork).toBe('devnet');
    expect(result.x402FacilitatorUrl).toBeUndefined();
    expect(result.logLevel).toBe('info');
  });

  it('should accept all valid network values', () => {
    for (const network of ['devnet', 'mainnet-beta', 'testnet'] as const) {
      const result = ConfigSchema.parse({
        solanaRpcUrl: 'https://api.devnet.solana.com',
        agentKeypairPath: '/tmp/keypair.json',
        solanaNetwork: network,
      });
      expect(result.solanaNetwork).toBe(network);
    }
  });

  it('should accept all valid log levels', () => {
    for (const level of ['debug', 'info', 'warn', 'error'] as const) {
      const result = ConfigSchema.parse({
        solanaRpcUrl: 'https://api.devnet.solana.com',
        agentKeypairPath: '/tmp/keypair.json',
        logLevel: level,
      });
      expect(result.logLevel).toBe(level);
    }
  });

  it('should reject missing solanaRpcUrl', () => {
    expect(() =>
      ConfigSchema.parse({
        agentKeypairPath: '/tmp/keypair.json',
      }),
    ).toThrow();
  });

  it('should reject missing agentKeypairPath', () => {
    expect(() =>
      ConfigSchema.parse({
        solanaRpcUrl: 'https://api.devnet.solana.com',
      }),
    ).toThrow();
  });

  it('should reject invalid URL for solanaRpcUrl', () => {
    expect(() =>
      ConfigSchema.parse({
        solanaRpcUrl: 'not-a-url',
        agentKeypairPath: '/tmp/keypair.json',
      }),
    ).toThrow(/valid URL/);
  });

  it('should reject empty agentKeypairPath', () => {
    expect(() =>
      ConfigSchema.parse({
        solanaRpcUrl: 'https://api.devnet.solana.com',
        agentKeypairPath: '',
      }),
    ).toThrow();
  });

  it('should reject invalid network value', () => {
    expect(() =>
      ConfigSchema.parse({
        solanaRpcUrl: 'https://api.devnet.solana.com',
        agentKeypairPath: '/tmp/keypair.json',
        solanaNetwork: 'invalid-network',
      }),
    ).toThrow();
  });

  it('should reject invalid log level', () => {
    expect(() =>
      ConfigSchema.parse({
        solanaRpcUrl: 'https://api.devnet.solana.com',
        agentKeypairPath: '/tmp/keypair.json',
        logLevel: 'trace',
      }),
    ).toThrow();
  });

  it('should reject invalid x402FacilitatorUrl', () => {
    expect(() =>
      ConfigSchema.parse({
        solanaRpcUrl: 'https://api.devnet.solana.com',
        agentKeypairPath: '/tmp/keypair.json',
        x402FacilitatorUrl: 'not-a-url',
      }),
    ).toThrow(/valid URL/);
  });
});

// ---------------------------------------------------------------------------
// Environment Loader Tests
// ---------------------------------------------------------------------------

describe('loadConfigFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.stubEnv('SOLANA_RPC_URL', 'https://api.devnet.solana.com');
    vi.stubEnv('AGENT_KEYPAIR_PATH', '/home/user/.config/ozskr/agent-keypair.json');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should load config from environment variables', () => {
    const config = loadConfigFromEnv();

    expect(config.solanaRpcUrl).toBe('https://api.devnet.solana.com');
    expect(config.agentKeypairPath).toBe('/home/user/.config/ozskr/agent-keypair.json');
    expect(config.solanaNetwork).toBe('devnet');
    expect(config.logLevel).toBe('info');
  });

  it('should load optional env vars when present', () => {
    vi.stubEnv('SOLANA_NETWORK', 'mainnet-beta');
    vi.stubEnv('X402_FACILITATOR_URL', 'https://facilitator.example.com');
    vi.stubEnv('LOG_LEVEL', 'debug');

    const config = loadConfigFromEnv();

    expect(config.solanaNetwork).toBe('mainnet-beta');
    expect(config.x402FacilitatorUrl).toBe('https://facilitator.example.com');
    expect(config.logLevel).toBe('debug');
  });

  it('should throw when required env vars are missing', () => {
    vi.unstubAllEnvs();
    delete process.env.SOLANA_RPC_URL;
    delete process.env.AGENT_KEYPAIR_PATH;

    expect(() => loadConfigFromEnv()).toThrow();
  });
});
