import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Config } from '../src/config.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const MOCK_AGENT_ADDRESS = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

// Store mock references for later override
const mockCheckDelegation = vi.fn(async () => ({
  isActive: true,
  delegate: MOCK_AGENT_ADDRESS,
  remainingAmount: 50_000_000n,
  originalAmount: 100_000_000n,
  tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  ownerTokenAccount: '11111111111111111111111111111111',
}));

const mockCheckBudget = vi.fn(async () => ({
  remainingOnChain: 50_000_000n,
  spent: 0n,
  available: 50_000_000n,
}));

const mockRecordSpend = vi.fn();

vi.mock('@ozskr/agent-wallet-sdk', () => ({
  generateAgentKeypair: vi.fn(async () => ({
    signer: { address: MOCK_AGENT_ADDRESS, keyPair: {} },
    keypairBytes: new Uint8Array(64),
  })),
  storeEncryptedKeypair: vi.fn(async () => undefined),
  loadEncryptedKeypair: vi.fn(async () => ({
    address: MOCK_AGENT_ADDRESS,
    keyPair: {},
  })),
  checkDelegation: mockCheckDelegation,
  createBudgetTracker: vi.fn(() => ({
    checkBudget: mockCheckBudget,
    recordSpend: mockRecordSpend,
    reset: vi.fn(),
    getSpendHistory: vi.fn(() => []),
    getTotalSpent: vi.fn(() => 0n),
    getInitialBudget: vi.fn(() => 100_000_000n),
  })),
  DelegationError: class DelegationError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'DelegationError';
      this.code = code;
    }
  },
  DelegationErrorCode: {
    BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
    INVALID_AMOUNT: 'INVALID_AMOUNT',
    INVALID_ADDRESS: 'INVALID_ADDRESS',
    NOT_DELEGATED: 'NOT_DELEGATED',
    DELEGATION_EXPIRED: 'DELEGATION_EXPIRED',
    RPC_ERROR: 'RPC_ERROR',
  },
  SCRYPT_PARAMS_FAST: { N: 2 ** 14, r: 8, p: 1, keyLen: 32 },
}));

const mockMakeX402Request = vi.fn(async () => ({
  paymentRequired: true,
  requirements: [{
    version: 2,
    scheme: 'exact',
    network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    amount: '1000000',
    asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    payTo: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    maxTimeoutSeconds: 30,
    raw: {
      x402Version: 2,
      accepts: [{
        scheme: 'exact',
        network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        amount: '1000000',
        asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        payTo: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        maxTimeoutSeconds: 30,
      }],
    },
  }],
  rawPaymentRequired: {},
}));

const mockRetryWithPayment = vi.fn(async () => ({
  response: { status: 200, ok: true, text: async () => 'Paid content' },
  settled: true,
  transactionSignature: 'paid-sig-123',
}));

const mockValidateRequirement = vi.fn(() => null);

vi.mock('../src/lib/x402-client.js', () => ({
  makeX402Request: mockMakeX402Request,
  retryWithPayment: mockRetryWithPayment,
  validateRequirement: mockValidateRequirement,
}));

const mockSubmitToFacilitator = vi.fn(async () => ({
  success: true,
  transactionSignature: 'edge-sig-123',
  network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  payer: MOCK_AGENT_ADDRESS,
  facilitator: 'cdp',
}));

vi.mock('../src/lib/facilitator.js', () => ({
  submitToFacilitator: mockSubmitToFacilitator,
  FacilitatorError: class FacilitatorError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'FacilitatorError';
    }
  },
}));

vi.mock('../src/lib/history.js', () => ({
  appendTransaction: vi.fn(async () => undefined),
  queryHistory: vi.fn(async () => []),
}));

// Import after mocks
const { createServer } = await import('../src/server.js');

// ---------------------------------------------------------------------------
// Test Config
// ---------------------------------------------------------------------------

