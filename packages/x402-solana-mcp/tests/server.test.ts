import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';
import type { Config } from '../src/config.js';

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
// Tool Stub Response Tests
// ---------------------------------------------------------------------------

describe('tool stubs', () => {
  let client: Client;

  beforeEach(async () => {
    const setup = await createTestClient();
    client = setup.client;
  });

  it('x402_setup_agent should return stub response', async () => {
    const result = await client.callTool({
      name: 'x402_setup_agent',
      arguments: {},
    });

    expect(result.content).toHaveLength(1);
    const text = (result.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.status).toBe('not_implemented');
    expect(parsed.tool).toBe('x402_setup_agent');
  });

  it('x402_check_delegation should return stub response', async () => {
    const result = await client.callTool({
      name: 'x402_check_delegation',
      arguments: {
        tokenAccount: '11111111111111111111111111111111',
      },
    });

    const text = (result.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.status).toBe('not_implemented');
    expect(parsed.tool).toBe('x402_check_delegation');
  });

  it('x402_pay should return stub response', async () => {
    const result = await client.callTool({
      name: 'x402_pay',
      arguments: {
        url: 'https://api.example.com/resource',
      },
    });

    const text = (result.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.status).toBe('not_implemented');
    expect(parsed.tool).toBe('x402_pay');
  });

  it('x402_check_balance should return stub response', async () => {
    const result = await client.callTool({
      name: 'x402_check_balance',
      arguments: {},
    });

    const text = (result.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.status).toBe('not_implemented');
    expect(parsed.tool).toBe('x402_check_balance');
  });

  it('x402_revoke_delegation should return stub response', async () => {
    const result = await client.callTool({
      name: 'x402_revoke_delegation',
      arguments: {
        tokenAccount: '11111111111111111111111111111111',
      },
    });

    const text = (result.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.status).toBe('not_implemented');
    expect(parsed.tool).toBe('x402_revoke_delegation');
  });

  it('x402_transaction_history should return stub response', async () => {
    const result = await client.callTool({
      name: 'x402_transaction_history',
      arguments: {},
    });

    const text = (result.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.status).toBe('not_implemented');
    expect(parsed.tool).toBe('x402_transaction_history');
  });

  it('x402_discover_services should return stub response', async () => {
    const result = await client.callTool({
      name: 'x402_discover_services',
      arguments: {},
    });

    const text = (result.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);
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

    const text = (result.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);
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
    const text = (result.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);
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

    // Should succeed with defaults
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
