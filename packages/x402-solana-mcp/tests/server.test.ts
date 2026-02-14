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
// Wired Tool Tests
// ---------------------------------------------------------------------------

describe('wired tools', () => {
  let client: Client;

  beforeEach(async () => {
    vi.clearAllMocks();
    const setup = await createTestClient();
    client = setup.client;
  });

  it('x402_setup_agent should generate keypair and return address', async () => {
    const result = await client.callTool({
      name: 'x402_setup_agent',
      arguments: {
        passphrase: 'test-passphrase-12345',
      },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.agentAddress).toBe(MOCK_AGENT_ADDRESS);
    expect(parsed.keypairPath).toBe('/tmp/test-keypair.json');
    expect(parsed.message).toContain('generated and encrypted');
  });

  it('x402_setup_agent should use custom outputPath when provided', async () => {
    const result = await client.callTool({
      name: 'x402_setup_agent',
      arguments: {
        passphrase: 'test-passphrase-12345',
        outputPath: '/custom/path/keypair.json',
      },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.keypairPath).toBe('/custom/path/keypair.json');
  });

  it('x402_check_delegation should return delegation status', async () => {
    const result = await client.callTool({
      name: 'x402_check_delegation',
      arguments: {
        tokenAccount: '11111111111111111111111111111111',
      },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.isActive).toBe(true);
    expect(parsed.delegate).toBe(MOCK_AGENT_ADDRESS);
    expect(parsed.remainingAmount).toBe('50000000');
    expect(parsed.originalAmount).toBe('100000000');
  });

  it('x402_check_balance should return agent address', async () => {
    const result = await client.callTool({
      name: 'x402_check_balance',
      arguments: {
        passphrase: 'test-passphrase-12345',
      },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.agentAddress).toBe(MOCK_AGENT_ADDRESS);
    expect(typeof parsed.message).toBe('string');
  });

  it('x402_revoke_delegation should return delegation info with instructions', async () => {
    const result = await client.callTool({
      name: 'x402_revoke_delegation',
      arguments: {
        tokenAccount: '11111111111111111111111111111111',
      },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('success');
    expect(parsed.isActive).toBe(true);
    expect(parsed.delegate).toBe(MOCK_AGENT_ADDRESS);
    expect(parsed.message).toContain('owner must sign');
  });
});

// ---------------------------------------------------------------------------
// Stub Tool Tests
// ---------------------------------------------------------------------------

describe('stub tools', () => {
  let client: Client;

  beforeEach(async () => {
    const setup = await createTestClient();
    client = setup.client;
  });

  it('x402_pay should return stub response', async () => {
    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: 'https://api.example.com/resource',
      },
    });

    expect(result.isError).toBeUndefined();
    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('not_implemented');
    expect(parsed.tool).toBe('x402_pay');
  });

  it('x402_transaction_history should return stub response', async () => {
    const result = await client.callTool({
      name: 'x402_transaction_history',
      arguments: {},
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('not_implemented');
    expect(parsed.tool).toBe('x402_transaction_history');
  });

  it('x402_discover_services should return stub response', async () => {
    const result = await client.callTool({
      name: 'x402_discover_services',
      arguments: {},
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('not_implemented');
    expect(parsed.tool).toBe('x402_discover_services');
  });

  it('x402_estimate_cost should return stub response', async () => {
    const result = await client.callTool({
      name: 'x402_estimate_cost',
      arguments: {
        url: 'https://api.example.com/resource',
      },
    });

    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('not_implemented');
    expect(parsed.tool).toBe('x402_estimate_cost');
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
      arguments: {},
    });

    expect(result.isError).toBe(true);
  });

  it('x402_pay should reject invalid url', async () => {
    const result = await client.callTool({
      name: 'x402_pay',
      arguments: { url: 'not-a-url' },
    });

    expect(result.isError).toBe(true);
  });

  it('x402_pay should accept valid optional fields', async () => {
    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: 'https://api.example.com/resource',
        method: 'POST',
        body: '{"key": "value"}',
        maxAmount: '1000000',
        headers: { 'Content-Type': 'application/json' },
      },
    });

    expect(result.isError).toBeUndefined();
    const parsed = parseToolResult(result);
    expect(parsed.status).toBe('not_implemented');
  });

  it('x402_check_delegation should reject missing tokenAccount', async () => {
    const result = await client.callTool({
      name: 'x402_check_delegation',
      arguments: {},
    });

    expect(result.isError).toBe(true);
  });

  it('x402_check_delegation should reject short tokenAccount', async () => {
    const result = await client.callTool({
      name: 'x402_check_delegation',
      arguments: { tokenAccount: 'short' },
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

  it('x402_transaction_history should apply default limit', async () => {
    const result = await client.callTool({
      name: 'x402_transaction_history',
      arguments: {},
    });

    expect(result.isError).toBeUndefined();
  });

  it('x402_discover_services should accept no arguments', async () => {
    const result = await client.callTool({
      name: 'x402_discover_services',
      arguments: {},
    });

    expect(result.isError).toBeUndefined();
  });
});
