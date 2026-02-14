import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Config } from '../../src/config.js';

const MOCK_AGENT_ADDRESS = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const MOCK_OWNER_TOKEN_ACCOUNT = '11111111111111111111111111111111';
const MOCK_TOKEN_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

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
    tokenMint: MOCK_TOKEN_MINT,
    ownerTokenAccount: MOCK_OWNER_TOKEN_ACCOUNT,
  })),
  revokeDelegation: vi.fn(async () => ({
    signature: 'revoke-sig-123',
    delegate: MOCK_AGENT_ADDRESS,
    tokenAccount: MOCK_OWNER_TOKEN_ACCOUNT,
  })),
  createBudgetTracker: vi.fn(() => ({
    checkBudget: vi.fn(async () => ({
      remainingOnChain: 50_000_000n,
      spent: 0n,
      available: 50_000_000n,
    })),
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

vi.mock('../../src/lib/x402-client.js', () => ({
  makeX402Request: vi.fn(async () => ({
    paymentRequired: true,
    requirements: [
      {
        version: 2,
        scheme: 'exact',
        network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        amount: '1000000',
        asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        payTo: MOCK_AGENT_ADDRESS,
        maxTimeoutSeconds: 30,
        raw: {},
      },
    ],
    rawPaymentRequired: {},
  })),
  retryWithPayment: vi.fn(async () => ({
    response: { status: 200, ok: true, text: async () => 'Paid content' },
    settled: true,
    transactionSignature: 'paid-sig-123',
  })),
  validateRequirement: vi.fn(() => null),
  discoverX402Services: vi.fn(async () => ({
    services: [
      {
        url: 'https://api.example.com/protected',
        description: 'Example service',
        priceUSDC: 1.0,
      },
    ],
  })),
  estimateX402Cost: vi.fn(async () => ({
    requirements: [
      {
        version: 2,
        scheme: 'exact',
        network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        amount: '1000000',
        asset: MOCK_TOKEN_MINT,
        payTo: MOCK_AGENT_ADDRESS,
        maxTimeoutSeconds: 30,
        raw: {},
      },
    ],
  })),
}));

vi.mock('../../src/lib/facilitator.js', () => ({
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

vi.mock('../../src/lib/history.js', () => ({
  appendTransaction: vi.fn(async () => undefined),
  queryHistory: vi.fn(async () => [
    {
      timestamp: new Date().toISOString(),
      url: 'https://api.example.com/protected',
      method: 'GET',
      amountPaid: '1000000',
      tokenMint: MOCK_TOKEN_MINT,
      signature: 'paid-sig-123',
      settled: true,
    },
  ]),
}));

const { createServer } = await import('../../src/server.js');

const TEST_CONFIG: Config = {
  solanaRpcUrl: 'https://api.devnet.solana.com',
  agentKeypairPath: '/tmp/test-keypair.json',
  solanaNetwork: 'devnet',
  logLevel: 'error',
};

describe('MCP Client Integration', () => {
  let client: Client;

  beforeEach(async () => {
    vi.clearAllMocks();
    const server = createServer(TEST_CONFIG);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'integration-test', version: '1.0.0' });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  describe('Tool Discovery', () => {
    it('should list all 8 tools', async () => {
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

    it('should have valid JSON schemas on all tools', async () => {
      const result = await client.listTools();

      result.tools.forEach((tool) => {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      });
    });

    it('should have required fields marked in schemas', async () => {
      const result = await client.listTools();

      const setupAgent = result.tools.find((t) => t.name === 'x402_setup_agent');
      expect(setupAgent?.inputSchema.required).toContain('passphrase');

      const checkDelegation = result.tools.find((t) => t.name === 'x402_check_delegation');
      expect(checkDelegation?.inputSchema.required).toContain('tokenAccount');

      const checkBalance = result.tools.find((t) => t.name === 'x402_check_balance');
      expect(checkBalance?.inputSchema.required).toContain('passphrase');

      const revokeDelegation = result.tools.find((t) => t.name === 'x402_revoke_delegation');
      expect(revokeDelegation?.inputSchema.required).toContain('tokenAccount');

      const pay = result.tools.find((t) => t.name === 'x402_pay');
      expect(pay?.inputSchema.required).toEqual(
        expect.arrayContaining(['url', 'passphrase', 'tokenAccount'])
      );

      const estimateCost = result.tools.find((t) => t.name === 'x402_estimate_cost');
      expect(estimateCost?.inputSchema.required).toContain('url');
    });
  });

  describe('Tool Responsiveness', () => {
    it('x402_setup_agent should respond with success', async () => {
      const result = await client.callTool({
        name: 'x402_setup_agent',
        arguments: {
          passphrase: 'test-passphrase-12345',
          outputPath: '/tmp/test-agent.json',
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain(MOCK_AGENT_ADDRESS);
      expect(text).toContain('/tmp/test-agent.json');
    });

    it('x402_check_delegation should respond with delegation status', async () => {
      const result = await client.callTool({
        name: 'x402_check_delegation',
        arguments: {
          tokenAccount: MOCK_OWNER_TOKEN_ACCOUNT,
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('isActive');
      expect(text).toContain(MOCK_AGENT_ADDRESS);
      expect(text).toContain('50000000');
    });

    it('x402_check_balance should respond with agent address', async () => {
      const result = await client.callTool({
        name: 'x402_check_balance',
        arguments: {
          passphrase: 'test-passphrase-12345',
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain(MOCK_AGENT_ADDRESS);
    });

    it('x402_revoke_delegation should respond with delegation info', async () => {
      const result = await client.callTool({
        name: 'x402_revoke_delegation',
        arguments: {
          tokenAccount: MOCK_OWNER_TOKEN_ACCOUNT,
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('revoke-sig-123');
      expect(text).toContain(MOCK_AGENT_ADDRESS);
    });

    it('x402_pay should complete payment cycle', async () => {
      const result = await client.callTool({
        name: 'x402_pay',
        arguments: {
          url: 'https://api.example.com/protected',
          method: 'GET',
          passphrase: 'test-passphrase-12345',
          tokenAccount: MOCK_OWNER_TOKEN_ACCOUNT,
          maxAmount: '5000000',
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('paid-sig-123');
      expect(text).toContain('Paid content');
    });

    it('x402_transaction_history should respond with records', async () => {
      const result = await client.callTool({
        name: 'x402_transaction_history',
        arguments: {
          limit: 10,
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = (result.content[0] as { text: string }).text;
      // Should contain history records from the mock
      expect(text).toContain('api.example.com');
    });

    it('x402_discover_services should respond with message', async () => {
      const result = await client.callTool({
        name: 'x402_discover_services',
        arguments: {
          url: 'https://api.example.com',
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('services');
    });

    it('x402_estimate_cost should respond with requirements', async () => {
      const result = await client.callTool({
        name: 'x402_estimate_cost',
        arguments: {
          url: 'https://api.example.com/protected',
          method: 'GET',
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('requirements');
    });
  });

  describe('Error Handling', () => {
    it('should return isError for invalid inputs across all tools', async () => {
      const tools = [
        { name: 'x402_setup_agent', args: {} }, // missing passphrase
        { name: 'x402_check_delegation', args: {} }, // missing tokenAccount
        { name: 'x402_check_balance', args: {} }, // missing passphrase
        { name: 'x402_revoke_delegation', args: {} }, // missing tokenAccount
        { name: 'x402_pay', args: {} }, // missing url, passphrase, tokenAccount
        { name: 'x402_estimate_cost', args: {} }, // missing url
      ];

      for (const { name, args } of tools) {
        const result = await client.callTool({
          name,
          arguments: args,
        });

        expect(result.isError).toBe(true);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');

        const text = (result.content[0] as { text: string }).text;
        expect(text.toLowerCase()).toMatch(/error|invalid|required|missing/);
      }
    });

    it('should reject invalid passphrase length in x402_setup_agent', async () => {
      const result = await client.callTool({
        name: 'x402_setup_agent',
        arguments: {
          passphrase: 'short', // too short (min 12)
        },
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text.toLowerCase()).toContain('passphrase');
    });

    it('should reject invalid tokenAccount length in x402_check_delegation', async () => {
      const result = await client.callTool({
        name: 'x402_check_delegation',
        arguments: {
          tokenAccount: 'short', // too short (min 32)
        },
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text.toLowerCase()).toContain('tokenaccount');
    });

    it('should reject invalid URL in x402_pay', async () => {
      const result = await client.callTool({
        name: 'x402_pay',
        arguments: {
          url: 'not-a-url',
          passphrase: 'test-passphrase-12345',
          tokenAccount: MOCK_OWNER_TOKEN_ACCOUNT,
        },
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text.toLowerCase()).toMatch(/url|invalid/);
    });

    it('should reject invalid method enum in x402_pay', async () => {
      const result = await client.callTool({
        name: 'x402_pay',
        arguments: {
          url: 'https://api.example.com/protected',
          method: 'INVALID',
          passphrase: 'test-passphrase-12345',
          tokenAccount: MOCK_OWNER_TOKEN_ACCOUNT,
        },
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text.toLowerCase()).toMatch(/method|invalid/);
    });
  });
});
