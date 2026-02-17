/**
 * Bridges a KeyManager into an @solana/kit-compatible TransactionSigner.
 *
 * The returned object is cast to TransactionSigner so it integrates
 * transparently with setTransactionMessageFeePayerSigner and
 * signTransactionMessageWithSigners. This allows both local (EncryptedJson)
 * and remote (Turnkey TEE) signers to be used without any changes to the
 * transaction building flow.
 */

import type { Address, TransactionSigner } from '@solana/kit';
import type { KeyManager } from '@ozskr/agent-wallet-sdk';
import { logger } from '@/lib/utils/logger';

export type AgentSigner = TransactionSigner;

/**
 * Wrap a KeyManager into an @solana/kit-compatible TransactionSigner.
 *
 * The adapter signs raw bytes from `.messageBytes` (transactions) or
 * `.content` (messages) using the KeyManager's Ed25519 signing — either
 * locally via Web Crypto or remotely via Turnkey API.
 *
 * @param keyManager - The KeyManager instance (local or Turnkey)
 * @param agentAddress - The agent's Solana address
 * @param signerType - For logging: 'local' or 'turnkey'
 */
export function createSignerFromKeyManager(
  keyManager: KeyManager,
  agentAddress: Address,
  signerType: 'local' | 'turnkey',
): AgentSigner {
  // Build a signer that conforms to @solana/kit's TransactionPartialSigner.
  // We cast to TransactionSigner because the structural shape matches —
  // TransactionPartialSigner is the read-only, non-modifying variant.
  const signer = {
    address: agentAddress,

    async signMessages(messages: readonly { content: Uint8Array }[]) {
      return Promise.all(
        messages.map(async (msg) => {
          logger.debug('Signing message via KeyManager', {
            signerType,
            address: agentAddress,
          });
          const sig = await keyManager.signMessage(msg.content);
          return Object.freeze({ [agentAddress]: sig });
        }),
      );
    },

    async signTransactions(transactions: readonly { messageBytes: Uint8Array }[]) {
      return Promise.all(
        transactions.map(async (tx) => {
          logger.debug('Signing transaction via KeyManager', {
            signerType,
            address: agentAddress,
          });
          const sig = await keyManager.signTransaction(tx.messageBytes);
          return Object.freeze({ [agentAddress]: sig });
        }),
      );
    },
  };

  // Cast to TransactionSigner — the shape matches TransactionPartialSigner
  // which is a subset of TransactionSigner. The branded types (SignatureBytes,
  // TransactionMessageBytes) are structurally compatible with Uint8Array.
  return Object.freeze(signer) as unknown as AgentSigner;
}
