# Devnet Smoke Test Checklist

Manual testing checklist for ozskr.ai trading features on Solana devnet.

**Prerequisites:**
- Phantom wallet installed (or Solflare/Backpack)
- Wallet switched to devnet (`Settings > Developer Settings > Testnet Mode`)
- App running locally: `pnpm dev`
- Environment: `NEXT_PUBLIC_HELIUS_RPC_URL` pointing to devnet endpoint

## Wallet Connection

- [ ] Connect Phantom wallet on devnet
- [ ] Wallet address displays correctly in sidebar
- [ ] Session persists across page refresh
- [ ] Disconnect wallet clears session

## Token Balances

- [ ] Fetch SOL balance displays correctly
- [ ] Balance shown in human-readable format (not lamports)
- [ ] Request devnet airdrop via Solana faucet (https://faucet.solana.com)
- [ ] Balance updates after airdrop (may need refresh)

## Swap Quote

- [ ] Get quote for SOL -> USDC swap
- [ ] Quote shows input amount and expected output
- [ ] Verify quote shows slippage tolerance (default 0.5%)
- [ ] Verify quote shows estimated network fee
- [ ] Verify quote shows minimum received after slippage
- [ ] Price impact indicator shows correct color (green/yellow/red)
- [ ] Quote refreshes when "Refresh Quote" clicked
- [ ] Quote expires indicator counts down

## Slippage Settings

- [ ] Default slippage is 0.5% (50 bps)
- [ ] Preset buttons work: 0.5%, 1%, 2%
- [ ] Custom slippage input accepts valid values (0.1% - 3%)
- [ ] Custom slippage rejects values below 0.1%
- [ ] Custom slippage rejects values above 3%
- [ ] High slippage warning appears when > 1%

## Swap Execution

- [ ] Confirm swap -- simulation runs first
- [ ] Confirmation modal shows full swap details before signing
- [ ] Modal displays: amount, fees, slippage, minimum received
- [ ] Progress indicator shows simulation stage
- [ ] Wallet signature popup appears after simulation passes
- [ ] User can reject wallet signature (flow cancels cleanly)
- [ ] Transaction confirms on devnet
- [ ] Success view shows Solscan link to transaction
- [ ] Solscan link opens correct devnet transaction

## Transaction History

- [ ] Swap appears in transaction history after completion
- [ ] History shows correct status badge (confirmed/pending/failed)
- [ ] History shows token pair and amounts
- [ ] Solscan links in history work correctly
- [ ] Pagination works when > 20 swaps

## Portfolio

- [ ] Portfolio updates with new balances after swap
- [ ] Total portfolio value displays (USD estimate)
- [ ] Token list shows balances with correct decimals
- [ ] Auto-refresh indicator visible (30s intervals)
- [ ] "Trade" button on token row navigates to trade page
- [ ] Empty state shows for tokens with zero balance

## Error Handling

- [ ] Insufficient balance shows user-friendly error
- [ ] Simulation failure aborts swap (no signing prompt)
- [ ] Network timeout shows retry option
- [ ] Invalid token pair shows "no route" message
- [ ] Wallet disconnection mid-flow shows clean error

## Rate Limiting

- [ ] Rate limiting triggers after rapid quote requests (60/min)
- [ ] Rate limiting triggers after rapid swap requests (10/min)
- [ ] 429 response shows "rate limited" message to user
- [ ] Retry-After header respected

## Security Verification

- [ ] No private keys visible in browser devtools/network tab
- [ ] All transactions signed client-side via wallet popup
- [ ] RPC endpoint not exposed in client-side JavaScript
- [ ] JWT token included in API requests (check network tab)
- [ ] Unauthenticated API requests return 401

## Notes

Record any issues or observations here:

```
Date:
Tester:
Browser:
Wallet:
Issues found:
```
