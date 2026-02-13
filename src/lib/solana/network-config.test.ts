/**
 * Network Configuration Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('network-config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults to devnet when NEXT_PUBLIC_SOLANA_NETWORK is not set', async () => {
    delete process.env.NEXT_PUBLIC_SOLANA_NETWORK;
    const { getNetworkConfig, isDevnet, isMainnet } = await import('./network-config');

    expect(getNetworkConfig().network).toBe('devnet');
    expect(isDevnet()).toBe(true);
    expect(isMainnet()).toBe(false);
  });

  it('returns mainnet config when NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta', async () => {
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = 'mainnet-beta';
    const { getNetworkConfig, isDevnet, isMainnet } = await import('./network-config');

    const config = getNetworkConfig();
    expect(config.network).toBe('mainnet-beta');
    expect(isMainnet()).toBe(true);
    expect(isDevnet()).toBe(false);
    expect(config.usdcMint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  });

  it('uses NEXT_PUBLIC_HOPE_MINT override when set', async () => {
    process.env.NEXT_PUBLIC_HOPE_MINT = 'CustomMintAddress12345678901234567890123456';
    const { getNetworkConfig } = await import('./network-config');

    expect(getNetworkConfig().hopeMint).toBe('CustomMintAddress12345678901234567890123456');
  });

  it('uses default HOPE_MINT when env var not set', async () => {
    delete process.env.NEXT_PUBLIC_HOPE_MINT;
    const { getNetworkConfig } = await import('./network-config');

    expect(getNetworkConfig().hopeMint).toBe('HoPExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  });

  it('returns devnet explorer URL with cluster param', async () => {
    delete process.env.NEXT_PUBLIC_SOLANA_NETWORK;
    const { getExplorerUrl } = await import('./network-config');

    const url = getExplorerUrl('abc123');
    expect(url).toContain('abc123');
    expect(url).toContain('cluster=devnet');
  });

  it('returns mainnet explorer URL without cluster param', async () => {
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = 'mainnet-beta';
    const { getExplorerUrl } = await import('./network-config');

    const url = getExplorerUrl('abc123');
    expect(url).toContain('abc123');
    expect(url).not.toContain('cluster=devnet');
  });

  it('uses correct devnet RPC fallback', async () => {
    delete process.env.NEXT_PUBLIC_SOLANA_NETWORK;
    const { getNetworkConfig } = await import('./network-config');

    expect(getNetworkConfig().defaultRpcFallback).toBe('https://api.devnet.solana.com');
  });

  it('uses correct mainnet RPC fallback', async () => {
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = 'mainnet-beta';
    const { getNetworkConfig } = await import('./network-config');

    expect(getNetworkConfig().defaultRpcFallback).toBe('https://api.mainnet-beta.solana.com');
  });
});
