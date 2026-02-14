# RFC: SPL Delegation Pattern for Non-Custodial Agent Wallets

**Status:** Request for Comments
**Author:** ozskr.ai team
**Date:** February 2026
**Related Packages:** `@ozskr/agent-wallet-sdk`, `@ozskr/x402-solana-mcp`

---

## Abstract

We propose using SPL token delegation (`approveChecked` / `transferChecked`) as the standard pattern for non-custodial AI agent wallets on Solana. This RFC describes the approach, compares it to alternatives, presents the security model, and solicits community feedback on production deployment considerations.

**Implementation:** https://github.com/daftpixie/ozskr/tree/main/packages/agent-wallet-sdk

---

## Motivation

AI agents need to make autonomous payments on behalf of users without:

1. **Holding user private keys** (custody risk)
2. **Requiring per-transaction approval** (breaks autonomy)
3. **Deploying custom smart contracts** (audit cost, attack surface)

Existing solutions either compromise on security (custodial), autonomy (multi-sig), or complexity (custom delegation contracts). SPL token delegation is a battle-tested primitive built into the Token Program that solves all three constraints.

---

## Background: The Agent Payment Problem

### Use Cases

- **API payments:** Agent pays for premium data, AI model access, storage
- **Content monetization:** Agent tips creators, pays for licensed assets
- **DeFi operations:** Agent executes swaps, deposits, staking (bounded budget)
- **Commerce:** Agent purchases digital goods, services on user's behalf

### Constraints

1. **Non-custodial:** User retains full control of funds
2. **Autonomous:** Agent can act without per-transaction user interaction
3. **Bounded:** Agent spending capped at predefined limit
4. **Revocable:** User can cancel agent authority at any time
5. **Auditable:** All transactions on-chain, transparent history
6. **Simple:** No custom contract deployment, uses standard SPL primitives

---

## Proposed Pattern: SPL Delegation

### How It Works

SPL Token Program includes built-in delegation:

```rust
// SPL Token Program (existing on-chain code)
pub enum TokenInstruction {
    ApproveChecked {
        amount: u64,      // Max spending cap
        decimals: u8,     // Token decimals (validation)
    },
    TransferChecked {
        amount: u64,      // Transfer amount
        decimals: u8,     // Token decimals (validation)
    },
    Revoke,               // Cancel all delegation
}
```

### Lifecycle

**1. Setup (Owner):**

```typescript
// Owner approves agent to spend up to 100 USDC
await createDelegation({
  ownerTokenAccount: ownerUSDCAccount,
  ownerSigner: walletSigner,
  delegateAddress: agentPublicKey,
  tokenMint: USDC_MINT,
  maxAmount: 100_000_000n,  // 100 USDC
  decimals: 6,
});
```

**On-chain result:** Agent address is set as `delegate` on owner's token account, with `delegatedAmount = 100 USDC`.

**2. Execution (Agent):**

```typescript
// Agent spends 5 USDC on API payment
await transferAsDelegate({
  delegateSigner: agentKeypairSigner,
  sourceTokenAccount: ownerUSDCAccount,  // Owner's account (source of funds)
  destinationTokenAccount: apiProviderAccount,
  amount: 5_000_000n,  // 5 USDC
  decimals: 6,
  tokenMint: USDC_MINT,
  feePayer: agentKeypairSigner,  // Agent pays SOL fee
});
```

**On-chain validation:** SPL Token Program checks:
- Is `agentPublicKey` the current delegate? ✅
- Is `amount <= delegatedAmount`? ✅
- Does `tokenMint` match? ✅
- Does `decimals` match? ✅

Transaction fails if any check fails. After success, `delegatedAmount -= 5 USDC`.

**3. Revocation (Owner):**

```typescript
// Owner cancels delegation
await revokeDelegation({
  ownerSigner: walletSigner,
  tokenAccount: ownerUSDCAccount,
});
```

**On-chain result:** `delegate = null`, `delegatedAmount = 0`. Agent can no longer spend.

---

## Security Model

### On-Chain Enforcement

SPL Token Program guarantees:

1. **Amount cap:** Agent cannot exceed `delegatedAmount` (enforced in `transferChecked`)
2. **Mint validation:** `approveChecked` locks the mint — agent can't transfer wrong token
3. **Decimal validation:** Prevents decimal manipulation attacks
4. **Single delegate:** Only one active delegate per token account at a time
5. **Revocable:** Owner can call `revoke` anytime, immediately invalidating delegation

