// ---------------------------------------------------------------------------
// On-Chain Delegation Validation
// ---------------------------------------------------------------------------

// Token Program addresses for detection
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

export interface DelegationCheckResult {
  status: 'active' | 'inactive' | 'not_delegated' | 'insufficient' | 'error';
  delegate?: string;
  delegatedAmount?: bigint;
  requiredAmount?: bigint;
  owner?: string;
  tokenMint?: string;
  programId?: string;
  errorDetail?: string;
}

/** Minimal RPC interface for delegation checks — allows mocking without full @solana/kit dependency. */
export interface DelegationRpc {
  getAccountInfo(
    address: string,
    options: { encoding: 'jsonParsed' },
  ): { send(): Promise<{ value: JsonParsedAccountInfo | null } | null> };
}

interface JsonParsedAccountInfo {
  data: {
    program: string;
    parsed: {
      type: string;
      info: {
        delegate?: string;
        delegatedAmount?: { amount: string; decimals: number };
        mint?: string;
        owner?: string;
        state?: string;
      };
    };
  };
  owner: string;
}

/**
 * Checks on-chain delegation status for a token account.
 *
 * Uses jsonParsed encoding to handle both Token Program and Token-2022
 * accounts transparently (Finding #1: Token-2022 detection).
 */
export async function checkDelegation(
  rpc: DelegationRpc,
  payerAddress: string,
  sourceTokenAccount: string,
  paymentAmount: bigint,
  expectedTokenMint: string,
): Promise<DelegationCheckResult> {
  try {
    const response = await rpc.getAccountInfo(sourceTokenAccount, { encoding: 'jsonParsed' }).send();

    if (!response?.value) {
      return {
        status: 'error',
        errorDetail: `Token account ${sourceTokenAccount} not found`,
      };
    }

    const accountInfo = response.value as unknown as JsonParsedAccountInfo;

    // Determine program from owner field
    const ownerProgram = accountInfo.owner ?? accountInfo.data?.program;
    let programId: string;
    if (ownerProgram === TOKEN_PROGRAM_ID || accountInfo.data?.program === 'spl-token') {
      programId = TOKEN_PROGRAM_ID;
    } else if (ownerProgram === TOKEN_2022_PROGRAM_ID || accountInfo.data?.program === 'spl-token-2022') {
      programId = TOKEN_2022_PROGRAM_ID;
    } else {
      return {
        status: 'error',
        errorDetail: `Account owned by unknown program: ${ownerProgram}`,
      };
    }

    const parsed = accountInfo.data?.parsed;
    if (!parsed || parsed.type !== 'account') {
      return {
        status: 'error',
        programId,
        errorDetail: `Unexpected account type: ${parsed?.type ?? 'unknown'}`,
      };
    }

    const info = parsed.info;
    const owner = info.owner;
    const tokenMint = info.mint;

    // Validate mint matches expected
    if (tokenMint && tokenMint !== expectedTokenMint) {
      return {
        status: 'error',
        owner,
        tokenMint,
        programId,
        errorDetail: `Token mint mismatch: expected ${expectedTokenMint}, got ${tokenMint}`,
      };
    }

    // Check if delegation exists and matches payer
    if (!info.delegate) {
      return {
        status: 'not_delegated',
        owner,
        tokenMint,
        programId,
      };
    }

    if (info.delegate !== payerAddress) {
      return {
        status: 'not_delegated',
        delegate: info.delegate,
        owner,
        tokenMint,
        programId,
        errorDetail: `Delegate ${info.delegate} does not match payer ${payerAddress}`,
      };
    }

    // Parse delegated amount
    const delegatedAmount = info.delegatedAmount
      ? BigInt(info.delegatedAmount.amount)
      : 0n;

    // Check if frozen
    if (info.state === 'frozen') {
      return {
        status: 'inactive',
        delegate: info.delegate,
        delegatedAmount,
        owner,
        tokenMint,
        programId,
        errorDetail: 'Token account is frozen',
      };
    }

    // Check delegation amount is sufficient
    if (delegatedAmount < paymentAmount) {
      return {
        status: 'insufficient',
        delegate: info.delegate,
        delegatedAmount,
        requiredAmount: paymentAmount,
        owner,
        tokenMint,
        programId,
      };
    }

    return {
      status: 'active',
      delegate: info.delegate,
      delegatedAmount,
      requiredAmount: paymentAmount,
      owner,
      tokenMint,
      programId,
    };
  } catch (error) {
    return {
      status: 'error',
      errorDetail: error instanceof Error ? error.message : String(error),
    };
  }
}
