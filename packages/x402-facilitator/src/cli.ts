#!/usr/bin/env node
import { serve } from '@hono/node-server';
import { loadConfigFromEnv } from './config.js';
import { createFacilitatorApp } from './server.js';
import {
  loadEncryptedKeypair,
  SCRYPT_PARAMS_FAST,
  SCRYPT_PARAMS_PRODUCTION,
} from '@ozskr/agent-wallet-sdk';

async function main() {
  const config = loadConfigFromEnv();

  const scryptParams = config.scryptMode === 'production'
    ? SCRYPT_PARAMS_PRODUCTION
    : SCRYPT_PARAMS_FAST;

  console.log(`[facilitator] Loading keypair from ${config.facilitatorKeypairPath}...`);
  const signer = await loadEncryptedKeypair(
    config.facilitatorKeypairPath,
    config.facilitatorPassphrase,
    scryptParams,
  );
  console.log(`[facilitator] Signer loaded: ${signer.address}`);

  const { app, destroy } = await createFacilitatorApp(config, signer);

  const server = serve({
    fetch: app.fetch,
    hostname: config.host,
    port: config.port,
  }, () => {
    console.log(`[facilitator] x402 facilitator running on http://${config.host}:${config.port}`);
    console.log(`[facilitator] Network: ${config.solanaNetwork}`);
    console.log(`[facilitator] Governance: rate=${config.governance.rateLimitPerMinute}/min`);
    if (config.governance.maxSettlementAmount) {
      console.log(`[facilitator] Max settlement: ${config.governance.maxSettlementAmount} base units`);
    }
  });

  function shutdown() {
    console.log('\n[facilitator] Shutting down...');
    destroy();
    server.close(() => {
      console.log('[facilitator] Server closed');
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[facilitator] Fatal error:', err);
  process.exit(1);
});