### Client-Side Defense-in-Depth

`@ozskr/agent-wallet-sdk` adds three additional layers:

**Layer 1: Budget Tracker**

```typescript
const budget = createBudgetTracker(100_000_000n);

// Before every payment
const check = await budget.checkBudget(tokenAccount, rpcConfig);
if (check.available < paymentAmount) {
  throw new Error('Insufficient budget');
}

// After payment
budget.recordSpend(paymentAmount, signature);
```

Combines on-chain query (`checkDelegation`) with local spend tracking. Prevents race conditions where multiple agents spend concurrently.

**Layer 2: Per-Request Caps**

```typescript
// In x402_pay MCP tool
{
  maxAmount: "1000000",  // Reject if API cost > 1 USDC
}
```

User can set per-request limits. If API returns `402 Payment Required: 5 USDC`, payment is rejected even if delegation allows it.

**Layer 3: Transaction Simulation**

```typescript
// Before submission
const simulationResult = await rpc.simulateTransaction(signedTx).send();
if (simulationResult.value.err) {
  throw new Error('Simulation failed');
}
```

Every `transferAsDelegate` call simulates first. Prevents on-chain failures that would consume SOL fees.

### Keypair Security

Agent keypair (which holds delegate authority, not funds):

- **Generation:** CSPRNG via `@solana/kit`
- **Encryption:** scrypt KDF (N=2^20) + AES-256-GCM
- **Storage:** File permissions 0600 (owner read/write only)
- **Passphrase:** Minimum 12 characters, user-controlled
- **Memory safety:** Decrypted bytes zeroed after use

Compromise of agent keypair ≠ loss of funds. Attacker can only spend up to remaining `delegatedAmount`. Owner calls `revoke` to stop it.

---

## Alternative Approaches (Comparison)

### 1. Custodial (Agent Holds Keys)

**Pattern:** User deposits funds to agent-controlled wallet.

**Pros:**
- Simple implementation
- No delegation setup

**Cons:**
- ❌ **Custody risk:** Agent compromise = total loss of funds
- ❌ **Regulatory risk:** Platform becomes money transmitter
- ❌ **Trust requirement:** User must trust platform operator

**Verdict:** Unacceptable for production.

---

### 2. Multi-Sig (N-of-M Approval)

**Pattern:** Agent + owner both sign every transaction.

**Pros:**
- Non-custodial
- Strong security

**Cons:**
- ❌ **Breaks autonomy:** User must approve every payment
- ❌ **UX friction:** Wallet popup interrupts agent workflow
- ❌ **Latency:** Agent waits for human approval (seconds to minutes)

**Verdict:** Defeats the purpose of autonomous agents.

---

### 3. PDA with Custom Program

**Pattern:** Deploy Solana program that creates PDA, agent signs instruction to trigger PDA transfer.

**Pros:**
- Flexible logic (complex spending rules, time locks, etc.)
- Non-custodial

**Cons:**
- ❌ **Deployment cost:** Must deploy program to mainnet
- ❌ **Audit cost:** Custom contract = custom security review ($10-30K)
- ❌ **Complexity:** Anchor program + PDA management + CPI to Token Program
- ❌ **Gas cost:** Multiple transactions (init PDA, fund PDA, agent invoke, close PDA)

**Verdict:** Overkill for simple spending cap use case.

---

### 4. SPL Delegation (Proposed)

**Pattern:** Use built-in Token Program delegation.

**Pros:**
- ✅ Non-custodial
- ✅ Autonomous (no per-tx approval)
- ✅ Bounded (on-chain spending cap)
- ✅ Revocable (instant via `revoke`)
- ✅ Battle-tested (Token Program code audited, in production since 2020)
- ✅ Simple (3 instructions: approve, transfer, revoke)
- ✅ Gas-efficient (minimal transactions)

