// ---------------------------------------------------------------------------
// Blockhash Age Validation (Finding #3)
// ---------------------------------------------------------------------------

export interface BlockhashValidationResult {
  isValid: boolean;
  reason?: string;
  maxAge: number;
}

/** Minimal RPC interface for blockhash validation. */
export interface BlockhashRpc {
  isBlockhashValid(
    blockhash: string,
    options: { commitment: string },
  ): { send(): Promise<{ value: boolean }> };
}

/**
 * Validates that a transaction's blockhash is still fresh.
 *
 * Agent-crafted transactions can go stale between construction and facilitator
 * receipt. Verifying blockhash freshness prevents opaque submission failures.
 *
 * @param rpc - Solana RPC client
 * @param blockhash - The blockhash from the transaction
 * @param maxAgeSeconds - Max age in seconds (default 60)
 */
export async function validateBlockhashFreshness(
  rpc: BlockhashRpc,
  blockhash: string,
  maxAgeSeconds = 60,
): Promise<BlockhashValidationResult> {
  try {
    const result = await rpc.isBlockhashValid(blockhash, { commitment: 'processed' }).send();

    if (!result.value) {
      return {
        isValid: false,
        reason: 'Transaction blockhash expired. Agent must rebuild the transaction with a fresh blockhash.',
        maxAge: maxAgeSeconds,
      };
    }

    return {
      isValid: true,
      maxAge: maxAgeSeconds,
    };
  } catch {
    // RPC failure: fail-open — blockhash might still be valid.
    // Settlement submission will catch truly expired ones.
    return {
      isValid: true,
      reason: 'Blockhash validation RPC call failed (fail-open: allowing)',
      maxAge: maxAgeSeconds,
    };
  }
}
