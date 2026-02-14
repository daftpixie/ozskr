#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfigFromEnv } from './config.js';
import { createServer } from './server.js';

// ---------------------------------------------------------------------------
// CLI Entry Point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Load and validate configuration from environment variables
  let config;
  try {
    config = loadConfigFromEnv();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Configuration error: ${message}\n`);
    process.stderr.write('\nRequired environment variables:\n');
    process.stderr.write('  SOLANA_RPC_URL         Solana RPC endpoint URL\n');
    process.stderr.write('  AGENT_KEYPAIR_PATH     Path to agent keypair JSON file\n');
    process.stderr.write('\nOptional environment variables:\n');
    process.stderr.write('  SOLANA_NETWORK         devnet | mainnet-beta | testnet (default: devnet)\n');
    process.stderr.write('  X402_FACILITATOR_URL   x402 facilitator endpoint\n');
    process.stderr.write('  LOG_LEVEL              debug | info | warn | error (default: info)\n');
    process.exit(1);
  }

  // Create the MCP server with all tools registered
  const server = createServer(config);

  // Connect via stdio transport (default for MCP CLI servers)
  const transport = new StdioServerTransport();
  await server.connect(transport);

  if (config.logLevel === 'debug' || config.logLevel === 'info') {
    process.stderr.write(
      `x402-solana-mcp v0.1.0-beta started (network: ${config.solanaNetwork})\n`,
    );
  }
}

main().catch((error) => {
  process.stderr.write(`Fatal error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
