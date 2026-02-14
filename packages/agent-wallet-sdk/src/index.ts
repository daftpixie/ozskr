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
