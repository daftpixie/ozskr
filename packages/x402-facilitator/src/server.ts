import { Hono } from 'hono';
import { createSolanaRpc, type KeyPairSigner } from '@solana/kit';
import { x402Facilitator } from '@x402/core/facilitator';
import { toFacilitatorSvmSigner, SOLANA_DEVNET_CAIP2, SOLANA_MAINNET_CAIP2, SOLANA_TESTNET_CAIP2 } from '@x402/svm';
import { registerExactSvmScheme } from '@x402/svm/exact/facilitator';
import type { Network } from '@x402/core/types';
import { createReplayGuard } from './replay.js';
import { wireGovernanceHooks, type GovernanceHookDeps, type GovernanceResources } from './governance.js';
import { createOfacScreener } from './governance/ofac-screening.js';
import { createCircuitBreaker } from './governance/circuit-breaker.js';
import { createBudgetEnforcer } from './governance/budget-enforce.js';
import { GasManager } from './settlement/gas-manager.js';
import { ConsoleAuditLogger } from './audit/logger.js';
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

/**
 * Creates a governance-aware x402 facilitator Hono application.
 *
 * Async because OFAC screener loads the blocklist from disk at startup.
 * All governance modules are instantiated based on feature flags in config.
 */
export async function createFacilitatorApp(config: Config, signer: KeyPairSigner): Promise<FacilitatorApp> {
  const facilitator = new x402Facilitator();

  // Register Solana scheme
  const svmSigner = toFacilitatorSvmSigner(signer, {
    defaultRpcUrl: config.solanaRpcUrl,
  });
  const caip2 = getNetworkCaip2(config.solanaNetwork);
  registerExactSvmScheme(facilitator, { signer: svmSigner, networks: caip2 });

  // ---------------------------------------------------------------------------
  // Instantiate governance deps based on feature flags
  // ---------------------------------------------------------------------------
  const governance = config.governance;
  const deps: GovernanceHookDeps = {};
  const activeModules: string[] = [];

  // OFAC screener (async — loads blocklist from file)
  if (governance.ofacEnabled) {
    deps.ofacScreener = await createOfacScreener(
      governance.ofacBlocklistPath,
      governance.ofacFailClosed,
    );
    activeModules.push(`ofac(list=${deps.ofacScreener.listSize()}, failClosed=${governance.ofacFailClosed})`);
  }

  // Circuit breaker with velocity tracking
  if (governance.circuitBreakerEnabled) {
    deps.circuitBreaker = createCircuitBreaker(governance.circuitBreaker);
    activeModules.push(`circuitBreaker(maxRecipient/min=${governance.circuitBreaker.maxSameRecipientPerMinute})`);
  }

  // Budget enforcer (cumulative spend tracking)
  if (governance.budgetEnforceEnabled) {
    deps.budgetEnforcer = createBudgetEnforcer();
    activeModules.push('budgetEnforcer');
  }

  // Delegation RPC (uses Solana RPC for jsonParsed account lookups)
  if (governance.delegationCheckEnabled) {
    const rpc = createSolanaRpc(config.solanaRpcUrl);
    deps.delegationRpc = rpc as unknown as GovernanceHookDeps['delegationRpc'];
    activeModules.push('delegationCheck');
  }

  // Audit logger (always enabled — structured JSON to stdout)
  deps.auditLogger = new ConsoleAuditLogger();
  activeModules.push('auditLogger');

  // Gas manager (monitoring only — not part of governance hooks, used by health check)
  const gasManager = new GasManager(
    createSolanaRpc(config.solanaRpcUrl) as unknown as import('./settlement/gas-manager.js').GasRpc,
    signer.address as string,
    governance.gasAlertThresholdSol,
  );

  // ---------------------------------------------------------------------------
  // Wire governance hooks into facilitator lifecycle
  // ---------------------------------------------------------------------------
  const replayGuard = createReplayGuard();
  const governanceResources: GovernanceResources = wireGovernanceHooks(
    facilitator,
    governance,
    replayGuard,
    deps,
  );

  const startTime = Date.now();

  // Build Hono app
  const app = new Hono();

  // Mount routes
  app.route('/', healthRoutes({ config, replayGuard, startTime, gasManager, activeModules }));
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

  // Log active governance modules at startup
  if (activeModules.length > 0) {
    process.stderr.write(`[facilitator] Governance modules active: ${activeModules.join(', ')}\n`);
  }

  return {
    app,
    facilitator,
    destroy() {
      replayGuard.destroy();
      governanceResources.destroy();
    },
  };
}
