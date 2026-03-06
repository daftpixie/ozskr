'use client';

/**
 * x402-Gated Image Generation Hook
 *
 * Handles the full x402 payment flow for premium image generation:
 *   1. POST /api/services/image-generate (or image-generate-pro)
 *   2. Server returns 402 with PaymentRequired body
 *   3. Parse payment requirements (payTo, asset/USDC mint, amount, network)
 *   4. Build a USDC TransferChecked transaction using @solana/web3.js v1
 *   5. Sign with the connected wallet adapter
 *   6. Encode as PaymentPayload, base64-encode, send as Payment-Signature header
 *   7. Server verifies and returns { images } on success
 *
 * Uses React Query useMutation for consistent state shape with use-generations.ts.
 * Does NOT modify use-generations.ts.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { useAuthStore } from '@/features/wallet/store';

// ---------------------------------------------------------------------------
// USDC Constants
// ---------------------------------------------------------------------------

/** Mainnet USDC mint address */
const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
/** Devnet USDC mint address */
const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

/** SPL Token Program ID */
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
/** Associated Token Account Program ID */
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bUs'
);
/** SPL Memo Program ID (for nonce uniqueness — same pattern as @x402/svm ExactSvmScheme) */
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

/** USDC decimals */
const USDC_DECIMALS = 6;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type X402GenerateType = 'image' | 'image-pro';

export interface X402GenerateInput {
  characterId: string;
  prompt: string;
  aspectRatio?: string;
  type: X402GenerateType;
}

export interface X402GenerateResult {
  imageUrl: string;
  generationId: string;
  cost: number;
  serviceId: string;
  latencyMs: number;
}

/** Parsed payment requirement from the 402 response body */
interface ParsedRequirement {
  x402Version: number;
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  /** Used as the fee payer when present (v2 extra field) */
  feePayer?: string;
  /** The full PaymentRequired object for wrapping into the PaymentPayload */
  rawPaymentRequired: unknown;
}

// ---------------------------------------------------------------------------
// ATA Derivation (without @solana/spl-token)
// ---------------------------------------------------------------------------

/**
 * Derives the Associated Token Account address for an owner + mint pair.
 * Seeds: [owner, TOKEN_PROGRAM_ID, mint]
 * Program: ASSOCIATED_TOKEN_PROGRAM_ID
 */
function findAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

// ---------------------------------------------------------------------------
// TransferChecked instruction builder (without @solana/spl-token)
// ---------------------------------------------------------------------------

/**
 * Builds a raw SPL Token TransferChecked instruction.
 *
 * Instruction data layout (11 bytes total):
 *   [0]     instruction index = 12 (TransferChecked)
 *   [1..8]  amount as little-endian u64
 *   [9]     decimals as u8
 */
function buildTransferCheckedInstruction(params: {
  source: PublicKey;
  mint: PublicKey;
  destination: PublicKey;
  authority: PublicKey;
  amount: bigint;
  decimals: number;
}): TransactionInstruction {
  const data = Buffer.allocUnsafe(10);
  data.writeUInt8(12, 0); // TransferChecked instruction index

  // Write amount as little-endian u64 (bytes 1-8)
  let amt = params.amount;
  for (let i = 0; i < 8; i++) {
    data.writeUInt8(Number(amt & 0xffn), 1 + i);
    amt >>= 8n;
  }

  data.writeUInt8(params.decimals, 9); // decimals

  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: params.source, isSigner: false, isWritable: true },
      { pubkey: params.mint, isSigner: false, isWritable: false },
      { pubkey: params.destination, isSigner: false, isWritable: true },
      { pubkey: params.authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}

// ---------------------------------------------------------------------------
// Memo instruction builder (nonce for replay protection)
// ---------------------------------------------------------------------------

function buildMemoInstruction(nonce: string): TransactionInstruction {
  return new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [],
    data: Buffer.from(nonce, 'utf-8'),
  });
}

// ---------------------------------------------------------------------------
// 402 response parser
// ---------------------------------------------------------------------------

