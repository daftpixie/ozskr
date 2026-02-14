import { type Address, type KeyPairSigner } from '@solana/kit';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  generateAgentKeypair,
  storeEncryptedKeypair,
  loadEncryptedKeypair,
  checkDelegation,
  DelegationError,
} from '@ozskr/agent-wallet-sdk';
import type { Config } from './config.js';

// ---------------------------------------------------------------------------
// Tool Result Helpers
// ---------------------------------------------------------------------------

function stubResult(toolName: string) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        status: 'not_implemented',
        tool: toolName,
        message: `${toolName} is a stub — implementation coming in Week 2`,
      }),
    }],
  };
}

function errorResult(code: string, message: string) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ error: code, message }),
    }],
    isError: true,
  };
}

function successResult(data: Record<string, unknown>) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ status: 'success', ...data }),
    }],
  };
}

// ---------------------------------------------------------------------------
// Server Factory
// ---------------------------------------------------------------------------

/**
 * Creates and configures the x402-solana-mcp MCP server with all 8 tools.
 *
 * 4 tools are wired to real SDK calls (setup_agent, check_delegation,
 * check_balance, revoke_delegation). 4 tools remain as stubs (pay,
 * transaction_history, discover_services, estimate_cost).
 *
 * @param config - Server configuration
 * @returns Configured McpServer instance ready for transport connection
 */
