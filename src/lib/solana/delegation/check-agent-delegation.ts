/**
 * On-chain delegation status queries.
 *
 * Fetches SPL Token account data and parses it to determine delegation state.
 * Uses @solana/kit RPC — no web3.js.
 *
 * SPL Token account layout (165 bytes):
 *   [0..31]   mint (32 bytes)
 *   [32..63]  owner (32 bytes)
 *   [64..71]  amount (u64 LE)
 *   [72..75]  delegate_option (u32 LE, 0 = None, 1 = Some)
 *   [76..107] delegate (32 bytes, only valid when option = 1)
 *   [108]     state (u8)
 *   [109..112] is_native_option (u32 LE)
 *   [113..120] is_native (u64 LE, only valid when option = 1)
 *   [121..128] delegated_amount (u64 LE)
 *   [129..132] close_authority_option (u32 LE)
 *   [133..164] close_authority (32 bytes, only valid when option = 1)
 */

import {
  type Address,
  address,
  assertIsAddress,
  createSolanaRpc,
  getAddressDecoder,
} from '@solana/kit';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  type AgentDelegationStatus,
} from './types';

// =============================================================================
// TYPES
// =============================================================================

type SolanaRpc = ReturnType<typeof createSolanaRpc>;

// SPL Token account is always 165 bytes when initialized.
const SPL_TOKEN_ACCOUNT_SIZE = 165;

// Byte offsets within an SPL Token account.
const OFFSET_MINT = 0;
const OFFSET_AMOUNT = 64;
const OFFSET_DELEGATE_OPTION = 72;
const OFFSET_DELEGATE = 76;
const OFFSET_DELEGATED_AMOUNT = 121;

// =============================================================================
// NULL / INACTIVE STATUS FACTORY
// =============================================================================

/**
 * Returns an inactive delegation status when the account does not exist
 * or cannot be parsed.
 */
function inactiveStatus(tokenAccountAddress: Address): AgentDelegationStatus {
  return {
    isActive: false,
    delegate: null,
    remainingAmount: 0n,
    balance: 0n,
    tokenMint: TOKEN_PROGRAM_ID, // placeholder — account doesn't exist
    tokenAccount: tokenAccountAddress,
    programId: TOKEN_PROGRAM_ID,
  };
}

// =============================================================================
// PARSING HELPERS
// =============================================================================

/**
 * Reads a u64 little-endian value from a byte slice starting at offset.
 */
function readU64LE(data: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let i = 0; i < 8; i++) {
    value += BigInt(data[offset + i]) << BigInt(i * 8);
  }
  return value;
}

/**
 * Reads a u32 little-endian value from a byte slice starting at offset.
 */
function readU32LE(data: Uint8Array, offset: number): number {
  return (
    (data[offset] |
      (data[offset + 1] << 8) |
      (data[offset + 2] << 16) |
      (data[offset + 3] << 24)) >>>
    0
  );
}

// Cached decoder instance — avoids repeated allocation.
const addressDecoder = getAddressDecoder();

/**
 * Reads 32 bytes from data starting at offset and decodes them to an @solana/kit Address.
 * Uses the decoder's offset parameter to avoid a slice allocation.
 */
function readAddress(data: Uint8Array, offset: number): Address {
  return addressDecoder.decode(data, offset);
}

// =============================================================================
// SINGLE ACCOUNT CHECK
// =============================================================================

/**
 * Fetches the on-chain state of an agent token account and returns its
 * delegation status.
 *
 * Returns an inactive status (not an error) when the account does not exist.
 * Does not throw for Token-2022 accounts — the caller inspects programId.
 *
 * @param rpc                  - Solana RPC client from createSolanaRpc().
 * @param tokenAccountAddress  - The token account PDA to query.
 * @returns Current delegation status parsed from on-chain data.
 * @throws When the RPC call fails.
 */
