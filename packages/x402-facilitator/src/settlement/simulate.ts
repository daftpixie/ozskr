// ---------------------------------------------------------------------------
// Simulate-Before-Submit (Bug 7 Fix)
// ---------------------------------------------------------------------------

// Token Program addresses for instruction parsing (Finding #1)
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

// SPL Token TransferChecked instruction discriminator
const TRANSFER_CHECKED_DISCRIMINATOR = 12;

export interface SimulationResult {
  success: boolean;
  error?: string;
  recipientVerified: boolean;
  amountVerified: boolean;
  tokenMintVerified: boolean;
  estimatedFee: bigint;
  logs?: string[];
}

export interface SimulationRequirements {
  expectedRecipient: string;
  expectedAmount: bigint;
  expectedTokenMint: string;
}

/** Minimal RPC interface for simulation. */
export interface SimulationRpc {
  simulateTransaction(
    transaction: string,
    options: { commitment: string; encoding: string },
  ): { send(): Promise<SimulationRpcResponse> };
}

interface SimulationRpcResponse {
  value: {
    err: unknown;
    logs: string[] | null;
    unitsConsumed: number | null;
  };
}

/** Parsed instruction from a transaction. */
interface ParsedInstruction {
  programId: string;
  accounts: string[];
  data: Uint8Array;
}

/**
 * Parses a base64-encoded transaction to extract instructions.
 *
 * Handles both Token Program and Token-2022 TransferChecked instructions.
 * Returns structured instruction data for verification before simulation.
 */
export function parseTransferInstructions(
  transactionBase64: string,
  accountKeys: string[],
): Array<{
  source: string;
  mint: string;
  destination: string;
  amount: bigint;
  programId: string;
}> {
  // Decode transaction bytes
  const txBytes = Buffer.from(transactionBase64, 'base64');
  const instructions = extractInstructions(txBytes, accountKeys);

  const transfers: Array<{
    source: string;
    mint: string;
    destination: string;
    amount: bigint;
    programId: string;
  }> = [];

  for (const ix of instructions) {
    const isTokenProgram = ix.programId === TOKEN_PROGRAM_ID || ix.programId === TOKEN_2022_PROGRAM_ID;
    if (!isTokenProgram) continue;

    // TransferChecked: discriminator=12, data layout: [1 byte disc][8 bytes amount LE][1 byte decimals]
    if (ix.data.length >= 10 && ix.data[0] === TRANSFER_CHECKED_DISCRIMINATOR) {
      // Accounts: [source, mint, destination, authority]
      if (ix.accounts.length < 4) continue;

      const amount = readU64LE(ix.data, 1);

      transfers.push({
        source: ix.accounts[0],
        mint: ix.accounts[1],
        destination: ix.accounts[2],
        amount,
        programId: ix.programId,
      });
    }
  }

  return transfers;
}

/**
 * Simulates a transaction and verifies it matches payment requirements.
 *
 * Approach A: Parse instructions BEFORE simulation to verify payment parameters,
 * then simulate to confirm the transaction will succeed on-chain.
 */