export function createServer(config: Config): McpServer {
  const server = new McpServer({
    name: 'x402-solana-mcp',
    version: '0.1.0-beta',
  });

  // Closure-scoped cached signer persists across tool calls within a session
  let cachedSigner: KeyPairSigner | null = null;

  // -------------------------------------------------------------------------
  // Tool 1: x402_setup_agent (WIRED)
  // -------------------------------------------------------------------------
  server.tool(
    'x402_setup_agent',
    'Generate an agent keypair and display the public key for delegation setup',
    {
      passphrase: z
        .string()
        .min(12, 'Passphrase must be at least 12 characters')
        .describe('Passphrase to encrypt the agent keypair at rest'),
      outputPath: z
        .string()
        .optional()
        .describe('Path to save the keypair file (defaults to AGENT_KEYPAIR_PATH)'),
      force: z
        .boolean()
        .default(false)
        .describe('Overwrite existing keypair if present'),
    },
    async ({ passphrase, outputPath, force }) => {
      try {
        const { signer, keypairBytes } = await generateAgentKeypair();
        const savePath = outputPath ?? config.agentKeypairPath;

        try {
          await storeEncryptedKeypair(keypairBytes, passphrase, savePath, force);
        } finally {
          keypairBytes.fill(0);
        }

        cachedSigner = signer;

        return successResult({
          agentAddress: signer.address,
          keypairPath: savePath,
          message: 'Agent keypair generated and encrypted. Fund this address with SOL for transaction fees, then set up an SPL token delegation.',
        });
      } catch (error) {
        if (error instanceof DelegationError) {
          return errorResult(error.code, error.message);
        }
        return errorResult('SETUP_FAILED', error instanceof Error ? error.message : String(error));
      }
    },
  );

  // -------------------------------------------------------------------------
  // Tool 2: x402_check_delegation (WIRED)
  // -------------------------------------------------------------------------
  server.tool(
    'x402_check_delegation',
    'Check current delegated balance and spending cap for the agent',
    {
      tokenAccount: z
        .string()
        .min(32)
        .describe('Owner SPL token account address'),
    },
    async ({ tokenAccount }) => {
      try {
        const status = await checkDelegation(
          tokenAccount as Address,
          { endpoint: config.solanaRpcUrl },
        );

        return successResult({
          isActive: status.isActive,
          delegate: status.delegate,
          remainingAmount: status.remainingAmount.toString(),
          originalAmount: status.originalAmount.toString(),
          tokenMint: status.tokenMint,
          ownerTokenAccount: status.ownerTokenAccount,
        });
      } catch (error) {
        if (error instanceof DelegationError) {
          return errorResult(error.code, error.message);
        }
        return errorResult('CHECK_FAILED', error instanceof Error ? error.message : String(error));
      }
    },
  );

  // -------------------------------------------------------------------------
  // Tool 3: x402_pay (STUB)
  // -------------------------------------------------------------------------
  server.tool(
    'x402_pay',
    'Make an x402 payment on Solana as a delegate',
    {
      url: z
        .string()
        .url()
        .describe('The x402-enabled endpoint URL'),
      method: z
        .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
        .default('GET')
        .describe('HTTP method for the request'),
      headers: z
        .record(z.string())
        .optional()
        .describe('Additional HTTP headers to include'),
      body: z
        .string()
        .optional()
        .describe('Request body for POST/PUT/PATCH requests'),
      maxAmount: z
        .string()
        .optional()
        .describe('Maximum payment amount in base units (rejects if cost exceeds this)'),
    },
    async () => stubResult('x402_pay'),
  );

  // -------------------------------------------------------------------------
  // Tool 4: x402_check_balance (WIRED)
  // -------------------------------------------------------------------------
  server.tool(
    'x402_check_balance',
    'Check agent token balances including delegated and owned amounts',
    {
      passphrase: z
        .string()
        .min(12, 'Passphrase must be at least 12 characters')
        .describe('Passphrase to decrypt the agent keypair (needed to get agent address)'),
      tokenMint: z
        .string()
        .optional()
        .describe('Specific token mint to check (defaults to USDC)'),
    },
    async ({ passphrase }) => {
      try {
        if (!cachedSigner) {
          cachedSigner = await loadEncryptedKeypair(
            config.agentKeypairPath,
            passphrase,
          );
        }

        return successResult({
          agentAddress: cachedSigner.address,
          message: 'Agent signer loaded. Full token balance queries will be available in a future release.',
        });
      } catch (error) {
        if (error instanceof DelegationError) {
          return errorResult(error.code, error.message);
        }
        return errorResult('BALANCE_CHECK_FAILED', error instanceof Error ? error.message : String(error));
      }
    },
  );

  // -------------------------------------------------------------------------
  // Tool 5: x402_revoke_delegation (WIRED)
  // -------------------------------------------------------------------------
  server.tool(
    'x402_revoke_delegation',
    'Revoke the agent spending authority on a token account (owner-only operation)',
    {
      tokenAccount: z
        .string()
        .min(32)
        .describe('Token account to revoke delegation from'),
    },
    async ({ tokenAccount }) => {
      try {
        const status = await checkDelegation(
          tokenAccount as Address,
          { endpoint: config.solanaRpcUrl },
        );

        if (!status.isActive) {
          return successResult({
            isActive: false,
            message: 'No active delegation found on this token account. Nothing to revoke.',
          });
        }

        return successResult({
          isActive: true,
          delegate: status.delegate,
          remainingAmount: status.remainingAmount.toString(),
          message: 'Active delegation found. The token account owner must sign a revoke transaction using their wallet. Use @ozskr/agent-wallet-sdk revokeDelegation() with the owner signer.',
        });
      } catch (error) {
        if (error instanceof DelegationError) {
          return errorResult(error.code, error.message);
        }
        return errorResult('REVOKE_CHECK_FAILED', error instanceof Error ? error.message : String(error));
      }
    },
  );

  // -------------------------------------------------------------------------
  // Tool 6: x402_transaction_history (STUB)
  // -------------------------------------------------------------------------
  server.tool(
    'x402_transaction_history',
    'Query on-chain transaction history for the agent keypair',
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(10)
        .describe('Maximum number of transactions to return'),
      before: z
        .string()
        .optional()
        .describe('Transaction signature to paginate before'),
    },
    async () => stubResult('x402_transaction_history'),
  );

  // -------------------------------------------------------------------------
  // Tool 7: x402_discover_services (STUB)
  // -------------------------------------------------------------------------
  server.tool(
    'x402_discover_services',
    'Discover x402-enabled endpoints by probing a URL or querying a registry',
    {
      url: z
        .string()
        .url()
        .optional()
        .describe('URL to probe for x402 support'),
      registry: z
        .string()
        .url()
        .optional()
        .describe('x402 service registry URL to query'),
    },
    async () => stubResult('x402_discover_services'),
  );

  // -------------------------------------------------------------------------
  // Tool 8: x402_estimate_cost (STUB)
  // -------------------------------------------------------------------------
  server.tool(
    'x402_estimate_cost',
    'Estimate the cost of an x402 request before making a payment',
    {
      url: z
        .string()
        .url()
        .describe('The x402-enabled endpoint URL to estimate'),
      method: z
        .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
        .default('GET')
        .describe('HTTP method for the request'),
    },
    async () => stubResult('x402_estimate_cost'),
  );

  return server;
}

export { stubResult, errorResult, successResult };
