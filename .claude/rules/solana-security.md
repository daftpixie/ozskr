---
paths:
  - "src/lib/solana/**/*.ts"
  - "src/features/trading/**/*.ts"
  - "src/features/wallet/**/*.ts"
---

# Solana & DeFi Code Rules

## Mandatory

- Use @solana/kit exclusively â€” never import from @solana/web3.js
- All addresses must be validated with `assertIsAddress()` before use
- All transactions MUST call `simulateTransaction()` before `sendTransaction()`
- All swap operations MUST include slippageBps parameter (min 10, max 300)
- All write operations MUST have a user confirmation step before execution
- Never handle private keys or seed phrases in this code â€” signing is wallet-adapter only
- Use BigInt for all lamport/token amounts â€” never floating point
- Wrap all RPC calls in try/catch with meaningful error messages
- Add JSDoc comments explaining the security implications of each function

## Priority Fees

- Use Helius `getPriorityFeeEstimate` API for dynamic priority fees
- Always include priority fee in transaction cost estimation
- Provide fallback to default priority fee if Helius estimation fails
- Display estimated total cost (base + priority) to user before confirmation

## Jupiter Ultra

- Use Jupiter Ultra API (`/ultra/v1/order`) â€” NOT legacy V6 API
- Always validate quote response before building transaction
- Include platform fee configuration if applicable
- Handle route unavailability gracefully with user-facing error messages

## @solana/compat (Anchor Bridging)

- Use `@solana/compat` ONLY when interacting with Anchor-based programs
- Prefer native @solana/kit patterns whenever possible
- Document any compat usage with comments explaining why it's needed
