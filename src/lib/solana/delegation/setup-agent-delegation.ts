/**
 * Combined setup transaction for agent delegation.
 *
 * Builds a single transaction containing four instructions:
 *   1. SystemProgram.createAccount — allocates the agent token account PDA
 *   2. SPL Token InitializeAccount2 — initializes the account with the user as owner
 *   3. SPL Token TransferChecked — moves initial token amount into the agent account
 *   4. SPL Token ApproveChecked — grants the agent delegate authority
 *
 * The transaction is unsigned — the wallet adapter signs on the client.
 * simulateTransaction is called before returning.
 *
 * System Program createAccount layout (52 bytes):
 *   [0..3]   instruction index (u32 LE) = 0
 *   [4..11]  lamports (u64 LE)
 *   [12..19] space (u64 LE)
 *   [20..51] owner program ID (32 bytes)
 *
 * SPL Token InitializeAccount2 layout (33 bytes):
 *   [0]      discriminator (u8) = 16
 *   [1..32]  owner public key (32 bytes)
 *
 * SPL Token TransferChecked layout (10 bytes):
 *   [0]     discriminator (u8) = 12
 *   [1..8]  amount (u64 LE)
 *   [9]     decimals (u8)
 *
 * SPL Token ApproveChecked layout (10 bytes):
 *   [0]     discriminator (u8) = 13
 *   [1..8]  amount (u64 LE)
 *   [9]     decimals (u8)
 */

import {
  type Address,
  type Instruction,
  type Lamports,
  AccountRole,
  address,
  assertIsAddress,
  createSolanaRpc,
  getAddressEncoder,
  getMinimumBalanceForRentExemption,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  compileTransaction,
  getTransactionEncoder,
} from '@solana/kit';
import type { TransactionMessage, TransactionMessageWithBlockhashLifetime } from '@solana/kit';
import { TOKEN_PROGRAM_ID, type AgentDelegationConfig } from './types';
import { validateTokenProgramId, validateDelegateNotOwner } from './validate';
import { deriveAgentTokenAccount } from './derive-agent-token-account';

// =============================================================================
// CONSTANTS
// =============================================================================

/** System Program address. */
const SYSTEM_PROGRAM_ADDRESS = address(
  '11111111111111111111111111111111',
) as Address<'11111111111111111111111111111111'>;

/** Rent sysvar address. */
const RENT_SYSVAR_ADDRESS = address(
  'SysvarRent111111111111111111111111111111111',
) as Address<'SysvarRent111111111111111111111111111111111'>;

/**
 * SPL Token account size in bytes (always 165 for a standard token account).
 * Used to calculate rent-exempt minimum balance.
 */
const SPL_TOKEN_ACCOUNT_SPACE = 165n;

// =============================================================================
// TYPES
// =============================================================================

type SolanaRpc = ReturnType<typeof createSolanaRpc>;

export interface SetupAgentDelegationParams extends AgentDelegationConfig {
  /** Solana RPC client for blockhash + simulation. */
  rpc: SolanaRpc;
  /** User's primary token account — source of initial token transfer. */
  userTokenAccount: Address;
}

export interface SetupAgentDelegationResult {
  /** Unsigned transaction message ready for wallet signing. */
  transaction: TransactionMessage & TransactionMessageWithBlockhashLifetime;
  /** Derived PDA address for the new agent token account. */
  tokenAccountAddress: Address;
  /** Cost breakdown for display to user before confirmation. */
  estimatedCost: {
    /** SOL rent for the new token account (in lamports). */
    rentLamports: Lamports;
    /** Token amount being deposited into the agent account. */
    tokenAmount: bigint;
  };
}

// =============================================================================
// INSTRUCTION DATA BUILDERS
// =============================================================================

/**
 * Builds System Program CreateAccount instruction data.
 * Layout: [index u32 LE (=0), lamports u64 LE, space u64 LE, owner pubkey 32 bytes] — 52 bytes.
 */
function buildCreateAccountData(
  lamportsBigint: bigint,
  space: bigint,
  ownerProgramBytes: Uint8Array,
): Uint8Array {
  const data = new Uint8Array(52);
  const view = new DataView(data.buffer);
  view.setUint32(0, 0, true);                   // instruction index = 0 (CreateAccount)
  view.setBigUint64(4, lamportsBigint, true);    // lamports
  view.setBigUint64(12, space, true);            // space
  data.set(ownerProgramBytes, 20);               // owner program (TOKEN_PROGRAM_ID bytes)
  return data;
}

