export { createFacilitatorApp, type FacilitatorApp } from './server.js';
export {
  ConfigSchema,
  loadConfigFromEnv,
  GovernanceSchema,
  CircuitBreakerSchema,
  type Config,
  type GovernanceConfig,
  type CircuitBreakerConfig,
} from './config.js';
export { createReplayGuard, type ReplayGuard } from './replay.js';
export {
  checkTokenAllowlist,
  checkRecipientAllowlist,
  checkAmountCap,
  checkRateLimit,
  type GovernanceCheckResult,
} from './governance.js';

// Day 5: On-chain governance
export { checkDelegation, type DelegationCheckResult, type DelegationRpc } from './governance/delegation-check.js';
export { createBudgetEnforcer, type BudgetEnforcer, type BudgetEnforcementResult } from './governance/budget-enforce.js';

// Day 6: Compliance + adversarial defense
export { createOfacScreener, type OfacScreener, type OfacScreeningResult } from './governance/ofac-screening.js';
export { createCircuitBreaker, type CircuitBreaker, type CircuitBreakerResult } from './governance/circuit-breaker.js';
export { validateBlockhashFreshness, type BlockhashValidationResult, type BlockhashRpc } from './settlement/blockhash-validator.js';

// Day 7: Settlement pipeline
export { simulateAndVerify, parseTransferInstructions, type SimulationResult, type SimulationRequirements, type SimulationRpc } from './settlement/simulate.js';
export { GasManager, type GasManagerStatus, type GasRpc } from './settlement/gas-manager.js';
export { ConsoleAuditLogger, InMemoryAuditLogger, type AuditLogger, type AuditLogEntry } from './audit/logger.js';

// Request schemas
export { VerifyRequestSchema, SettleRequestSchema, type VerifyRequest, type SettleRequest } from './schemas.js';
