/**
 * Agent Delegation Module
 *
 * Exports all named exports from the delegation subsystem.
 * Provides @solana/kit-based SPL token delegation utilities:
 *   - PDA derivation
 *   - On-chain status queries (single + batch)
 *   - Transaction builders (approve, revoke, close, sweep-and-close, setup)
 *   - Validation helpers
 *   - Shared types and program constants
 */

export {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  type AgentDelegationConfig,
  type AgentDelegationStatus,
  type CreateAgentAccountResult,
} from './types';

export {
  DelegationValidationError,
  validateTokenProgramId,
  validatePdaDerivation,
  validateDelegateNotOwner,
  validateAmountBigInt,
} from './validate';

export {
  type DerivedAgentTokenAccount,
  deriveAgentTokenAccount,
} from './derive-agent-token-account';

export {
  checkAgentDelegation,
  checkAllAgentDelegations,
} from './check-agent-delegation';

export {
  type ApproveAgentDelegationParams,
  type ApproveAgentDelegationResult,
  approveAgentDelegation,
} from './approve-agent-delegation';

export {
  type RevokeAgentDelegationParams,
  revokeAgentDelegation,
} from './revoke-agent-delegation';

export {
  type CloseAgentTokenAccountParams,
  closeAgentTokenAccount,
} from './close-agent-token-account';

export {
  type SweepAndCloseParams,
  sweepAndClose,
} from './sweep-and-close';

export {
  type SetupAgentDelegationParams,
  type SetupAgentDelegationResult,
  setupAgentDelegation,
} from './setup-agent-delegation';