**Cons:**
- ⚠️ Single active delegate per token account (can't have multiple agents)
- ⚠️ No time-based expiry (delegation persists until spent or revoked)
- ⚠️ No complex spending rules (flat cap, no per-day limits)

**Verdict:** Best balance of security, autonomy, and simplicity for majority of agent payment use cases.

---

## Implementation Details

### Core Functions (from `@ozskr/agent-wallet-sdk`)

```typescript
// 1. Create delegation
export async function createDelegation(
  config: DelegationConfig,
  rpcConfig: RpcConfig,
): Promise<CompilableTransactionMessage>

// 2. Check delegation status
export async function checkDelegation(
  tokenAccount: Address,
  rpcConfig: RpcConfig,
): Promise<DelegationStatus>

// 3. Transfer as delegate
export async function transferAsDelegate(
  params: TransferAsDelegateParams,
  rpcConfig: RpcConfig,
): Promise<string>  // Returns transaction signature

// 4. Revoke delegation
export async function revokeDelegation(
  params: RevokeDelegationParams,
  rpcConfig: RpcConfig,
): Promise<CompilableTransactionMessage>
```

### Error Handling

```typescript
enum DelegationErrorCode {
  NO_ACTIVE_DELEGATION,       // Agent tries to spend, no delegation exists
  INSUFFICIENT_DELEGATION,    // Amount exceeds remaining delegation
  SIMULATION_FAILED,          // Transaction would fail on-chain
  INVALID_ADDRESS,            // Address validation failed
  RPC_ERROR,                  // Network/RPC issue
}

try {
  await transferAsDelegate(params, rpcConfig);
} catch (error) {
  if (error instanceof DelegationError) {
    console.error(`Delegation error: ${error.code}`);
  }
}
```

### Budget Tracking

```typescript
const budget = createBudgetTracker(100_000_000n);

// Check combined on-chain + local budget
const check = await budget.checkBudget(tokenAccount, rpcConfig);
console.log(`Available: ${check.available}`);
console.log(`On-chain: ${check.remainingOnChain}`);
console.log(`Spent locally: ${check.spent}`);

// Record spend (after tx confirms)
budget.recordSpend(5_000_000n, signature);

// Audit trail
const history = budget.getSpendHistory();
// [{ amount: 5000000n, signature: "...", timestamp: "..." }]
```

---

## Production Considerations

### Open Questions for Community

1. **Multi-token delegation:**
   - Current: One delegation per token account
   - Scenario: Agent needs to spend USDC *and* SOL
   - Options: (a) Two token accounts with separate delegations, (b) Single "master" token with auto-swap via Jupiter
   - **Question:** Is auto-swap too much complexity for v1? Should we just require users to delegate each token separately?

2. **Delegation refresh:**
   - Current: Owner must manually call `approve` again when `delegatedAmount` is exhausted
   - Scenario: Long-running agent needs continuous access
   - Options: (a) Auto-approve pattern (risky), (b) Notification to owner when <10% remaining, (c) Subscription model (daily/weekly auto-approve)
   - **Question:** What's the least-friction way to handle refills without compromising security?

3. **Multi-agent delegation:**
   - Current: Single delegate per token account
   - Scenario: User has multiple agents (content agent, trading agent, research agent)
   - Options: (a) Separate token accounts per agent, (b) Single shared agent with sub-budgets, (c) Migrate to custom PDA program
   - **Question:** Is single-delegate limitation a blocker for real-world use? Or is separate token accounts acceptable?

4. **Time-based expiry:**
   - Current: Delegation persists until spent or revoked
   - Scenario: User wants delegation to auto-expire after 24 hours
   - Options: (a) Client-side expiry check (can be bypassed), (b) Migrate to custom program with on-chain time lock
   - **Question:** Is client-side expiry check sufficient? Or do we need on-chain enforcement?

5. **Gas fee payment:**
   - Current: Agent pays SOL transaction fees from its own balance
   - Scenario: Agent runs out of SOL, can't submit transactions even though delegation is active
   - Options: (a) Owner funds agent with SOL, (b) Fee-payer service (platform covers fees), (c) Owner pays fees (requires dual-signer)
   - **Question:** What's the expected pattern? Should platforms provide fee-payer services, or is owner-funded agent standard?

6. **Revocation UX:**
   - Current: Owner must explicitly call `revoke`
   - Scenario: Owner forgets to revoke, agent continues spending
   - Options: (a) Auto-revoke on agent uninstall (requires agent cooperation), (b) Dashboard showing all active delegations, (c) Push notifications when agent spends
   - **Question:** What UX patterns prevent "forgotten delegation" risk?

---

## Security Assumptions

This pattern assumes:

1. **Owner wallet is secure:** If owner wallet is compromised, attacker can create unlimited delegations.
2. **RPC is honest:** `checkDelegation` relies on RPC returning accurate on-chain state.
3. **Agent keypair is encrypted:** Passphrase must be strong (12+ chars, not dictionary word).
4. **Client-side budget tracker is advisory:** On-chain delegation is source of truth. Local tracker is convenience + defense-in-depth.
5. **Facilitator is trusted for x402:** Facilitators build/sign transactions but cannot exceed delegation cap.

---

## Threat Model

### Threats Mitigated

| Threat | Mitigation |
|--------|-----------|
| Agent spends more than approved | On-chain delegation cap enforced by Token Program |
| Agent transfers wrong token | `approveChecked` locks mint, `transferChecked` validates |
| Agent holds user private keys | Agent only holds delegate keypair, not owner keys |
| Runaway spending | 3-layer budget enforcement (per-request, session, on-chain) |
| Owner wants to stop agent | `revoke` instruction immediately invalidates delegation |
| Transaction fails, wastes fees | `simulateTransaction` validates before submission |

### Threats NOT Mitigated

| Threat | Residual Risk | Mitigation Strategy |
|--------|---------------|---------------------|
| Agent keypair compromised | Attacker can spend up to remaining delegation | Owner calls `revoke` ASAP. Low-stakes for small delegations (<$100). |
| Owner forgets to revoke | Agent continues spending until cap reached | Dashboard showing active delegations + spend notifications |
| RPC returns false data | Agent makes decisions based on incorrect state | Use trusted RPC (Helius, QuickNode), verify critical tx on-chain |
| Concurrent agents drain budget | Race condition if multiple agents check budget simultaneously | Budget tracker + optimistic locking (record intent before spend) |
| Time-based attacks | Delegation persists indefinitely if not revoked | Client-side expiry check (weak) or migrate to custom program (v2) |

---

## Adoption Path

### For Developers

1. **Install SDK:** `npm install @ozskr/agent-wallet-sdk`
2. **Generate agent keypair:** `generateAgentKeypair()` + `storeEncryptedKeypair()`
3. **Owner delegates tokens:** `createDelegation()`
4. **Agent spends:** `transferAsDelegate()`
5. **Owner revokes:** `revokeDelegation()`

### For Platforms

1. **Integrate SDK into platform backend**
2. **UI for delegation setup:** "Approve [Agent Name] to spend up to [Amount] [Token]"
3. **Dashboard showing active delegations + spend history**
4. **Notifications when agent spends or budget low**
5. **One-click revoke button**

### For MCP Users

1. **Install MCP server:** `claude mcp add x402-solana -- npx @ozskr/x402-solana-mcp`
2. **Generate agent keypair:** `x402_setup_agent`
3. **Delegate via wallet:** Use platform UI or `@ozskr/agent-wallet-sdk` directly
4. **Agent pays autonomously:** `x402_pay`

---

## Future Directions

### v2 Features (Potential)

- **Time-based expiry:** On-chain time lock via custom program
- **Multi-agent support:** PDA-based shared budget with per-agent sub-caps
- **Auto-refill:** Owner pre-approves recurring delegations (risky, needs careful design)
- **Conditional spending:** On-chain rules (e.g., "only spend on whitelisted recipients")
- **Multi-token single delegation:** Aggregate budget across SOL/USDC/etc. via Jupiter auto-swap

### Ecosystem Integration

- **Wallet adapter plugins:** Phantom/Solflare one-click delegation UI
- **Analytics dashboards:** Track agent spending across ecosystem
- **Standard delegation metadata:** On-chain tags for agent purpose, expiry, categories
- **Facilitator registry:** Decentralized list of trusted x402 facilitators

---

## Request for Comments

We're seeking feedback on:

1. **Is SPL delegation sufficient for production agent wallets, or do we need custom programs?**
2. **What patterns should we standardize for multi-agent and multi-token scenarios?**
3. **Should client-side expiry checks be included in v1, or defer to v2 custom program?**
4. **What UX is needed to prevent "forgotten delegation" risk?**
5. **Are there security considerations we've missed?**

**Comment on this discussion or open an issue:** https://github.com/daftpixie/ozskr/discussions

---

## Reference Implementation

- **Package:** `@ozskr/agent-wallet-sdk`
- **MCP Server:** `@ozskr/x402-solana-mcp`
- **GitHub:** https://github.com/daftpixie/ozskr/tree/main/packages
- **Tests:** 147 tests covering delegation lifecycle, error handling, edge cases
- **License:** MIT

---

## Acknowledgments

- **SPL Token Program:** Solana Labs (original delegation design)
- **@solana/kit maintainers:** Modern SDK patterns
- **x402 Protocol:** Coinbase Payments team
- **MCP:** Anthropic
- **Claude Code:** For orchestrating the AI agent hive that built this

---

**Built by agents, for agents.**
