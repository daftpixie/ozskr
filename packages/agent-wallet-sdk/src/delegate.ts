import {
  type Address,
  type CompilableTransactionMessage,
  type TransactionSigner,
  assertIsAddress,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  createSolanaRpc,
  isSome,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  getBase64EncodedWireTransaction,
} from '@solana/kit';
import {
  getApproveCheckedInstruction,
  getTransferCheckedInstruction,
  getRevokeInstruction,
  fetchToken,
} from '@solana-program/token';
import type {
  DelegationConfig,
  DelegationStatus,
  TransferAsDelegateParams,
  RevokeDelegationParams,
  RpcConfig,
} from './types.js';
import { DelegationError, DelegationErrorCode } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validates an address string using @solana/kit's assertIsAddress.
 * @throws DelegationError with INVALID_ADDRESS code if validation fails.
 */
function validateAddress(value: string, label: string): asserts value is Address {
  try {
    assertIsAddress(value);
  } catch {
    throw new DelegationError(
      DelegationErrorCode.INVALID_ADDRESS,
      `Invalid ${label} address: ${value}`,
    );
  }
}

/**
 * Validates a token amount is positive.
 * @throws DelegationError with INVALID_AMOUNT code if amount <= 0.
 */
function validateAmount(amount: bigint, label: string): void {
  if (amount <= 0n) {
    throw new DelegationError(
      DelegationErrorCode.INVALID_AMOUNT,
      `${label} must be positive, got ${amount}`,
    );
  }
}

/**
 * Validates decimals is a non-negative integer within SPL token range (0-18).
 * @throws DelegationError with INVALID_DECIMALS code if out of range.
 */
function validateDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new DelegationError(
      DelegationErrorCode.INVALID_DECIMALS,
      `Decimals must be an integer 0-18, got ${decimals}`,
    );
  }
}

/** Creates an RPC client from config. */
function createRpc(config: RpcConfig) {
  return createSolanaRpc(config.endpoint);
}

/** Fetches the latest blockhash from the RPC. */
async function getLatestBlockhash(rpc: ReturnType<typeof createSolanaRpc>) {
  const { value } = await rpc.getLatestBlockhash().send();
  return value;
}

// ---------------------------------------------------------------------------
// createDelegation
// ---------------------------------------------------------------------------

/**
 * Builds an SPL `approveChecked` transaction message that grants an agent
 * delegate authority to spend tokens from the owner's token account.
 *
 * The returned transaction message is ready for signing — the owner's signer
 * is embedded in the instruction so `signTransactionMessageWithSigners` will
 * use it automatically.
 *
 * **Security**: Uses `approveChecked` (not `approve`) to enforce mint and
 * decimal validation on-chain.
 *
 * @param config - Delegation configuration (owner account, delegate, mint, cap, decimals)
 * @param rpcConfig - RPC endpoint configuration
 * @returns A compilable, signable transaction message
 *
 * @example
 * ```ts
 * const txMessage = await createDelegation(
 *   {
 *     ownerTokenAccount: address('...'),
 *     ownerSigner: myWalletSigner,
 *     delegateAddress: address('...'),
 *     tokenMint: address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
 *     maxAmount: 10_000_000n, // 10 USDC
 *     decimals: 6,
 *   },
 *   { endpoint: 'https://api.devnet.solana.com' },
 * );
 * ```
 */
export async function createDelegation(
  config: DelegationConfig,
  rpcConfig: RpcConfig,
): Promise<CompilableTransactionMessage> {
  // Validate all inputs
  validateAddress(config.ownerTokenAccount, 'ownerTokenAccount');
  validateAddress(config.delegateAddress, 'delegateAddress');
  validateAddress(config.tokenMint, 'tokenMint');
  validateAmount(config.maxAmount, 'maxAmount');
  validateDecimals(config.decimals);

  const rpc = createRpc(rpcConfig);
  const blockhash = await getLatestBlockhash(rpc);

  const approveInstruction = getApproveCheckedInstruction({
    source: config.ownerTokenAccount,
    mint: config.tokenMint,
    delegate: config.delegateAddress,
    owner: config.ownerSigner,
    amount: config.maxAmount,
    decimals: config.decimals,
  });

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(config.ownerSigner.address, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
    (tx) => appendTransactionMessageInstruction(approveInstruction, tx),
  );

  return transactionMessage;
}

// ---------------------------------------------------------------------------
// checkDelegation
// ---------------------------------------------------------------------------

/**
 * Queries the on-chain state of an SPL token account to determine the
 * current delegation status.
 *
 * Returns whether a delegation is active, who the delegate is, and
 * how much remains of the original approval.
 *
 * @param tokenAccount - The owner's SPL token account address
 * @param rpcConfig - RPC endpoint configuration
 * @returns Current delegation status from on-chain data
 *
 * @example
 * ```ts
 * const status = await checkDelegation(
 *   address('...'),
 *   { endpoint: 'https://api.devnet.solana.com' },
 * );
 * if (status.isActive) {
 *   console.log(`Delegate: ${status.delegate}, remaining: ${status.remainingAmount}`);
 * }
 * ```
 */
