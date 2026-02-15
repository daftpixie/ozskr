import { Hono } from 'hono';
import type { KeyPairSigner } from '@solana/kit';
import { x402Facilitator } from '@x402/core/facilitator';
import { toFacilitatorSvmSigner, SOLANA_DEVNET_CAIP2, SOLANA_MAINNET_CAIP2, SOLANA_TESTNET_CAIP2 } from '@x402/svm';
import { registerExactSvmScheme } from '@x402/svm/exact/facilitator';
import type { Network } from '@x402/core/types';
import { createReplayGuard } from './replay.js';
import { wireGovernanceHooks, type GovernanceResources } from './governance.js';
import { healthRoutes } from './routes/health.js';
import { supportedRoutes } from './routes/supported.js';
import { verifyRoutes } from './routes/verify.js';
import { settleRoutes } from './routes/settle.js';
import type { Config } from './config.js';

// ---------------------------------------------------------------------------
// Network Mapping
// ---------------------------------------------------------------------------

function getNetworkCaip2(network: string): Network {
  switch (network) {
    case 'mainnet-beta':
      return SOLANA_MAINNET_CAIP2 as Network;
    case 'testnet':
      return SOLANA_TESTNET_CAIP2 as Network;
    default:
      return SOLANA_DEVNET_CAIP2 as Network;
  }
}

// ---------------------------------------------------------------------------
// Server Factory
// ---------------------------------------------------------------------------

export interface FacilitatorApp {
  app: Hono;
  facilitator: x402Facilitator;
  destroy: () => void;
}

export function createFacilitatorApp(config: Config, signer: KeyPairSigner): FacilitatorApp {
  const facilitator = new x402Facilitator();

  // Register Solana scheme
  const svmSigner = toFacilitatorSvmSigner(signer, {
    defaultRpcUrl: config.solanaRpcUrl,
  });
  const caip2 = getNetworkCaip2(config.solanaNetwork);
  registerExactSvmScheme(facilitator, { signer: svmSigner, networks: caip2 });

  // Replay guard and governance
  const replayGuard = createReplayGuard();
  const governanceResources: GovernanceResources = wireGovernanceHooks(
    facilitator,
    config.governance,
    replayGuard,
  );

  const startTime = Date.now();

  // Build Hono app
  const app = new Hono();

  // Mount routes
  app.route('/', healthRoutes({ config, replayGuard, startTime }));
  app.route('/', supportedRoutes({ facilitator }));
  app.route('/', verifyRoutes({ facilitator }));
  app.route('/', settleRoutes({ facilitator }));

  // Global error handler
  app.onError((err, c) => {
    if (err.name === 'ZodError') {
      return c.json({ error: 'VALIDATION_ERROR', message: err.message }, 400);
    }
    const statusCode = 'statusCode' in err ? (err as { statusCode: number }).statusCode : 500;
    return c.json(
      { error: 'INTERNAL_ERROR', message: err.message },
      statusCode as 500,
    );
  });

  return {
    app,
    facilitator,
    destroy() {
      replayGuard.destroy();
      governanceResources.destroy();
    },
  };
}