const TEST_CONFIG: Config = {
  solanaRpcUrl: 'https://api.devnet.solana.com',
  agentKeypairPath: '/tmp/test-keypair.json',
  solanaNetwork: 'devnet',
  logLevel: 'error',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTestClient(config: Config = TEST_CONFIG) {
  const server = createServer(config);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, server };
}

function parseToolResult(result: { content: unknown[] }): Record<string, unknown> {
  const text = (result.content[0] as { type: string; text: string }).text;
  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// Edge Case Tests
// ---------------------------------------------------------------------------

describe('x402-solana-mcp edge cases', () => {
  let client: Client;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset all mocks to their default behavior
    mockCheckDelegation.mockResolvedValue({
      isActive: true,
      delegate: MOCK_AGENT_ADDRESS,
      remainingAmount: 50_000_000n,
      originalAmount: 100_000_000n,
      tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      ownerTokenAccount: '11111111111111111111111111111111',
    });

    mockCheckBudget.mockResolvedValue({
      remainingOnChain: 50_000_000n,
      spent: 0n,
      available: 50_000_000n,
    });

    mockMakeX402Request.mockResolvedValue({
      paymentRequired: true,
      requirements: [{
        version: 2,
        scheme: 'exact',
        network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        amount: '1000000',
        asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        payTo: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        maxTimeoutSeconds: 30,
        raw: {},
      }],
      rawPaymentRequired: {},
    });

    mockValidateRequirement.mockReturnValue(null);

    mockSubmitToFacilitator.mockResolvedValue({
      success: true,
      transactionSignature: 'edge-sig-123',
      network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
      payer: MOCK_AGENT_ADDRESS,
      facilitator: 'cdp',
    });

    mockRetryWithPayment.mockResolvedValue({
      response: { status: 200, ok: true, text: async () => 'Paid content' },
      settled: true,
      transactionSignature: 'paid-sig-123',
    });

    const setup = await createTestClient();
    client = setup.client;
  });

  // ---------------------------------------------------------------------------
  // Edge Case 1: Concurrent double-spend prevention
  // ---------------------------------------------------------------------------
  it('should allow concurrent x402_pay calls when budget tracker is disabled', async () => {
    // Note: The server's budgetTracker is null by default, so concurrent calls
    // both succeed since there's no lock. This test verifies that behavior.
    // If budget tracking is enabled in the future, this would need to be updated.

    // Start both calls concurrently
    const call1 = client.callTool({
      name: 'x402_pay',
      arguments: {
        url: 'https://api.example.com/data1',
        passphrase: 'test-passphrase-12345',
        tokenAccount: '11111111111111111111111111111111',
      },
    });

    const call2 = client.callTool({
      name: 'x402_pay',
      arguments: {
        url: 'https://api.example.com/data2',
        passphrase: 'test-passphrase-12345',
        tokenAccount: '11111111111111111111111111111111',
      },
    });

    const [result1, result2] = await Promise.all([call1, call2]);

    // Both calls should succeed when budget tracker is disabled
    const parsed1 = parseToolResult(result1);
    expect(parsed1.status).toBe('success');

    const parsed2 = parseToolResult(result2);
    expect(parsed2.status).toBe('success');
  });

  // ---------------------------------------------------------------------------
  // Edge Case 2: Expired delegation
  // ---------------------------------------------------------------------------
  it('should propagate FACILITATOR_ERROR when delegation expires during payment', async () => {
    // Initial checkDelegation returns active
    mockCheckDelegation.mockResolvedValueOnce({
      isActive: true,
      delegate: MOCK_AGENT_ADDRESS,
      remainingAmount: 50_000_000n,
      originalAmount: 100_000_000n,
      tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      ownerTokenAccount: '11111111111111111111111111111111',
    });

    // But facilitator sees it as expired/invalid
    const { FacilitatorError } = await import('../src/lib/facilitator.js');
    mockSubmitToFacilitator.mockRejectedValueOnce(
      new FacilitatorError('Delegation expired or invalid for payer address'),
    );

    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: 'https://api.example.com/data',
        passphrase: 'test-passphrase-12345',
        tokenAccount: '11111111111111111111111111111111',
      },
    });

    const parsed = parseToolResult(result);
    expect(parsed.error).toBe('FACILITATOR_ERROR');
    expect(parsed.message).toContain('Delegation expired');
  });

  // ---------------------------------------------------------------------------
  // Edge Case 3: Network partition / RPC unreachable
  // ---------------------------------------------------------------------------
  it('should return PAY_FAILED when network request throws', async () => {
    mockMakeX402Request.mockRejectedValueOnce(new Error('Network timeout: ECONNREFUSED'));

    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: 'https://api.example.com/data',
        passphrase: 'test-passphrase-12345',
        tokenAccount: '11111111111111111111111111111111',
      },
    });

    const parsed = parseToolResult(result);
    expect(parsed.error).toBe('PAY_FAILED');
    expect(parsed.message).toContain('Network timeout');
  });

  // ---------------------------------------------------------------------------
  // Edge Case 4: Invalid facilitator signature
  // ---------------------------------------------------------------------------
  it('should report success with facilitator sig even when retry gets non-200', async () => {
    // Facilitator returns success with signature
    mockSubmitToFacilitator.mockResolvedValueOnce({
      success: true,
      transactionSignature: 'facilitator-sig-abc',
      network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
      payer: MOCK_AGENT_ADDRESS,
      facilitator: 'cdp',
    });

    // But retry with payment proof gets 403 (e.g., server doesn't trust facilitator sig)
    mockRetryWithPayment.mockResolvedValueOnce({
      response: { status: 403, ok: false, text: async () => 'Forbidden' },
      settled: false,
      transactionSignature: undefined,
    });

    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: 'https://api.example.com/data',
        passphrase: 'test-passphrase-12345',
        tokenAccount: '11111111111111111111111111111111',
      },
    });

    const parsed = parseToolResult(result);
    // Tool still reports success because facilitator said it was settled
    expect(parsed.status).toBe('success');
    expect(parsed.transactionSignature).toBe('facilitator-sig-abc');
    expect(parsed.httpStatus).toBe(403);
    expect(parsed.content).toBe('Forbidden');
  });

  // ---------------------------------------------------------------------------
  // Edge Case 5: u64 max boundary amount (with maxAmount check)
  // ---------------------------------------------------------------------------
  it('should handle u64 max payment amount with maxAmount parameter', async () => {
    const U64_MAX = '18446744073709551615';

    mockMakeX402Request.mockResolvedValueOnce({
      paymentRequired: true,
      requirements: [{
        version: 2,
        scheme: 'exact',
        network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        amount: U64_MAX,
        asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        payTo: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        maxTimeoutSeconds: 30,
        raw: {},
      }],
      rawPaymentRequired: {},
    });

    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: 'https://api.example.com/data',
        passphrase: 'test-passphrase-12345',
        tokenAccount: '11111111111111111111111111111111',
        maxAmount: '50000000', // Set a lower maxAmount to trigger the check
      },
    });

    const parsed = parseToolResult(result);
    // Should fail maxAmount check (budget tracker is null, so only maxAmount check applies)
    expect(parsed.error).toBe('AMOUNT_EXCEEDS_MAX');
    expect(parsed.message).toContain(U64_MAX);
    expect(parsed.message).toContain('50000000');
  });

  // ---------------------------------------------------------------------------
  // Edge Case 6: Zero-amount payment request
  // ---------------------------------------------------------------------------
  it('should reject zero-amount payment requirements', async () => {
    mockMakeX402Request.mockResolvedValueOnce({
      paymentRequired: true,
      requirements: [{
        version: 2,
        scheme: 'exact',
        network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        amount: '0',
        asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        payTo: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        maxTimeoutSeconds: 30,
        raw: {},
      }],
      rawPaymentRequired: {},
    });

    mockValidateRequirement.mockReturnValueOnce('Payment amount is zero or missing');

    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: 'https://api.example.com/data',
        passphrase: 'test-passphrase-12345',
        tokenAccount: '11111111111111111111111111111111',
      },
    });

    const parsed = parseToolResult(result);
    expect(parsed.error).toBe('INVALID_REQUIREMENT');
    expect(parsed.message).toContain('zero or missing');
  });

  // ---------------------------------------------------------------------------
  // Edge Case 7: Non-USDC token (any SPL token)
  // ---------------------------------------------------------------------------
  it('should allow payment with non-USDC SPL tokens', async () => {
    const BONK_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

    // Override delegation and budget check for BONK-sized amounts
    mockCheckDelegation.mockReset();
    mockCheckDelegation.mockResolvedValue({
      isActive: true,
      delegate: MOCK_AGENT_ADDRESS,
      remainingAmount: 10_000_000_000n,
      originalAmount: 10_000_000_000n,
      tokenMint: BONK_MINT,
      ownerTokenAccount: '11111111111111111111111111111111',
    });
    mockCheckBudget.mockReset();
    mockCheckBudget.mockResolvedValue({
      remainingOnChain: 10_000_000_000n,
      spent: 0n,
      available: 10_000_000_000n,
    });

    mockMakeX402Request.mockResolvedValueOnce({
      paymentRequired: true,
      requirements: [{
        version: 2,
        scheme: 'exact',
        network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        amount: '1000000000',
        asset: BONK_MINT,
        payTo: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        maxTimeoutSeconds: 30,
        raw: {},
      }],
      rawPaymentRequired: {},
    });

    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: 'https://api.example.com/data',
        passphrase: 'test-passphrase-12345',
        tokenAccount: '11111111111111111111111111111111',
      },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.asset).toBe(BONK_MINT);
    expect(parsed.amountPaid).toBe('1000000000');
  });

  // ---------------------------------------------------------------------------
  // Edge Case 8: Rapid successive tool calls
  // ---------------------------------------------------------------------------
  it('should handle rapid x402_estimate_cost calls without state corruption', async () => {
    const calls = Array.from({ length: 5 }, (_, i) =>
      client.callTool({
        name: 'x402_estimate_cost',
        arguments: { url: `https://api.example.com/data${i}` },
      }),
    );

    const results = await Promise.all(calls);

    // All should succeed
    for (const result of results) {
      const parsed = parseToolResult(result);
      expect(parsed.status).toBe('success');
      expect(parsed.paymentRequired).toBe(true);
    }

    // makeX402Request should have been called 5 times
    expect(mockMakeX402Request).toHaveBeenCalledTimes(5);
  });

  // ---------------------------------------------------------------------------
  // Edge Case 9: Facilitator returning invalid/empty transaction signature
  // ---------------------------------------------------------------------------
  it('should return success with empty sig when facilitator provides empty signature', async () => {
    mockSubmitToFacilitator.mockResolvedValueOnce({
      success: true,
      transactionSignature: '',
      network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
      payer: MOCK_AGENT_ADDRESS,
      facilitator: 'cdp',
    });

    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: 'https://api.example.com/data',
        passphrase: 'test-passphrase-12345',
        tokenAccount: '11111111111111111111111111111111',
      },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.transactionSignature).toBe('');
    expect(parsed.facilitator).toBe('cdp');
  });

  // ---------------------------------------------------------------------------
  // Bonus Edge Case: maxAmount boundary (exactly at limit)
  // ---------------------------------------------------------------------------
  it('should accept payment when amount equals maxAmount exactly', async () => {
    mockMakeX402Request.mockResolvedValueOnce({
      paymentRequired: true,
      requirements: [{
        version: 2,
        scheme: 'exact',
        network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        amount: '1000000',
        asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        payTo: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        maxTimeoutSeconds: 30,
        raw: {},
      }],
      rawPaymentRequired: {},
    });

    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: 'https://api.example.com/data',
        passphrase: 'test-passphrase-12345',
        tokenAccount: '11111111111111111111111111111111',
        maxAmount: '1000000', // Exactly equal to required amount
      },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.amountPaid).toBe('1000000');
  });
});