export async function checkDelegation(
  tokenAccount: Address,
  rpcConfig: RpcConfig,
): Promise<DelegationStatus> {
  validateAddress(tokenAccount, 'tokenAccount');

  const rpc = createRpc(rpcConfig);

  try {
    const account = await fetchToken(rpc, tokenAccount);
    const data = account.data;

    const delegateOption = data.delegate;
    const hasDelegate = isSome(delegateOption);

    return {
      isActive: hasDelegate && data.delegatedAmount > 0n,
      delegate: hasDelegate ? delegateOption.value : null,
      remainingAmount: data.delegatedAmount,
      originalAmount: data.delegatedAmount,
      tokenMint: data.mint,
      ownerTokenAccount: tokenAccount,
    };
  } catch (error) {
    if (error instanceof DelegationError) throw error;
    throw new DelegationError(
      DelegationErrorCode.RPC_ERROR,
      `Failed to fetch token account ${tokenAccount}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// transferAsDelegate
// ---------------------------------------------------------------------------

/**
 * Builds, signs, and returns a `transferChecked` transaction where the agent
 * keypair acts as the delegate authority.
 *
 * **Security**:
 * - Uses `transferChecked` (not `transfer`) to enforce mint and decimal validation
 * - Checks on-chain delegation status before building the transaction
 * - Simulates the transaction before returning it
 *
 * @param params - Transfer parameters (delegate signer, source, destination, amount, etc.)
 * @param rpcConfig - RPC endpoint configuration
 * @returns The transaction signature after successful submission
 *
 * @throws DelegationError with INSUFFICIENT_DELEGATION if amount > remaining delegation
 * @throws DelegationError with NO_ACTIVE_DELEGATION if no delegation exists
 * @throws DelegationError with SIMULATION_FAILED if transaction simulation fails
 *
 * @example
 * ```ts
 * const signature = await transferAsDelegate(
 *   {
 *     delegateSigner: agentKeypairSigner,
 *     sourceTokenAccount: address('...'),
 *     destinationTokenAccount: address('...'),
 *     amount: 1_000_000n, // 1 USDC
 *     decimals: 6,
 *     tokenMint: address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
 *     feePayer: agentKeypairSigner,
 *   },
 *   { endpoint: 'https://api.devnet.solana.com' },
 * );
 * ```
 */
export async function transferAsDelegate(
  params: TransferAsDelegateParams,
  rpcConfig: RpcConfig,
): Promise<string> {
  // Validate all addresses
  validateAddress(params.sourceTokenAccount, 'sourceTokenAccount');
  validateAddress(params.destinationTokenAccount, 'destinationTokenAccount');
  validateAddress(params.tokenMint, 'tokenMint');
  validateAmount(params.amount, 'amount');
  validateDecimals(params.decimals);

  const rpc = createRpc(rpcConfig);

  // Check on-chain delegation before building transaction
  const status = await checkDelegation(params.sourceTokenAccount, rpcConfig);

  if (!status.isActive) {
    throw new DelegationError(
      DelegationErrorCode.NO_ACTIVE_DELEGATION,
      `No active delegation on token account ${params.sourceTokenAccount}`,
    );
  }

  if (status.remainingAmount < params.amount) {
    throw new DelegationError(
      DelegationErrorCode.INSUFFICIENT_DELEGATION,
      `Insufficient delegation: requested ${params.amount}, remaining ${status.remainingAmount}`,
    );
  }

  const blockhash = await getLatestBlockhash(rpc);

  const transferInstruction = getTransferCheckedInstruction({
    source: params.sourceTokenAccount,
    mint: params.tokenMint,
    destination: params.destinationTokenAccount,
    authority: params.delegateSigner,
    amount: params.amount,
    decimals: params.decimals,
  });

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(params.feePayer.address, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
    (tx) => appendTransactionMessageInstruction(transferInstruction, tx),
  );

  // Sign the transaction (signers are auto-extracted from instruction accounts)
  const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);

  // Encode for RPC submission
  const encodedTx = getBase64EncodedWireTransaction(signedTransaction);

  // Simulate before submission
  try {
    const simResult = await rpc.simulateTransaction(encodedTx, { encoding: 'base64' }).send();
    if (simResult.value.err) {
      throw new DelegationError(
        DelegationErrorCode.SIMULATION_FAILED,
        `Transaction simulation failed: ${JSON.stringify(simResult.value.err)}`,
      );
    }
  } catch (error) {
    if (error instanceof DelegationError) throw error;
    throw new DelegationError(
      DelegationErrorCode.SIMULATION_FAILED,
      `Simulation request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Submit the transaction
  try {
    const signature = getSignatureFromTransaction(signedTransaction);
    await rpc.sendTransaction(encodedTx, { encoding: 'base64' }).send();
    return signature;
  } catch (error) {
    throw new DelegationError(
      DelegationErrorCode.RPC_ERROR,
      `Failed to send transaction: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// revokeDelegation
// ---------------------------------------------------------------------------

/**
 * Builds an SPL `revoke` transaction message that removes all delegate
 * authority from the owner's token account.
 *
 * The returned transaction message is ready for signing — the owner's signer
 * is embedded in the instruction.
 *
 * @param params - Revocation parameters (owner signer, token account)
 * @param rpcConfig - RPC endpoint configuration
 * @returns A compilable, signable transaction message
 *
 * @example
 * ```ts
 * const txMessage = await revokeDelegation(
 *   {
 *     ownerSigner: myWalletSigner,
 *     tokenAccount: address('...'),
 *   },
 *   { endpoint: 'https://api.devnet.solana.com' },
 * );
 * ```
 */
export async function revokeDelegation(
  params: RevokeDelegationParams,
  rpcConfig: RpcConfig,
): Promise<CompilableTransactionMessage> {
  validateAddress(params.tokenAccount, 'tokenAccount');

  const rpc = createRpc(rpcConfig);
  const blockhash = await getLatestBlockhash(rpc);

  const revokeInstruction = getRevokeInstruction({
    source: params.tokenAccount,
    owner: params.ownerSigner,
  });

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(params.ownerSigner.address, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
    (tx) => appendTransactionMessageInstruction(revokeInstruction, tx),
  );

  return transactionMessage;
}
