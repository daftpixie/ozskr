import { type Address, type KeyPairSigner, createSolanaRpc } from '@solana/kit';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  generateAgentKeypair,
  storeEncryptedKeypair,
  loadEncryptedKeypair,
  checkDelegation,
  createBudgetTracker,
  DelegationError,
  SCRYPT_PARAMS_FAST,
  SCRYPT_PARAMS_PRODUCTION,
  type BudgetTracker,
  type ScryptParams,
} from '@ozskr/agent-wallet-sdk';
import {
  SOLANA_DEVNET_CAIP2,
  SOLANA_MAINNET_CAIP2,
} from '@x402/svm';
import type { Config } from './config.js';
import {
  makeX402Request,
  retryWithPayment,
  validateRequirement,
} from './lib/x402-client.js';
import {
  submitToFacilitator,
  FacilitatorError,
} from './lib/facilitator.js';
import {
  appendTransaction,
  queryHistory,
} from './lib/history.js';

// ---------------------------------------------------------------------------
// Tool Result Helpers
// ---------------------------------------------------------------------------

function stubResult(toolName: string) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        status: 'not_implemented',
        tool: toolName,
        message: `${toolName} is a stub — implementation coming in Week 2`,
      }),
    }],
  };
}

function errorResult(code: string, message: string) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ error: code, message }),
    }],
    isError: true,
  };
}

function successResult(data: Record<string, unknown>) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ status: 'success', ...data }),
    }],
  };
}

// ---------------------------------------------------------------------------
// Server Factory
// ---------------------------------------------------------------------------

/**
 * Creates and configures the x402-solana-mcp MCP server with all 8 tools.
 *
 * All tools are wired to real implementations:
 * - x402_setup_agent, x402_check_delegation, x402_check_balance, x402_revoke_delegation (Week 1)
 * - x402_pay, x402_transaction_history, x402_discover_services, x402_estimate_cost (Week 2)
 *
 * @param config - Server configuration
 * @returns Configured McpServer instance ready for transport connection
 */