/**
 * Builds SPL Token InitializeAccount2 instruction data.
 * Discriminator 16 initializes without requiring the system account owner as a signer.
 * Layout: [16 u8, owner pubkey 32 bytes] — 33 bytes total.
 */
function buildInitializeAccount2Data(ownerBytes: Uint8Array): Uint8Array {
  const data = new Uint8Array(33);
  data[0] = 16; // InitializeAccount2 discriminator
  data.set(ownerBytes, 1);
  return data;
}

/**
 * Builds TransferChecked instruction data.
 * Layout: [12 u8, amount u64 LE, decimals u8] — 10 bytes.
 */
function buildTransferCheckedData(amount: bigint, decimals: number): Uint8Array {
  const data = new Uint8Array(10);
  const view = new DataView(data.buffer);
  view.setUint8(0, 12);
  view.setBigUint64(1, amount, true);
  view.setUint8(9, decimals);
  return data;
}

/**
 * Builds ApproveChecked instruction data.
 * Layout: [13 u8, amount u64 LE, decimals u8] — 10 bytes.
 */
function buildApproveCheckedData(amount: bigint, decimals: number): Uint8Array {
  const data = new Uint8Array(10);
  const view = new DataView(data.buffer);
  view.setUint8(0, 13);
  view.setBigUint64(1, amount, true);
  view.setUint8(9, decimals);
  return data;
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Builds a single unsigned transaction that sets up a complete agent delegation:
 *
 *   1. createAccount (System Program) — allocates the PDA-derived token account
 *   2. initializeAccount2 (SPL Token) — initializes with userWallet as owner
 *   3. transferChecked (SPL Token) — deposits `amount` tokens into the agent account
 *   4. approveChecked (SPL Token) — grants agentPubkey delegate authority
 *
 * Security checks:
 * - Token-2022 is rejected.
 * - delegate !== owner is enforced.
 * - Transaction is simulated before returning.
 *
 * Returns the transaction unsigned along with the derived PDA and cost estimate
 * for display to the user before wallet confirmation.
 *
 * @param params - Setup parameters including AgentDelegationConfig + RPC + source account.
 * @returns Unsigned transaction, PDA address, and cost estimate.
 */
export async function setupAgentDelegation(
  params: SetupAgentDelegationParams,
): Promise<SetupAgentDelegationResult> {
  const {
    rpc,
    userWallet,
    agentPubkey,
    tokenMint,
    amount,
    decimals,
    characterId,
    userTokenAccount,
  } = params;

  // Validate all addresses.
  assertIsAddress(userWallet);
  assertIsAddress(agentPubkey);
  assertIsAddress(tokenMint);
  assertIsAddress(userTokenAccount);

  // Security: reject Token-2022, reject self-delegation.
  validateTokenProgramId(TOKEN_PROGRAM_ID);
  validateDelegateNotOwner(agentPubkey, userWallet);

  if (amount <= 0n) {
    throw new Error(`Delegation amount must be positive, got ${amount}`);
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error(`decimals must be an integer 0-18, got ${decimals}`);
  }

  // Derive the PDA for the agent token account.
  const { address: agentTokenAccountAddress, bump } =
    await deriveAgentTokenAccount(userWallet, tokenMint, characterId);

  // Calculate rent-exempt minimum balance for a 165-byte token account.
  const rentLamports: Lamports = getMinimumBalanceForRentExemption(SPL_TOKEN_ACCOUNT_SPACE);

  // Encode addresses to bytes for instruction data.
  const encoder = getAddressEncoder();
  const tokenProgramBytes = new Uint8Array(encoder.encode(TOKEN_PROGRAM_ID));
  const userWalletBytes = new Uint8Array(encoder.encode(userWallet));

  // Fetch blockhash.
  const { value: blockhash } = await rpc.getLatestBlockhash().send();

  // 1. System Program createAccount
  const createAccountData = buildCreateAccountData(
    BigInt(rentLamports), // Lamports is branded bigint — unwrap for DataView
    SPL_TOKEN_ACCOUNT_SPACE,
    tokenProgramBytes,
  );

  const createAccountInstruction: Instruction = {
    programAddress: SYSTEM_PROGRAM_ADDRESS,
    accounts: [
      // funding account (payer) — writable signer
      { address: userWallet, role: AccountRole.WRITABLE_SIGNER },
      // new account — writable signer
      { address: agentTokenAccountAddress, role: AccountRole.WRITABLE_SIGNER },
    ],
    data: createAccountData,
  };

  // 2. SPL Token InitializeAccount2
  const initData = buildInitializeAccount2Data(userWalletBytes);

  const initializeInstruction: Instruction = {
    programAddress: TOKEN_PROGRAM_ID,
    accounts: [
      // 0: account to initialize — writable
      { address: agentTokenAccountAddress, role: AccountRole.WRITABLE },
      // 1: mint — readonly
      { address: tokenMint, role: AccountRole.READONLY },
      // 2: rent sysvar — readonly
      { address: RENT_SYSVAR_ADDRESS, role: AccountRole.READONLY },
    ],
    data: initData,
  };

  // 3. SPL Token TransferChecked — move initial tokens into agent account
  const transferData = buildTransferCheckedData(amount, decimals);

  const transferInstruction: Instruction = {
    programAddress: TOKEN_PROGRAM_ID,
    accounts: [
      // 0: source (user primary ATA) — writable
      { address: userTokenAccount, role: AccountRole.WRITABLE },
      // 1: mint — readonly
      { address: tokenMint, role: AccountRole.READONLY },
      // 2: destination (agent account) — writable
      { address: agentTokenAccountAddress, role: AccountRole.WRITABLE },
      // 3: authority (user wallet) — readonly signer
      { address: userWallet, role: AccountRole.READONLY_SIGNER },
    ],
    data: transferData,
  };

  // 4. SPL Token ApproveChecked — grant agent delegate authority
  const approveData = buildApproveCheckedData(amount, decimals);

  const approveInstruction: Instruction = {
    programAddress: TOKEN_PROGRAM_ID,
    accounts: [
      // 0: source token account — writable
      { address: agentTokenAccountAddress, role: AccountRole.WRITABLE },
      // 1: mint — readonly
      { address: tokenMint, role: AccountRole.READONLY },
      // 2: delegate (agent pubkey) — readonly
      { address: agentPubkey, role: AccountRole.READONLY },
      // 3: owner — readonly signer
      { address: userWallet, role: AccountRole.READONLY_SIGNER },
    ],
    data: approveData,
  };

  // Build the combined transaction message.
  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(userWallet, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
    (tx) => appendTransactionMessageInstruction(createAccountInstruction, tx),
    (tx) => appendTransactionMessageInstruction(initializeInstruction, tx),
    (tx) => appendTransactionMessageInstruction(transferInstruction, tx),
    (tx) => appendTransactionMessageInstruction(approveInstruction, tx),
  );

  // Simulate before returning — sigVerify: false since unsigned.
  const rpcEndpoint = process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? '';
  if (rpcEndpoint) {
    try {
      const compiled = compileTransaction(txMessage);
      const txBytes = getTransactionEncoder().encode(compiled);
      const txBase64 = Buffer.from(txBytes as Uint8Array).toString('base64');

      const simResponse = await fetch(rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'simulateTransaction',
          params: [
            txBase64,
            {
              encoding: 'base64',
              sigVerify: false,
              replaceRecentBlockhash: true,
            },
          ],
        }),
      });

      if (simResponse.ok) {
        const simBody = await simResponse.json() as {
          result?: { value?: { err?: unknown } };
        };
        if (simBody.result?.value?.err) {
          throw new Error(
            `Setup delegation simulation failed: ${JSON.stringify(simBody.result.value.err)}`,
          );
        }
      }
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.startsWith('Setup delegation simulation failed')
      ) {
        throw err;
      }
      // Network errors during simulation are non-fatal.
    }
  }

  // Suppress unused variable warning for bump (returned for debugging/testing).
  void bump;

  return {
    transaction: txMessage,
    tokenAccountAddress: agentTokenAccountAddress,
    estimatedCost: {
      rentLamports,
      tokenAmount: amount,
    },
  };
}

// Re-export for callers that need the raw derivation function.
export { deriveAgentTokenAccount };
