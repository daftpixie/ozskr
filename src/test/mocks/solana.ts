/**
 * Solana Mock Factories
 * Mock wallet adapter and @solana/kit utilities for testing
 */

import { vi } from "vitest";

/**
 * Mock wallet state for testing
 */
export interface MockWalletState {
  publicKey: string | null;
  connected: boolean;
  connecting: boolean;
  disconnecting: boolean;
}

/**
 * Default mock wallet (disconnected)
 */
const DEFAULT_WALLET_STATE: MockWalletState = {
  publicKey: null,
  connected: false,
  connecting: false,
  disconnecting: false,
};

/**
 * Create mock wallet with custom state
 */
export const createMockWallet = (overrides?: Partial<MockWalletState>) => {
  const state = { ...DEFAULT_WALLET_STATE, ...overrides };

  return {
    publicKey: state.publicKey,
    connected: state.connected,
    connecting: state.connecting,
    disconnecting: state.disconnecting,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    signTransaction: vi.fn(),
    signAllTransactions: vi.fn(),
    signMessage: vi.fn(),
  };
};

/**
 * Create mock Solana connection
 */
export const createMockConnection = (rpcEndpoint = "https://devnet.helius-rpc.com") => {
  return {
    rpcEndpoint,
    getBalance: vi.fn().mockResolvedValue({ value: BigInt(1_000_000_000) }),
    getTokenAccountBalance: vi.fn().mockResolvedValue({
      value: { amount: "1000000", decimals: 6, uiAmount: 1.0 },
    }),
    simulateTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
    getLatestBlockhash: vi.fn().mockResolvedValue({
      blockhash: "mock-blockhash",
      lastValidBlockHeight: 1000000,
    }),
  };
};

/**
 * Mock @solana/wallet-adapter-react
 */
export const mockWalletAdapter = (walletState?: Partial<MockWalletState>) => {
  const wallet = createMockWallet(walletState);

  vi.mock("@solana/wallet-adapter-react", () => ({
    useWallet: vi.fn(() => wallet),
    useConnection: vi.fn(() => ({
      connection: createMockConnection(),
    })),
    WalletProvider: vi.fn(({ children }: { children: React.ReactNode }) => children),
  }));

  return wallet;
};

/**
 * Mock @solana/kit utilities
 */
export const mockSolanaKit = () => {
  vi.mock("@solana/kit", () => ({
    address: vi.fn((addr: string) => addr),
    assertIsAddress: vi.fn((addr: unknown): asserts addr is string => {
      if (typeof addr !== "string") {
        throw new Error("Invalid address");
      }
    }),
    createSolanaRpc: vi.fn(() => createMockConnection()),
    pipe: vi.fn((...fns: unknown[]) => (value: unknown) =>
      fns.reduce((acc, fn) => (typeof fn === "function" ? fn(acc) : acc), value)
    ),
    lamports: vi.fn((amount: number | bigint) => BigInt(amount)),
  }));
};

/**
 * Valid mock Solana address for testing
 */
export const MOCK_WALLET_ADDRESS = "11111111111111111111111111111111";
export const MOCK_WALLET_ADDRESS_2 = "So11111111111111111111111111111111111111112";