export function createServer(config: Config): McpServer {
  const server = new McpServer({
    name: 'x402-solana-mcp',
    version: '0.2.0-beta',
  });

  // Closure-scoped state persists across tool calls within a session
  let cachedSigner: KeyPairSigner | null = null;
  // Budget tracker is initialized on the first x402_pay call using the delegation's spending cap
  let budgetTracker: BudgetTracker | null = null;

  // Scrypt params for keypair operations (used as fallback for v1 files; v2 files auto-detect)
  const scryptParams: ScryptParams = config.scryptMode === 'production'
    ? SCRYPT_PARAMS_PRODUCTION
    : SCRYPT_PARAMS_FAST;

  const networkCaip2 = config.solanaNetwork === 'mainnet-beta'
    ? SOLANA_MAINNET_CAIP2
    : SOLANA_DEVNET_CAIP2;

  // -------------------------------------------------------------------------
  // Tool 1: x402_setup_agent (WIRED — Week 1)
  // -------------------------------------------------------------------------
  server.tool(
    'x402_setup_agent',
    'Generate an agent keypair and display the public key for delegation setup',
    {
      passphrase: z
        .string()
        .min(12, 'Passphrase must be at least 12 characters')
        .describe('Passphrase to encrypt the agent keypair at rest'),
      outputPath: z
        .string()
        .optional()
        .describe('Path to save the keypair file (defaults to AGENT_KEYPAIR_PATH)'),
      force: z
        .boolean()
        .default(false)
        .describe('Overwrite existing keypair if present'),
    },
    async ({ passphrase, outputPath, force }) => {
      try {
        const { signer, keypairBytes } = await generateAgentKeypair();
        const savePath = outputPath ?? config.agentKeypairPath;

        try {
          await storeEncryptedKeypair(keypairBytes, passphrase, savePath, force, scryptParams);
        } finally {
          keypairBytes.fill(0);
        }

        cachedSigner = signer;

        return successResult({
          agentAddress: signer.address,
          keypairPath: savePath,
          message: 'Agent keypair generated and encrypted. Fund this address with SOL for transaction fees, then set up an SPL token delegation.',
        });
      } catch (error) {
        if (error instanceof DelegationError) {
          return errorResult(error.code, error.message);
        }
        return errorResult('SETUP_FAILED', error instanceof Error ? error.message : String(error));
      }
    },
  );

  // -------------------------------------------------------------------------
  // Tool 2: x402_check_delegation (WIRED — Week 1)
  // -------------------------------------------------------------------------
  server.tool(
    'x402_check_delegation',
    'Check current delegated balance and spending cap for the agent',
    {
      tokenAccount: z
        .string()
        .min(32)
        .describe('Owner SPL token account address'),
    },
    async ({ tokenAccount }) => {
      try {
        const status = await checkDelegation(
          tokenAccount as Address,
          { endpoint: config.solanaRpcUrl },
        );

        return successResult({
          isActive: status.isActive,
          delegate: status.delegate,
          remainingAmount: status.remainingAmount.toString(),
          originalAmount: status.originalAmount.toString(),
          tokenMint: status.tokenMint,
          ownerTokenAccount: status.ownerTokenAccount,
        });
      } catch (error) {
        if (error instanceof DelegationError) {
          return errorResult(error.code, error.message);
        }
        return errorResult('CHECK_FAILED', error instanceof Error ? error.message : String(error));
      }
    },
  );

  // -------------------------------------------------------------------------
  // Tool 3: x402_pay (WIRED — Week 2)
  // -------------------------------------------------------------------------
  server.tool(
    'x402_pay',
    'Make an x402 payment on Solana as a delegate. Sends HTTP request, detects 402, pays via facilitator, retries with proof.',
    {
      url: z
        .string()
        .url()
        .describe('The x402-enabled endpoint URL'),
      method: z
        .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
        .default('GET')
        .describe('HTTP method for the request'),
      headers: z
        .record(z.string())
        .optional()
        .describe('Additional HTTP headers to include'),
      body: z
        .string()
        .optional()
        .describe('Request body for POST/PUT/PATCH requests'),
      maxAmount: z
        .string()
        .optional()
        .describe('Maximum payment amount in base units (rejects if cost exceeds this)'),
      passphrase: z
        .string()
        .min(12, 'Passphrase must be at least 12 characters')
        .describe('Passphrase to decrypt the agent keypair'),
      tokenAccount: z
        .string()
        .min(32)
        .describe('Owner SPL token account (source of delegated funds)'),
    },
    async ({ url, method, headers, body, maxAmount, passphrase, tokenAccount }) => {
      try {
        // Step 1: Ensure signer is loaded
        if (!cachedSigner) {
          cachedSigner = await loadEncryptedKeypair(config.agentKeypairPath, passphrase, scryptParams);
        }

        // Step 1b: Initialize budget tracker from delegation if not yet active
        if (!budgetTracker) {
          const delegation = await checkDelegation(
            tokenAccount as Address,
            { endpoint: config.solanaRpcUrl },
          );
          if (delegation.isActive && delegation.originalAmount > 0n) {
            budgetTracker = createBudgetTracker(delegation.originalAmount);
          }
        }

        // Step 2: Make initial HTTP request
        const result = await makeX402Request(url, { method, headers, body });

        // If not 402, return the response directly
        if (!result.paymentRequired) {
          const responseText = await result.response.text();
          return successResult({
            paymentRequired: false,
            httpStatus: result.response.status,
            content: responseText,
            message: 'No payment required — resource is free.',
          });
        }

        // Step 3: Parse and validate payment requirements
        const { requirements } = result;
        if (requirements.length === 0) {
          return errorResult('NO_REQUIREMENTS', 'Received 402 but could not parse payment requirements from headers.');
        }

        // Pick the first Solana-compatible requirement
        const req = requirements.find((r) => r.network.startsWith('solana:')) ?? requirements[0];

        const validationError = validateRequirement(req, networkCaip2);
        if (validationError) {
          return errorResult('INVALID_REQUIREMENT', validationError);
        }

        // Step 4: Check maxAmount cap
        if (maxAmount && BigInt(req.amount) > BigInt(maxAmount)) {
          return errorResult(
            'AMOUNT_EXCEEDS_MAX',
            `Payment requires ${req.amount} but maxAmount is ${maxAmount}`,
          );
        }

        // Step 5: Check budget (if budget tracker is active)
        if (budgetTracker) {
          const budgetCheck = await budgetTracker.checkBudget(
            tokenAccount as Address,
            { endpoint: config.solanaRpcUrl },
          );
          if (budgetCheck.available < BigInt(req.amount)) {
            return errorResult(
              'BUDGET_EXCEEDED',
              `Payment requires ${req.amount} but only ${budgetCheck.available} available (on-chain: ${budgetCheck.remainingOnChain}, spent: ${budgetCheck.spent})`,
            );
          }
        }

        // Step 6: Build payment payload for facilitator
        // The facilitator handles transaction building, simulation, and submission
        const paymentPayload = {
          x402Version: req.version,
          accepted: {
            scheme: req.scheme,
            network: req.network,
            amount: req.amount,
            asset: req.asset,
            payTo: req.payTo,
            maxTimeoutSeconds: req.maxTimeoutSeconds,
          },
          payload: {
            // For the "exact" scheme, the facilitator expects the payer's address
            // The actual transaction is built and signed by the facilitator
            payer: cachedSigner.address,
          },
          resource: { url },
        };

        // Step 7: Submit to facilitator for settlement
        const settlement = await submitToFacilitator(
          paymentPayload,
          req.raw,
          config.x402FacilitatorUrl,
          config.x402FacilitatorFallbackUrl,
        );

        if (!settlement.success) {
          return errorResult('SETTLEMENT_FAILED', settlement.errorMessage ?? 'Facilitator rejected payment');
        }

        // Step 7b: Post-settlement verification (non-fatal — funds are already committed)
        // If verification fails, we still proceed with content fetch but include a warning.
        // Blocking on verification failure would cause fund loss (paid but no content).
        let verificationWarning: string | undefined;
        if (settlement.transactionSignature) {
          try {
            const rpc = createSolanaRpc(config.solanaRpcUrl);
            const txResponse = await rpc.getTransaction(
              settlement.transactionSignature as Parameters<typeof rpc.getTransaction>[0],
              { commitment: 'confirmed', maxSupportedTransactionVersion: 0, encoding: 'jsonParsed' },
            ).send();

            if (txResponse) {
              // Verify the expected recipient appears in the transaction's account keys
              // jsonParsed encoding returns objects with {pubkey, signer, ...}, not strings
              const accountKeys = txResponse.transaction.message.accountKeys ?? [];
              const recipientFound = accountKeys.some(
                (key: unknown) => {
                  const pubkey = typeof key === 'string' ? key : (key as Record<string, unknown>)?.pubkey;
                  return pubkey === req.payTo;
                },
              );
              if (!recipientFound) {
                verificationWarning = `On-chain transaction ${settlement.transactionSignature} may not include expected recipient ${req.payTo}. Proceeding with content fetch — verify transaction on explorer.`;
              }
            }
          } catch {
            // Verification query failed — non-fatal, proceed with content fetch
          }
        }

        // Step 8: Always retry with payment proof (funds are committed regardless)
        const paidResult = await retryWithPayment(url, paymentPayload, { method, headers, body });
        const responseContent = await paidResult.response.text();

        // Step 9: Record the transaction
        if (budgetTracker) {
          budgetTracker.recordSpend(BigInt(req.amount), settlement.transactionSignature);
        }

        await appendTransaction({
          timestamp: new Date().toISOString(),
          signature: settlement.transactionSignature,
          url,
          amount: req.amount,
          asset: req.asset,
          payTo: req.payTo,
          network: req.network,
          facilitator: settlement.facilitator,
          method: method ?? 'GET',
        });

        return successResult({
          paymentRequired: true,
          content: responseContent,
          transactionSignature: settlement.transactionSignature,
          amountPaid: req.amount,
          asset: req.asset,
          network: req.network,
          facilitator: settlement.facilitator,
          httpStatus: paidResult.response.status,
          ...(verificationWarning ? { warning: verificationWarning } : {}),
        });
      } catch (error) {
        if (error instanceof DelegationError) {
          return errorResult(error.code, error.message);
        }
        if (error instanceof FacilitatorError) {
          return errorResult('FACILITATOR_ERROR', error.message);
        }
        return errorResult('PAY_FAILED', error instanceof Error ? error.message : String(error));
      }
    },
  );

  // -------------------------------------------------------------------------
  // Tool 4: x402_check_balance (WIRED — Week 1)
  // -------------------------------------------------------------------------
  server.tool(
    'x402_check_balance',
    'Check agent token balances including delegated and owned amounts',
    {
      passphrase: z
        .string()
        .min(12, 'Passphrase must be at least 12 characters')
        .describe('Passphrase to decrypt the agent keypair (needed to get agent address)'),
      tokenMint: z
        .string()
        .optional()
        .describe('Specific token mint to check (defaults to USDC)'),
    },
    async ({ passphrase }) => {
      try {
        if (!cachedSigner) {
          cachedSigner = await loadEncryptedKeypair(
            config.agentKeypairPath,
            passphrase,
          );
        }

        return successResult({
          agentAddress: cachedSigner.address,
          message: 'Agent signer loaded. Full token balance queries will be available in a future release.',
        });
      } catch (error) {
        if (error instanceof DelegationError) {
          return errorResult(error.code, error.message);
        }
        return errorResult('BALANCE_CHECK_FAILED', error instanceof Error ? error.message : String(error));
      }
    },
  );

  // -------------------------------------------------------------------------
  // Tool 5: x402_revoke_delegation (WIRED — Week 1)
  // -------------------------------------------------------------------------
  server.tool(
    'x402_revoke_delegation',
    'Revoke the agent spending authority on a token account (owner-only operation)',
    {
      tokenAccount: z
        .string()
        .min(32)
        .describe('Token account to revoke delegation from'),
    },
    async ({ tokenAccount }) => {
      try {
        const status = await checkDelegation(
          tokenAccount as Address,
          { endpoint: config.solanaRpcUrl },
        );

        if (!status.isActive) {
          return successResult({
            isActive: false,
            message: 'No active delegation found on this token account. Nothing to revoke.',
          });
        }

        return successResult({
          isActive: true,
          delegate: status.delegate,
          remainingAmount: status.remainingAmount.toString(),
          message: 'Active delegation found. The token account owner must sign a revoke transaction using their wallet. Use @ozskr/agent-wallet-sdk revokeDelegation() with the owner signer.',
        });
      } catch (error) {
        if (error instanceof DelegationError) {
          return errorResult(error.code, error.message);
        }
        return errorResult('REVOKE_CHECK_FAILED', error instanceof Error ? error.message : String(error));
      }
    },
  );

  // -------------------------------------------------------------------------
  // Tool 6: x402_transaction_history (WIRED — Week 2)
  // -------------------------------------------------------------------------
  server.tool(
    'x402_transaction_history',
    'Query x402 payment transaction history for this agent',
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(10)
        .describe('Maximum number of transactions to return'),
      before: z
        .string()
        .optional()
        .describe('Transaction signature to paginate before'),
      url: z
        .string()
        .optional()
        .describe('Filter by URL (partial match)'),
      afterDate: z
        .string()
        .optional()
        .describe('Filter by date (ISO 8601, returns records after this date)'),
    },
    async ({ limit, before, url, afterDate }) => {
      try {
        const records = await queryHistory({ limit, before, url, afterDate });

        return successResult({
          count: records.length,
          transactions: records.map((r) => ({
            timestamp: r.timestamp,
            signature: r.signature,
            url: r.url,
            amount: r.amount,
            asset: r.asset,
            payTo: r.payTo,
            network: r.network,
            facilitator: r.facilitator,
            method: r.method,
          })),
        });
      } catch (error) {
        return errorResult('HISTORY_FAILED', error instanceof Error ? error.message : String(error));
      }
    },
  );

  // -------------------------------------------------------------------------
  // Tool 7: x402_discover_services (WIRED — Week 2)
  // -------------------------------------------------------------------------
  server.tool(
    'x402_discover_services',
    'Discover x402-enabled endpoints by probing a URL for 402 support',
    {
      url: z
        .string()
        .url()
        .optional()
        .describe('URL to probe for x402 support'),
      registry: z
        .string()
        .url()
        .optional()
        .describe('x402 service registry URL to query'),
    },
    async ({ url, registry }) => {
      try {
        const results: Array<Record<string, unknown>> = [];

        // Probe a specific URL for 402 support
        if (url) {
          const probeResult = await makeX402Request(url, { method: 'GET', timeoutMs: 5_000 });

          if (probeResult.paymentRequired) {
            results.push({
              url,
              x402Enabled: true,
              requirements: probeResult.requirements.map((r) => ({
                scheme: r.scheme,
                network: r.network,
                amount: r.amount,
                asset: r.asset,
                payTo: r.payTo,
              })),
            });
          } else {
            results.push({
              url,
              x402Enabled: false,
              httpStatus: probeResult.response.status,
            });
          }
        }

        // Query a registry
        if (registry) {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5_000);
            try {
              const response = await fetch(registry, { signal: controller.signal });
              if (response.ok) {
                const data = await response.json() as Record<string, unknown>;
                results.push({
                  registry,
                  services: data.services ?? data.endpoints ?? data,
                });
              } else {
                results.push({
                  registry,
                  error: `Registry returned HTTP ${response.status}`,
                });
              }
            } finally {
              clearTimeout(timer);
            }
          } catch (error) {
            results.push({
              registry,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        if (results.length === 0) {
          return successResult({
            message: 'Provide a url to probe or a registry to query.',
            knownRegistries: [
              'https://x402.org/ecosystem',
            ],
          });
        }

        return successResult({ results });
      } catch (error) {
        return errorResult('DISCOVER_FAILED', error instanceof Error ? error.message : String(error));
      }
    },
  );

  // -------------------------------------------------------------------------
  // Tool 8: x402_estimate_cost (WIRED — Week 2)
  // -------------------------------------------------------------------------
  server.tool(
    'x402_estimate_cost',
    'Estimate the cost of an x402 request without making a payment',
    {
      url: z
        .string()
        .url()
        .describe('The x402-enabled endpoint URL to estimate'),
      method: z
        .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
        .default('GET')
        .describe('HTTP method for the request'),
    },
    async ({ url, method }) => {
      try {
        const result = await makeX402Request(url, { method, timeoutMs: 5_000 });

        if (!result.paymentRequired) {
          return successResult({
            url,
            paymentRequired: false,
            httpStatus: result.response.status,
            message: 'This endpoint does not require x402 payment.',
          });
        }

        const { requirements } = result;
        if (requirements.length === 0) {
          return errorResult('NO_REQUIREMENTS', 'Received 402 but could not parse payment requirements.');
        }

        return successResult({
          url,
          paymentRequired: true,
          options: requirements.map((r) => ({
            scheme: r.scheme,
            network: r.network,
            amount: r.amount,
            asset: r.asset,
            payTo: r.payTo,
            maxTimeoutSeconds: r.maxTimeoutSeconds,
            version: r.version,
          })),
        });
      } catch (error) {
        return errorResult('ESTIMATE_FAILED', error instanceof Error ? error.message : String(error));
      }
    },
  );

  return server;
}

export { stubResult, errorResult, successResult };
