import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Config } from '../src/config.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const MOCK_AGENT_ADDRESS = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

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
  checkDelegation: vi.fn(async () => ({
    isActive: true,
    delegate: MOCK_AGENT_ADDRESS,
    remainingAmount: 50_000_000n,
    originalAmount: 100_000_000n,
    tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    ownerTokenAccount: '11111111111111111111111111111111',
  })),
  createBudgetTracker: vi.fn(() => ({
    checkBudget: vi.fn(async () => ({ remainingOnChain: 50_000_000n, spent: 0n, available: 50_000_000n })),
    recordSpend: vi.fn(),
    reset: vi.fn(),
    getSpendHistory: vi.fn(() => []),
    getTotalSpent: vi.fn(() => 0n),
  })),
  DelegationError: class DelegationError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'DelegationError';
      this.code = code;
    }
  },
  SCRYPT_PARAMS_FAST: { N: 2 ** 14, r: 8, p: 1, keyLen: 32 },
}));

vi.mock('../src/lib/x402-client.js', () => ({
  makeX402Request: vi.fn(async () => ({
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
  })),
  retryWithPayment: vi.fn(async () => ({
    response: { status: 200, ok: true, text: async () => 'Paid content' },
    settled: true,
    transactionSignature: 'paid-sig-123',
  })),
  validateRequirement: vi.fn(() => null),
}));

vi.mock('../src/lib/facilitator.js', () => ({
  submitToFacilitator: vi.fn(async () => ({
    success: true,
    transactionSignature: 'facilitator-sig-abc',
    network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    payer: MOCK_AGENT_ADDRESS,
    facilitator: 'cdp',
  })),
  FacilitatorError: class FacilitatorError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'FacilitatorError';
    }
  },
}));

vi.mock('../src/lib/history.js', () => ({
  appendTransaction: vi.fn(async () => undefined),
  queryHistory: vi.fn(async () => [
    {
      timestamp: '2026-02-14T12:00:00.000Z',
      signature: 'hist-sig-1',
      url: 'https://api.example.com/data',
      amount: '1000000',
      asset: 'USDC',
      payTo: 'Recipient',
      network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
      facilitator: 'cdp',
      method: 'GET',
    },
  ]),
}));

// Import after mocks
const { createServer } = await import('../src/server.js');
const { makeX402Request } = await import('../src/lib/x402-client.js');
const { checkDelegation } = await import('@ozskr/agent-wallet-sdk');

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
// Server Creation Tests
// ---------------------------------------------------------------------------