/**
 * Parses a 402 response from the x402 server.
 *
 * The @x402/hono paymentMiddleware returns the PaymentRequired object as the
 * JSON response body when no payment header is present. Structure:
 *   {
 *     x402Version: 2,
 *     accepts: [{
 *       scheme: "exact",
 *       network: "solana:...",
 *       amount: "100000",
 *       asset: "<USDC mint>",
 *       payTo: "<treasury address>",
 *       maxTimeoutSeconds: 300,
 *       extra: { feePayer: "..." }
 *     }]
 *   }
 */
async function parsePaymentRequired(response: Response): Promise<ParsedRequirement | null> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }

  if (
    body === null ||
    typeof body !== 'object' ||
    !('x402Version' in body) ||
    !('accepts' in body)
  ) {
    return null;
  }

  const pr = body as Record<string, unknown>;
  const x402Version = typeof pr.x402Version === 'number' ? pr.x402Version : 1;
  const accepts = Array.isArray(pr.accepts) ? pr.accepts : [];

  // Pick the first Solana-compatible requirement
  for (const req of accepts) {
    if (
      req !== null &&
      typeof req === 'object' &&
      typeof (req as Record<string, unknown>).network === 'string' &&
      ((req as Record<string, unknown>).network as string).startsWith('solana:') &&
      typeof (req as Record<string, unknown>).payTo === 'string' &&
      typeof (req as Record<string, unknown>).asset === 'string' &&
      typeof (req as Record<string, unknown>).amount === 'string'
    ) {
      const r = req as Record<string, unknown>;
      const extra = r.extra as Record<string, unknown> | undefined;
      return {
        x402Version,
        scheme: typeof r.scheme === 'string' ? r.scheme : 'exact',
        network: r.network as string,
        amount: r.amount as string,
        asset: r.asset as string,
        payTo: r.payTo as string,
        maxTimeoutSeconds: typeof r.maxTimeoutSeconds === 'number' ? r.maxTimeoutSeconds : 300,
        feePayer: typeof extra?.feePayer === 'string' ? extra.feePayer : undefined,
        rawPaymentRequired: body,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// PaymentPayload encoding (mirrors @x402/core encodePaymentSignatureHeader)
// ---------------------------------------------------------------------------

/**
 * Encodes a PaymentPayload into the base64 string expected by the
 * Payment-Signature / X-Payment header, matching @x402/core
 * encodePaymentSignatureHeader output exactly.
 */
function encodePaymentPayload(payload: unknown): string {
  const json = JSON.stringify(payload);
  // Use TextEncoder + btoa for browser compatibility (same as @x402/core)
  const bytes = new TextEncoder().encode(json);
  const binaryString = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binaryString);
}

// ---------------------------------------------------------------------------
// RPC blockhash fetch (using the environment RPC endpoint)
// ---------------------------------------------------------------------------

/**
 * Resolves the USDC mint address for the current network.
 * Reads NEXT_PUBLIC_SOLANA_NETWORK (set at build time).
 */
function resolveUsdcMint(): PublicKey {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet';
  return new PublicKey(network === 'mainnet-beta' ? USDC_MINT_MAINNET : USDC_MINT_DEVNET);
}

/**
 * Fetches the latest blockhash from the Solana RPC endpoint configured in the
 * environment. Falls back to the public devnet endpoint.
 */
async function fetchLatestBlockhash(): Promise<{
  blockhash: string;
  lastValidBlockHeight: number;
}> {
  const rpcUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
    'https://api.devnet.solana.com';

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getLatestBlockhash',
      params: [{ commitment: 'confirmed' }],
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC getLatestBlockhash failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    result?: {
      value?: {
        blockhash?: string;
        lastValidBlockHeight?: number;
      };
    };
  };

  const blockhash = data.result?.value?.blockhash;
  const lastValidBlockHeight = data.result?.value?.lastValidBlockHeight;

  if (!blockhash || lastValidBlockHeight === undefined) {
    throw new Error('Invalid getLatestBlockhash response');
  }

  return { blockhash, lastValidBlockHeight };
}

// ---------------------------------------------------------------------------
// Core: build, sign, and encode the USDC payment transaction
// ---------------------------------------------------------------------------

/**
 * Builds a USDC TransferChecked transaction, signs it with the wallet adapter,
 * and returns the x402 PaymentPayload ready to be base64-encoded into the
 * Payment-Signature header.
 */
async function buildSignedPaymentPayload(params: {
  requirement: ParsedRequirement;
  payer: PublicKey;
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
}): Promise<unknown> {
  const { requirement, payer, signTransaction } = params;

  const usdcMint = resolveUsdcMint();

  // Validate that the asset in the requirement matches our expected USDC mint
  const assetMint = new PublicKey(requirement.asset);
  if (!assetMint.equals(usdcMint)) {
    throw new Error(
      `Unexpected payment asset: ${requirement.asset}. Expected USDC mint.`
    );
  }

  const payTo = new PublicKey(requirement.payTo);
  const amount = BigInt(requirement.amount);

  // Derive Associated Token Accounts
  const sourceAta = findAssociatedTokenAddress(payer, usdcMint);
  const destinationAta = findAssociatedTokenAddress(payTo, usdcMint);

  // Generate a random nonce for memo (replay protection, matches @x402/svm pattern)
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = Array.from(nonceBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Build instructions
  const transferIx = buildTransferCheckedInstruction({
    source: sourceAta,
    mint: usdcMint,
    destination: destinationAta,
    authority: payer,
    amount,
    decimals: USDC_DECIMALS,
  });

  const memoIx = buildMemoInstruction(nonce);

  // Fetch blockhash
  const { blockhash } = await fetchLatestBlockhash();

  // Build VersionedTransaction (v0 = compact transaction format)
  const feePayer = requirement.feePayer
    ? new PublicKey(requirement.feePayer)
    : payer;

  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [transferIx, memoIx],
  }).compileToV0Message();

  const versionedTx = new VersionedTransaction(message);

  // Sign with wallet adapter
  const signedTx = await signTransaction(versionedTx);

  // Serialize to base64
  const serialized = signedTx.serialize();
  const base64Tx = btoa(Array.from(serialized, (b) => String.fromCharCode(b)).join(''));

  // Construct the PaymentPayload that the server's ExactSvmScheme expects
  const paymentPayload = {
    x402Version: requirement.x402Version,
    scheme: requirement.scheme,
    network: requirement.network,
    payload: {
      transaction: base64Tx,
    },
  };

  return paymentPayload;
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export interface X402GenerateConfirmation {
  /** USDC amount as human-readable string, e.g. "0.10" */
  amountUsdc: string;
  /** Treasury wallet address the payment goes to */
  payTo: string;
  /** Resolves when the user confirms payment */
  confirm: () => void;
  /** Resolves when the user cancels */
  cancel: () => void;
}

interface UseX402GenerateOptions {
  /**
   * Called before the wallet signing prompt. Receives the confirmation details
   * and must return a promise that either resolves (user confirmed) or rejects
   * (user cancelled). If not provided, payment proceeds without confirmation.
   */
  onConfirm?: (confirmation: Omit<X402GenerateConfirmation, 'confirm' | 'cancel'>) => Promise<void>;
}

export function useX402Generate(options?: UseX402GenerateOptions) {
  const token = useAuthStore((state) => state.token);
  const { publicKey, signTransaction, connected } = useWallet();

  // Track whether the user is in the payment confirmation step
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const mutation = useMutation({
    mutationFn: async (input: X402GenerateInput): Promise<X402GenerateResult> => {
      if (!connected || !publicKey || !signTransaction) {
        throw new Error('Wallet not connected');
      }

      if (!token) {
        throw new Error('Not authenticated');
      }

      const endpoint =
        input.type === 'image-pro'
          ? '/api/services/image-generate-pro'
          : '/api/services/image-generate';

      const requestBody = JSON.stringify({
        prompt: input.prompt,
        aspectRatio: input.aspectRatio ?? 'square_hd',
        characterId: input.characterId,
      });

      const baseHeaders: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // -----------------------------------------------------------------------
      // Step 1: Initial request — expect 402
      // -----------------------------------------------------------------------
      const probeResponse = await fetch(endpoint, {
        method: 'POST',
        headers: baseHeaders,
        body: requestBody,
      });

      if (probeResponse.status !== 402) {
        // Billing is disabled (ENABLE_X402_BILLING=false) — parse direct response
        if (!probeResponse.ok) {
          let errMsg = `Request failed: ${probeResponse.status}`;
          try {
            const errBody = (await probeResponse.json()) as Record<string, unknown>;
            if (typeof errBody.error === 'string') {
              errMsg = errBody.error;
            }
          } catch {
            // ignore parse error
          }
          throw new Error(errMsg);
        }

        const directResult = (await probeResponse.json()) as {
          images?: Array<{ url?: string }>;
          cost?: number;
          serviceId?: string;
          latencyMs?: number;
        };

        const imageUrl = directResult.images?.[0]?.url;
        if (!imageUrl) {
          throw new Error('No image returned from service');
        }

        return {
          imageUrl,
          generationId: crypto.randomUUID(),
          cost: directResult.cost ?? 0,
          serviceId: directResult.serviceId ?? 'image-generate',
          latencyMs: directResult.latencyMs ?? 0,
        };
      }

      // -----------------------------------------------------------------------
      // Step 2: Parse the 402 payment requirements
      // -----------------------------------------------------------------------
      const requirement = await parsePaymentRequired(probeResponse);
      if (!requirement) {
        throw new Error(
          'Server returned 402 but payment requirements could not be parsed'
        );
      }

      // -----------------------------------------------------------------------
      // Step 3: Confirmation dialog (before signing)
      // -----------------------------------------------------------------------
      const amountRaw = BigInt(requirement.amount);
      const amountUsdc = (Number(amountRaw) / 1_000_000).toFixed(2);

      if (options?.onConfirm) {
        setAwaitingConfirmation(true);
        try {
          await options.onConfirm({
            amountUsdc,
            payTo: requirement.payTo,
          });
        } finally {
          setAwaitingConfirmation(false);
        }
      }

      // -----------------------------------------------------------------------
      // Step 4: Build, sign, and encode the payment transaction
      // -----------------------------------------------------------------------
      const paymentPayload = await buildSignedPaymentPayload({
        requirement,
        payer: publicKey,
        signTransaction,
      });

      const encodedPayment = encodePaymentPayload(paymentPayload);

      // -----------------------------------------------------------------------
      // Step 5: Retry the request with the Payment-Signature header
      // -----------------------------------------------------------------------
      const paidResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...baseHeaders,
          // Send both header names for compatibility with @x402/hono middleware
          'Payment-Signature': encodedPayment,
          'X-Payment': encodedPayment,
        },
        body: requestBody,
      });

      if (!paidResponse.ok) {
        let errMsg = `Payment request failed: ${paidResponse.status}`;
        try {
          const errBody = (await paidResponse.json()) as Record<string, unknown>;
          if (typeof errBody.error === 'string') {
            errMsg = errBody.error;
          }
        } catch {
          // ignore
        }
        throw new Error(errMsg);
      }

      // -----------------------------------------------------------------------
      // Step 6: Parse the successful response
      // -----------------------------------------------------------------------
      const result = (await paidResponse.json()) as {
        images?: Array<{ url?: string }>;
        cost?: number;
        serviceId?: string;
        latencyMs?: number;
      };

      const imageUrl = result.images?.[0]?.url;
      if (!imageUrl) {
        throw new Error('No image returned from paid service');
      }

      return {
        imageUrl,
        generationId: crypto.randomUUID(),
        cost: result.cost ?? 0,
        serviceId: result.serviceId ?? (input.type === 'image-pro' ? 'image-generate-pro' : 'image-generate'),
        latencyMs: result.latencyMs ?? 0,
      };
    },
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isAwaitingConfirmation: awaitingConfirmation,
    data: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}