export async function checkAgentDelegation(
  rpc: SolanaRpc,
  tokenAccountAddress: Address,
): Promise<AgentDelegationStatus> {
  assertIsAddress(tokenAccountAddress);

  let accountData: Uint8Array;
  let ownerProgramId: Address;

  try {
    const result = await rpc
      .getAccountInfo(tokenAccountAddress, { encoding: 'base64' })
      .send();

    if (!result.value) {
      // Account does not exist.
      return inactiveStatus(tokenAccountAddress);
    }

    const accountInfo = result.value;

    // Extract owner (program ID).
    ownerProgramId = address(accountInfo.owner);

    // Decode base64 account data.
    // RPC returns [base64String, encoding] tuple or a plain string.
    const rawData = accountInfo.data;
    let base64String: string;
    if (Array.isArray(rawData)) {
      base64String = rawData[0] as string;
    } else if (typeof rawData === 'string') {
      base64String = rawData;
    } else {
      return inactiveStatus(tokenAccountAddress);
    }

    const decoded = Buffer.from(base64String, 'base64');
    accountData = new Uint8Array(decoded);
  } catch (err) {
    throw new Error(
      `Failed to fetch token account ${tokenAccountAddress}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // Validate account size.
  if (accountData.length < SPL_TOKEN_ACCOUNT_SIZE) {
    return inactiveStatus(tokenAccountAddress);
  }

  // Parse fields from account data.
  const mintAddress = readAddress(accountData, OFFSET_MINT);
  const balance = readU64LE(accountData, OFFSET_AMOUNT);
  const delegateOption = readU32LE(accountData, OFFSET_DELEGATE_OPTION);
  const hasDelegate = delegateOption === 1;
  const delegateAddress: Address | null = hasDelegate
    ? readAddress(accountData, OFFSET_DELEGATE)
    : null;
  const delegatedAmount = readU64LE(accountData, OFFSET_DELEGATED_AMOUNT);

  // Surface Token-2022 in programId — callers should reject TOKEN_2022_PROGRAM_ID.
  const isToken2022 = ownerProgramId === TOKEN_2022_PROGRAM_ID;

  return {
    isActive: hasDelegate && delegatedAmount > 0n,
    delegate: delegateAddress,
    remainingAmount: delegatedAmount,
    balance,
    tokenMint: mintAddress,
    tokenAccount: tokenAccountAddress,
    programId: isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
  };
}

// =============================================================================
// BATCH CHECK
// =============================================================================

// Maximum accounts per getMultipleAccounts call (Solana RPC limit is 100).
const BATCH_SIZE = 100;

/**
 * Fetches delegation status for multiple agent token accounts in batches of 100.
 *
 * Uses getMultipleAccounts for efficiency. Returns a map from address string
 * to AgentDelegationStatus. Missing accounts return an inactive status.
 *
 * @param rpc       - Solana RPC client.
 * @param addresses - Array of token account addresses to query.
 * @returns Map of address string → AgentDelegationStatus.
 */
export async function checkAllAgentDelegations(
  rpc: SolanaRpc,
  addresses: Address[],
): Promise<Map<string, AgentDelegationStatus>> {
  const result = new Map<string, AgentDelegationStatus>();

  if (addresses.length === 0) {
    return result;
  }

  // Validate all addresses up-front before making any RPC calls.
  for (const addr of addresses) {
    assertIsAddress(addr);
  }

  // Process in batches of BATCH_SIZE.
  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE);

    let batchResult;
    try {
      batchResult = await rpc
        .getMultipleAccounts(batch, { encoding: 'base64' })
        .send();
    } catch (err) {
      throw new Error(
        `getMultipleAccounts failed for batch at index ${i}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    const accounts = batchResult.value;

    for (let j = 0; j < batch.length; j++) {
      const tokenAccountAddress = batch[j];
      const accountInfo = accounts[j];

      if (!accountInfo) {
        result.set(tokenAccountAddress, inactiveStatus(tokenAccountAddress));
        continue;
      }

      const ownerProgramId = address(accountInfo.owner);

      const rawData = accountInfo.data;
      let base64String: string;
      if (Array.isArray(rawData)) {
        base64String = rawData[0] as string;
      } else if (typeof rawData === 'string') {
        base64String = rawData;
      } else {
        result.set(tokenAccountAddress, inactiveStatus(tokenAccountAddress));
        continue;
      }

      const decoded = Buffer.from(base64String, 'base64');
      const accountData = new Uint8Array(decoded);

      if (accountData.length < SPL_TOKEN_ACCOUNT_SIZE) {
        result.set(tokenAccountAddress, inactiveStatus(tokenAccountAddress));
        continue;
      }

      const mintAddress = readAddress(accountData, OFFSET_MINT);
      const balance = readU64LE(accountData, OFFSET_AMOUNT);
      const delegateOption = readU32LE(accountData, OFFSET_DELEGATE_OPTION);
      const hasDelegate = delegateOption === 1;
      const delegateAddress: Address | null = hasDelegate
        ? readAddress(accountData, OFFSET_DELEGATE)
        : null;
      const delegatedAmount = readU64LE(accountData, OFFSET_DELEGATED_AMOUNT);
      const isToken2022 = ownerProgramId === TOKEN_2022_PROGRAM_ID;

      result.set(tokenAccountAddress, {
        isActive: hasDelegate && delegatedAmount > 0n,
        delegate: delegateAddress,
        remainingAmount: delegatedAmount,
        balance,
        tokenMint: mintAddress,
        tokenAccount: tokenAccountAddress,
        programId: isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
      });
    }
  }

  return result;
}
