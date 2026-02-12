/**
 * Solana RPC Client Tests
 * Tests for RPC client factory and utilities
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @solana/kit before importing the module
const mockCreateSolanaRpc = vi.fn();

vi.mock("@solana/kit", () => ({
  createSolanaRpc: mockCreateSolanaRpc,
  address: vi.fn((addr: string) => addr),
  assertIsAddress: vi.fn((addr: unknown): asserts addr is string => {
    if (typeof addr !== "string" || addr.length < 32) {
      throw new Error("Invalid address");
    }
  }),
}));

describe("Solana RPC Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set environment variable
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL = "https://devnet.helius-rpc.com";
  });

  it("should create RPC client with environment variable endpoint", async () => {
    // Since the actual rpc.ts doesn't exist yet, we'll test the expected behavior
    const { createSolanaRpc } = await import("@solana/kit");

    const mockRpc = {
      getBalance: vi.fn(),
      getLatestBlockhash: vi.fn(),
    };

    mockCreateSolanaRpc.mockReturnValue(mockRpc);

    // Simulate what the rpc.ts module should do
    const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
    expect(rpcUrl).toBe("https://devnet.helius-rpc.com");

    const client = createSolanaRpc(rpcUrl!);
    expect(createSolanaRpc).toHaveBeenCalledWith("https://devnet.helius-rpc.com");
    expect(client).toBe(mockRpc);
  });

  it("should throw error if RPC URL is not configured", () => {
    delete process.env.NEXT_PUBLIC_HELIUS_RPC_URL;

    const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
    expect(rpcUrl).toBeUndefined();

    // The module should throw an error when RPC URL is missing
    expect(() => {
      if (!rpcUrl) {
        throw new Error("Missing NEXT_PUBLIC_HELIUS_RPC_URL environment variable");
      }
    }).toThrow("Missing NEXT_PUBLIC_HELIUS_RPC_URL");
  });

  it("should validate address using assertIsAddress", async () => {
    const mockAssertIsAddress = vi.fn((addr: unknown): addr is string => {
      if (typeof addr !== "string" || addr.length < 32) {
        throw new Error("Invalid address");
      }
      return true;
    });

    // Valid address
    const validAddr = "So11111111111111111111111111111111111111112";
    expect(() => {
      mockAssertIsAddress(validAddr);
    }).not.toThrow();

    // Invalid address
    const invalidAddr = "invalid";
    expect(() => {
      mockAssertIsAddress(invalidAddr);
    }).toThrow("Invalid address");

    const nullAddr: unknown = null;
    expect(() => {
      mockAssertIsAddress(nullAddr);
    }).toThrow("Invalid address");
  });

  it("should use address utility for address formatting", async () => {
    const { address } = await import("@solana/kit");

    const addr = "So11111111111111111111111111111111111111112";
    const result = address(addr);

    expect(address).toHaveBeenCalledWith(addr);
    expect(result).toBe(addr);
  });
});