describe('createServer', () => {
  it('should create an MCP server instance', () => {
    const server = createServer(TEST_CONFIG);
    expect(server).toBeDefined();
  });

  it('should register all 8 tools', async () => {
    const { client } = await createTestClient();
    const result = await client.listTools();

    expect(result.tools).toHaveLength(8);

    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual([
      'x402_check_balance',
      'x402_check_delegation',
      'x402_discover_services',
      'x402_estimate_cost',
      'x402_pay',
      'x402_revoke_delegation',
      'x402_setup_agent',
      'x402_transaction_history',
    ]);
  });

  it('should have descriptions on all tools', async () => {
    const { client } = await createTestClient();
    const result = await client.listTools();

    for (const tool of result.tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.description!.length).toBeGreaterThan(10);
    }
  });

  it('should have input schemas on all tools', async () => {
    const { client } = await createTestClient();
    const result = await client.listTools();

    for (const tool of result.tools) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});

// ---------------------------------------------------------------------------
// Week 1 Wired Tool Tests
// ---------------------------------------------------------------------------

describe('wired tools (Week 1)', () => {
  let client: Client;

  beforeEach(async () => {
    vi.clearAllMocks();
    const setup = await createTestClient();
    client = setup.client;
  });

  it('x402_setup_agent should generate keypair and return address', async () => {
    const result = await client.callTool({
      name: 'x402_setup_agent',
      arguments: { passphrase: 'test-passphrase-12345' },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.agentAddress).toBe(MOCK_AGENT_ADDRESS);
    expect(parsed.keypairPath).toBe('/tmp/test-keypair.json');
  });

  it('x402_check_delegation should return delegation status', async () => {
    const result = await client.callTool({
      name: 'x402_check_delegation',
      arguments: { tokenAccount: '11111111111111111111111111111111' },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.isActive).toBe(true);
    expect(parsed.remainingAmount).toBe('50000000');
  });

  it('x402_check_balance should return agent address', async () => {
    const result = await client.callTool({
      name: 'x402_check_balance',
      arguments: { passphrase: 'test-passphrase-12345' },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.agentAddress).toBe(MOCK_AGENT_ADDRESS);
  });

  it('x402_revoke_delegation should return delegation info with instructions', async () => {
    const result = await client.callTool({
      name: 'x402_revoke_delegation',
      arguments: { tokenAccount: '11111111111111111111111111111111' },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.isActive).toBe(true);
    expect(parsed.message).toContain('owner must sign');
  });
});

// ---------------------------------------------------------------------------
// Week 2 Wired Tool Tests
// ---------------------------------------------------------------------------

describe('wired tools (Week 2)', () => {
  let client: Client;

  beforeEach(async () => {
    vi.clearAllMocks();
    const setup = await createTestClient();
    client = setup.client;
  });

  it('x402_pay should complete full payment cycle', async () => {
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
    expect(parsed.paymentRequired).toBe(true);
    expect(parsed.transactionSignature).toBe('facilitator-sig-abc');
    expect(parsed.amountPaid).toBe('1000000');
    expect(parsed.facilitator).toBe('cdp');
    expect(parsed.content).toBe('Paid content');
  });

  it('x402_pay should reject when maxAmount exceeded', async () => {
    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: 'https://api.example.com/data',
        passphrase: 'test-passphrase-12345',
        tokenAccount: '11111111111111111111111111111111',
        maxAmount: '500000', // Less than the 1000000 required
      },
    });

    const parsed = parseToolResult(result);
    expect(parsed.error).toBe('AMOUNT_EXCEEDS_MAX');
  });

  it('x402_transaction_history should return records', async () => {
    const result = await client.callTool({
      name: 'x402_transaction_history',
      arguments: {},
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.count).toBe(1);
    expect((parsed.transactions as Array<Record<string, unknown>>)[0].signature).toBe('hist-sig-1');
  });

  it('x402_transaction_history should accept filter parameters', async () => {
    const result = await client.callTool({
      name: 'x402_transaction_history',
      arguments: {
        limit: 5,
        url: 'example.com',
        afterDate: '2026-01-01T00:00:00Z',
      },
    });

    expect(result.isError).toBeUndefined();
    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
  });

  it('x402_discover_services should return results when no args', async () => {
    const result = await client.callTool({
      name: 'x402_discover_services',
      arguments: {},
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.message).toContain('Provide a url');
    expect(parsed.knownRegistries).toBeTruthy();
  });

  it('x402_estimate_cost should probe endpoint', async () => {
    // The mock makeX402Request returns paymentRequired=true with requirements
    const result = await client.callTool({
      name: 'x402_estimate_cost',
      arguments: { url: 'https://api.example.com/data' },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.paymentRequired).toBe(true);
    expect((parsed.options as Array<Record<string, unknown>>).length).toBeGreaterThan(0);
    expect((parsed.options as Array<Record<string, unknown>>)[0].amount).toBe('1000000');
  });
});

// ---------------------------------------------------------------------------
// Input Validation Tests
// ---------------------------------------------------------------------------

describe('tool input validation', () => {
  let client: Client;

  beforeEach(async () => {
    const setup = await createTestClient();
    client = setup.client;
  });

  it('x402_setup_agent should reject missing passphrase', async () => {
    const result = await client.callTool({
      name: 'x402_setup_agent',
      arguments: {},
    });
    expect(result.isError).toBe(true);
  });

  it('x402_setup_agent should reject short passphrase', async () => {
    const result = await client.callTool({
      name: 'x402_setup_agent',
      arguments: { passphrase: 'short' },
    });
    expect(result.isError).toBe(true);
  });

  it('x402_pay should reject missing url', async () => {
    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        passphrase: 'test-passphrase-12345',
        tokenAccount: '11111111111111111111111111111111',
      },
    });
    expect(result.isError).toBe(true);
  });

  it('x402_pay should reject missing passphrase', async () => {
    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: 'https://api.example.com/data',
        tokenAccount: '11111111111111111111111111111111',
      },
    });
    expect(result.isError).toBe(true);
  });

  it('x402_pay should reject missing tokenAccount', async () => {
    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: 'https://api.example.com/data',
        passphrase: 'test-passphrase-12345',
      },
    });
    expect(result.isError).toBe(true);
  });

  it('x402_check_delegation should reject missing tokenAccount', async () => {
    const result = await client.callTool({
      name: 'x402_check_delegation',
      arguments: {},
    });
    expect(result.isError).toBe(true);
  });

  it('x402_check_balance should reject missing passphrase', async () => {
    const result = await client.callTool({
      name: 'x402_check_balance',
      arguments: {},
    });
    expect(result.isError).toBe(true);
  });

  it('x402_revoke_delegation should reject missing tokenAccount', async () => {
    const result = await client.callTool({
      name: 'x402_revoke_delegation',
      arguments: {},
    });
    expect(result.isError).toBe(true);
  });

  it('x402_estimate_cost should reject missing url', async () => {
    const result = await client.callTool({
      name: 'x402_estimate_cost',
      arguments: {},
    });
    expect(result.isError).toBe(true);
  });

  it('x402_estimate_cost should reject invalid url', async () => {
    const result = await client.callTool({
      name: 'x402_estimate_cost',
      arguments: { url: 'not-valid' },
    });
    expect(result.isError).toBe(true);
  });

  it('x402_discover_services should accept no arguments', async () => {
    const result = await client.callTool({
      name: 'x402_discover_services',
      arguments: {},
    });
    expect(result.isError).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Coverage: Uncovered Paths
// ---------------------------------------------------------------------------

describe('uncovered path coverage', () => {
  let client: Client;

  beforeEach(async () => {
    vi.clearAllMocks();
    const setup = await createTestClient();
    client = setup.client;
  });

  it('x402_discover_services with url should probe and find x402 endpoint', async () => {
    const result = await client.callTool({
      name: 'x402_discover_services',
      arguments: { url: 'https://api.example.com/data' },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    const results = parsed.results as Array<Record<string, unknown>>;
    expect(results).toHaveLength(1);
    expect(results[0].x402Enabled).toBe(true);
    expect(results[0].requirements).toBeDefined();
  });

  it('x402_discover_services with non-402 url should return x402Enabled=false', async () => {
    vi.mocked(makeX402Request).mockResolvedValueOnce({
      paymentRequired: false,
      requirements: [],
      rawPaymentRequired: {},
      response: { status: 200, ok: true, text: async () => 'OK' } as unknown as Response,
    });

    const result = await client.callTool({
      name: 'x402_discover_services',
      arguments: { url: 'https://free.example.com/api' },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    const results = parsed.results as Array<Record<string, unknown>>;
    expect(results[0].x402Enabled).toBe(false);
    expect(results[0].httpStatus).toBe(200);
  });

  it('x402_estimate_cost with free endpoint should return paymentRequired=false', async () => {
    vi.mocked(makeX402Request).mockResolvedValueOnce({
      paymentRequired: false,
      requirements: [],
      rawPaymentRequired: {},
      response: { status: 200, ok: true, text: async () => 'OK' } as unknown as Response,
    });

    const result = await client.callTool({
      name: 'x402_estimate_cost',
      arguments: { url: 'https://free.example.com/api' },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.paymentRequired).toBe(false);
  });

  it('x402_estimate_cost with empty requirements should return error', async () => {
    vi.mocked(makeX402Request).mockResolvedValueOnce({
      paymentRequired: true,
      requirements: [],
      rawPaymentRequired: {},
    } as ReturnType<typeof makeX402Request> extends Promise<infer T> ? T : never);

    const result = await client.callTool({
      name: 'x402_estimate_cost',
      arguments: { url: 'https://api.example.com/data' },
    });

    const parsed = parseToolResult(result);
    expect(parsed.error).toBe('NO_REQUIREMENTS');
  });

  it('x402_pay with free endpoint should return without payment', async () => {
    vi.mocked(makeX402Request).mockResolvedValueOnce({
      paymentRequired: false,
      requirements: [],
      rawPaymentRequired: {},
      response: { status: 200, ok: true, text: async () => 'Free content' } as unknown as Response,
    });

    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: 'https://free.example.com/api',
        passphrase: 'test-passphrase-12345',
        tokenAccount: '11111111111111111111111111111111',
      },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.paymentRequired).toBe(false);
    expect(parsed.content).toBe('Free content');
  });

  it('x402_pay with empty requirements should return error', async () => {
    vi.mocked(makeX402Request).mockResolvedValueOnce({
      paymentRequired: true,
      requirements: [],
      rawPaymentRequired: {},
    } as ReturnType<typeof makeX402Request> extends Promise<infer T> ? T : never);

    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: 'https://api.example.com/data',
        passphrase: 'test-passphrase-12345',
        tokenAccount: '11111111111111111111111111111111',
      },
    });

    const parsed = parseToolResult(result);
    expect(parsed.error).toBe('NO_REQUIREMENTS');
  });

  it('x402_revoke_delegation with inactive delegation should return nothing to revoke', async () => {
    vi.mocked(checkDelegation).mockResolvedValueOnce({
      isActive: false,
      delegate: '',
      remainingAmount: 0n,
      originalAmount: 0n,
      tokenMint: '',
      ownerTokenAccount: '',
    });

    const result = await client.callTool({
      name: 'x402_revoke_delegation',
      arguments: { tokenAccount: '11111111111111111111111111111111' },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.isActive).toBe(false);
    expect(parsed.message).toContain('Nothing to revoke');
  });

  it('x402_discover_services with registry should query registry endpoint', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () => ({ services: [{ url: 'https://paid.example.com', price: '1 USDC' }] }),
      text: async () => '{}',
    })) as unknown as typeof fetch;

    try {
      const result = await client.callTool({
        name: 'x402_discover_services',
        arguments: { registry: 'https://registry.example.com/services' },
      });

      const parsed = parseToolResult(result);
      expect(parsed.status).toBe('success');
      const results = parsed.results as Array<Record<string, unknown>>;
      expect(results).toHaveLength(1);
      expect(results[0].registry).toBe('https://registry.example.com/services');
      expect(results[0].services).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('x402_discover_services with failing registry should return error info', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      status: 503,
      ok: false,
      headers: new Headers(),
      json: async () => ({}),
      text: async () => 'Service Unavailable',
    })) as unknown as typeof fetch;

    try {
      const result = await client.callTool({
        name: 'x402_discover_services',
        arguments: { registry: 'https://registry.example.com/services' },
      });

      const parsed = parseToolResult(result);
      expect(parsed.status).toBe('success');
      const results = parsed.results as Array<Record<string, unknown>>;
      expect(results[0].error).toContain('503');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('x402_pay with inactive delegation should skip budget tracker init', async () => {
    vi.mocked(checkDelegation).mockResolvedValueOnce({
      isActive: false,
      delegate: '',
      remainingAmount: 0n,
      originalAmount: 0n,
      tokenMint: '',
      ownerTokenAccount: '',
    });

    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: 'https://api.example.com/data',
        passphrase: 'test-passphrase-12345',
        tokenAccount: '11111111111111111111111111111111',
      },
    });

    // Payment should still proceed (just without budget tracking)
    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.paymentRequired).toBe(true);
  });
});
