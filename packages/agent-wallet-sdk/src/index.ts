export {
  createDelegation,
  checkDelegation,
  transferAsDelegate,
  revokeDelegation,
} from './delegate.js';

export {
  createBudgetTracker,
  type BudgetTracker,
} from './budget.js';

export {
  generateAgentKeypair,
  encryptKeypair,
  decryptKeypair,
  storeEncryptedKeypair,
  loadEncryptedKeypair,
  secureDelete,
} from './keypair.js';

export type {
  DelegationConfig,
  DelegationStatus,
  TransferAsDelegateParams,
  RevokeDelegationParams,
  BudgetCheckResult,
  SpendRecord,
  RpcConfig,
  ScryptParams,
  EncryptedKeypairFile,
  KeypairGenerationResult,
} from './types.js';

export {
  DelegationError,
  DelegationErrorCode,
  SCRYPT_PARAMS_PRODUCTION,
  SCRYPT_PARAMS_FAST,
} from './types.js';

// Key management (pluggable interface)
export type { KeyManager, KeyManagerConfig, TurnkeyKeyManagerOptions, CreateTurnkeyWalletOptions, TurnkeyWalletResult } from './key-management/index.js';
export { EncryptedJsonKeyManager, TurnkeyKeyManager, createKeyManager, createTurnkeyWallet } from './key-management/index.js';

// Constants
export {
  USDC_MINT_MAINNET,
  USDC_DECIMALS,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from './constants.js';

// Validation
export { validateTokenMint } from './validation.js';
