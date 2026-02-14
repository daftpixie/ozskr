import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Config } from '../../src/config.js';
import { startServer, type TestServerHandle } from './test-x402-server.js';

// ---------------------------------------------------------------------------
// E2E Test Guard
// ---------------------------------------------------------------------------

/**
 * This test suite is skipped by default and only runs when E2E=1 is set.
 * It validates the full x402 payment cycle against a real HTTP server.
 *
 * Usage:
 *   E2E=1 pnpm test tests/e2e/devnet-payment.test.ts
 */
const SKIP_E2E = !process.env.E2E;

// ---------------------------------------------------------------------------
// Mocks (SDK and facilitator only, NOT x402-client)
// ---------------------------------------------------------------------------

const MOCK_AGENT_ADDRESS = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

// Mock the agent wallet SDK (no real keypairs in tests)
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

// Mock the facilitator (no real on-chain payments in e2e)
vi.mock('../../src/lib/facilitator.js', () => ({
  submitToFacilitator: vi.fn(async () => ({
    success: true,
    transactionSignature: 'e2e-facilitator-sig-' + Date.now(),
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

// Mock history (no real file writes in e2e)
vi.mock('../../src/lib/history.js', () => ({
  appendTransaction: vi.fn(async () => undefined),
  queryHistory: vi.fn(async () => []),
}));

// DO NOT mock x402-client — we want real HTTP requests to our test server
// Import server after mocks are set up
const { createServer } = await import('../../src/server.js');

// ---------------------------------------------------------------------------
// Test Config
// ---------------------------------------------------------------------------

const TEST_CONFIG: Config = {
  solanaRpcUrl: 'https://api.devnet.solana.com',
  agentKeypairPath: '/tmp/e2e-test-keypair.json',
  solanaNetwork: 'devnet',
  logLevel: 'error',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTestClient(config: Config = TEST_CONFIG) {
  const server = createServer(config);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: 'e2e-test-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, server };
}

function parseToolResult(result: { content: unknown[] }): Record<string, unknown> {
  const text = (result.content[0] as { type: string; text: string }).text;
  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// E2E Test Suite
// ---------------------------------------------------------------------------

describe.skipIf(SKIP_E2E)('x402 E2E Payment Flow (devnet)', () => {
  let testServer: TestServerHandle;
  let client: Client;

  beforeAll(async () => {
    // Start the local x402 test server
    testServer = await startServer();
    console.log(`[E2E] Test x402 server started on ${testServer.url}`);

    // Create MCP client connected to our server
    const setup = await createTestClient();
    client = setup.client;
  });

  afterAll(async () => {
    // Clean up test server
    if (testServer) {
      await testServer.close();
      console.log('[E2E] Test x402 server closed');
    }
  });

  // ---------------------------------------------------------------------------
  // Raw HTTP Tests (validate test server behavior)
  // ---------------------------------------------------------------------------

  it('test server responds with 402 to unauthenticated request', async () => {
    const response = await fetch(`${testServer.url}/data`);

    expect(response.status).toBe(402);
    expect(response.headers.get('X-Payment-Required')).toBeTruthy();

    const body = await response.json();
    expect(body.error).toBe('Payment Required');
  });

  it('test server responds with 200 to authenticated request', async () => {
    // Make a request with a payment signature header
    // The test server doesn't validate the signature, just checks for presence
    const response = await fetch(`${testServer.url}/data`, {
      headers: {
        'X-Payment-Signature': 'mock-payment-signature-base64',
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toContain('Premium content');
  });

  it('test server responds with 200 to free endpoint without payment', async () => {
    const response = await fetch(`${testServer.url}/free`);

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('Free content');
  });

  // ---------------------------------------------------------------------------
  // MCP Tool Tests (via x402-client with real HTTP)
  // ---------------------------------------------------------------------------

  it('x402_estimate_cost should detect 402 from local server', async () => {
    const result = await client.callTool({
      name: 'x402_estimate_cost',
      arguments: { url: `${testServer.url}/data` },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.paymentRequired).toBe(true);
    expect(parsed.options).toBeDefined();

    const options = parsed.options as Array<Record<string, unknown>>;
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].amount).toBe('1000000');
    expect(options[0].asset).toBe('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
    expect(options[0].payTo).toBe('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
  });

  it('x402_estimate_cost should show free access for free endpoint', async () => {
    const result = await client.callTool({
      name: 'x402_estimate_cost',
      arguments: { url: `${testServer.url}/free` },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.paymentRequired).toBe(false);
  });

  it('x402_discover_services should probe local server', async () => {
    const result = await client.callTool({
      name: 'x402_discover_services',
      arguments: { url: `${testServer.url}/data` },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.services).toBeDefined();

    const services = parsed.services as Array<Record<string, unknown>>;
    expect(services.length).toBeGreaterThan(0);
    expect(services[0].url).toContain(testServer.url);
    expect(services[0].acceptsPayment).toBe(true);
  });

  it('x402_pay should complete full payment cycle against local server', async () => {
    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: `${testServer.url}/data`,
        passphrase: 'e2e-test-passphrase-12345',
        tokenAccount: '11111111111111111111111111111111',
      },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.paymentRequired).toBe(true);
    expect(parsed.transactionSignature).toContain('e2e-facilitator-sig-');
    expect(parsed.amountPaid).toBe('1000000');
    expect(parsed.facilitator).toBe('cdp');

    // The content should be the JSON returned by the test server
    const content = parsed.content as string;
    expect(content).toContain('Premium content');
  });

  it('x402_pay should not require payment for free endpoint', async () => {
    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: `${testServer.url}/free`,
        passphrase: 'e2e-test-passphrase-12345',
        tokenAccount: '11111111111111111111111111111111',
      },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.paymentRequired).toBe(false);
    expect(parsed.content).toContain('Free content');
  });

  it('x402_pay should reject when maxAmount is too low', async () => {
    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: `${testServer.url}/data`,
        passphrase: 'e2e-test-passphrase-12345',
        tokenAccount: '11111111111111111111111111111111',
        maxAmount: '500000', // Less than the 1000000 required
      },
    });

    const parsed = parseToolResult(result);
    expect(parsed.error).toBe('AMOUNT_EXCEEDS_MAX');
    expect(parsed.message).toContain('exceeds maximum');
  });
});