export async function simulateAndVerify(
  rpc: SimulationRpc,
  transactionBase64: string,
  accountKeys: string[],
  requirements: SimulationRequirements,
): Promise<SimulationResult> {
  // Step 1: Parse instructions to verify payment parameters
  const transfers = parseTransferInstructions(transactionBase64, accountKeys);

  if (transfers.length === 0) {
    return {
      success: false,
      error: 'No SPL Transfer/TransferChecked instructions found in transaction',
      recipientVerified: false,
      amountVerified: false,
      tokenMintVerified: false,
      estimatedFee: 0n,
    };
  }

  // Find the transfer matching requirements
  const matchingTransfer = transfers.find(
    (t) => t.destination === requirements.expectedRecipient,
  );

  const recipientVerified = matchingTransfer !== undefined;
  const amountVerified = matchingTransfer
    ? matchingTransfer.amount >= requirements.expectedAmount
    : false;
  const tokenMintVerified = matchingTransfer
    ? matchingTransfer.mint === requirements.expectedTokenMint
    : false;

  if (!recipientVerified) {
    return {
      success: false,
      error: `Transaction does not transfer to expected recipient ${requirements.expectedRecipient}`,
      recipientVerified,
      amountVerified,
      tokenMintVerified,
      estimatedFee: 0n,
    };
  }

  if (!amountVerified) {
    return {
      success: false,
      error: `Transfer amount ${matchingTransfer?.amount ?? 0n} does not meet required ${requirements.expectedAmount}`,
      recipientVerified,
      amountVerified,
      tokenMintVerified,
      estimatedFee: 0n,
    };
  }

  if (!tokenMintVerified) {
    return {
      success: false,
      error: `Transfer mint ${matchingTransfer?.mint ?? 'unknown'} does not match expected ${requirements.expectedTokenMint}`,
      recipientVerified,
      amountVerified,
      tokenMintVerified,
      estimatedFee: 0n,
    };
  }

  // Step 2: Simulate to confirm execution viability
  try {
    const simResult = await rpc.simulateTransaction(
      transactionBase64,
      { commitment: 'confirmed', encoding: 'base64' },
    ).send();

    if (simResult.value.err) {
      return {
        success: false,
        error: `Simulation failed: ${JSON.stringify(simResult.value.err)}`,
        recipientVerified,
        amountVerified,
        tokenMintVerified,
        estimatedFee: 0n,
        logs: simResult.value.logs ?? undefined,
      };
    }

    const estimatedFee = BigInt(simResult.value.unitsConsumed ?? 5000) * 1n;

    return {
      success: true,
      recipientVerified,
      amountVerified,
      tokenMintVerified,
      estimatedFee,
      logs: simResult.value.logs ?? undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: `Simulation RPC error: ${error instanceof Error ? error.message : String(error)}`,
      recipientVerified,
      amountVerified,
      tokenMintVerified,
      estimatedFee: 0n,
    };
  }
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

function readU64LE(data: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let i = 0; i < 8; i++) {
    value |= BigInt(data[offset + i]) << BigInt(i * 8);
  }
  return value;
}

/**
 * Minimal instruction extractor from raw transaction bytes.
 * Supports legacy (prefix byte 0x00..0x7F) transaction format.
 */
function extractInstructions(
  txBytes: Uint8Array,
  accountKeys: string[],
): ParsedInstruction[] {
  const instructions: ParsedInstruction[] = [];

  try {
    let offset = 0;

    // Skip signatures section
    const numSignatures = txBytes[offset++];
    offset += numSignatures * 64;

    // Message header
    const numRequiredSignatures = txBytes[offset++];
    const numReadonlySignedAccounts = txBytes[offset++];
    const numReadonlyUnsignedAccounts = txBytes[offset++];
    void numRequiredSignatures;
    void numReadonlySignedAccounts;
    void numReadonlyUnsignedAccounts;

    // Account keys
    const numKeys = txBytes[offset++];
    offset += numKeys * 32;

    // Recent blockhash
    offset += 32;

    // Instructions
    const numInstructions = txBytes[offset++];

    for (let i = 0; i < numInstructions; i++) {
      const programIdIndex = txBytes[offset++];

      // Account indexes
      const numAccounts = txBytes[offset++];
      const accountIndexes: number[] = [];
      for (let j = 0; j < numAccounts; j++) {
        accountIndexes.push(txBytes[offset++]);
      }

      // Instruction data
      const dataLen = txBytes[offset++];
      const data = txBytes.slice(offset, offset + dataLen);
      offset += dataLen;

      instructions.push({
        programId: accountKeys[programIdIndex] ?? '',
        accounts: accountIndexes.map((idx) => accountKeys[idx] ?? ''),
        data,
      });
    }
  } catch {
    // Parsing error — return what we have
  }

  return instructions;
}
