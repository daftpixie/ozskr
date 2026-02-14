import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
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

// ---------------------------------------------------------------------------
// Server Factory
// ---------------------------------------------------------------------------

/**
 * Creates and configures the x402-solana-mcp MCP server with all 8 tools
 * registered as type-safe stubs.
 *
 * Each tool has a complete Zod input schema for validation. The actual
 * implementations will be wired in Week 2 of the sprint.
 *
 * @param _config - Server configuration (used by implementations, not stubs)
 * @returns Configured McpServer instance ready for transport connection
 */
export function createServer(_config: Config): McpServer {
  const server = new McpServer({
    name: 'x402-solana-mcp',
    version: '0.1.0-beta',
  });

  // -------------------------------------------------------------------------
  // Tool 1: x402_setup_agent
  // -------------------------------------------------------------------------
  server.tool(
    'x402_setup_agent',
    'Generate an agent keypair and display the public key for delegation setup',
    {
      outputPath: z
        .string()
        .optional()
        .describe('Path to save the keypair file (defaults to AGENT_KEYPAIR_PATH)'),
      force: z
        .boolean()
        .default(false)
        .describe('Overwrite existing keypair if present'),
    },
    async () => stubResult('x402_setup_agent'),
  );

  // -------------------------------------------------------------------------
  // Tool 2: x402_check_delegation
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
    async () => stubResult('x402_check_delegation'),
  );

  // -------------------------------------------------------------------------
  // Tool 3: x402_pay
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
  // Tool 4: x402_check_balance
  // -------------------------------------------------------------------------
  server.tool(
    'x402_check_balance',
    'Check agent token balances including delegated and owned amounts',
    {
      tokenMint: z
        .string()
        .optional()
        .describe('Specific token mint to check (defaults to USDC)'),
    },
    async () => stubResult('x402_check_balance'),
  );

  // -------------------------------------------------------------------------
  // Tool 5: x402_revoke_delegation
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
    async () => stubResult('x402_revoke_delegation'),
  );

  // -------------------------------------------------------------------------
  // Tool 6: x402_transaction_history
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
  // Tool 7: x402_discover_services
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
  // Tool 8: x402_estimate_cost
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

export { stubResult, errorResult };
