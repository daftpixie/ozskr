# Day 0 Metrics Baseline — MCP Packages Publication

**Date**: 2026-02-14
**Packages**: `@ozskr/agent-wallet-sdk@0.1.0-beta`, `@ozskr/x402-solana-mcp@0.1.1-beta`

## npm Metrics

| Metric | Day 0 Value |
|--------|-------------|
| `@ozskr/agent-wallet-sdk` weekly downloads | 0 |
| `@ozskr/x402-solana-mcp` weekly downloads | 0 |
| Total npm dependents | 0 |

## GitHub Metrics

| Metric | Day 0 Value |
|--------|-------------|
| Stars | 0 |
| Forks | 0 |
| Watchers | 0 |
| Open issues | 1 |
| Total commits | 103 |
| Release tags | 2 (`@0.1.0-beta`) |

## Package Stats

| Metric | Value |
|--------|-------|
| Source LOC (packages/) | 2,416 |
| Test count (packages/) | 147 (59 SDK + 88 MCP) |
| Test files | 9 |
| Tarball size (SDK) | 20.3 kB |
| Tarball size (MCP) | 24.6 kB |
| Dependencies (SDK) | 2 (`@solana/kit`, `@solana-program/token`) |
| Dependencies (MCP) | 6 (`@solana/kit`, `@x402/svm`, `@x402/core`, `@modelcontextprotocol/sdk`, `@ozskr/agent-wallet-sdk`, `zod`) |

## MCP Ecosystem Metrics

| Metric | Day 0 Value |
|--------|-------------|
| MCP directory listings | 0 (submissions pending) |
| Known MCP client connections | 0 |
| x402 payments processed | 0 |

## Community Metrics

| Metric | Day 0 Value |
|--------|-------------|
| X/Twitter thread impressions | 0 (pending publication) |
| Solana dev forum views | 0 (pending publication) |
| GitHub Discussions | 0 (RFC pending) |

## Weekly Monitoring Checklist

Run weekly on Fridays:

```bash
# npm downloads (requires npm-stat or similar)
# Check: https://www.npmjs.com/package/@ozskr/agent-wallet-sdk
# Check: https://www.npmjs.com/package/@ozskr/x402-solana-mcp

# GitHub metrics
gh api repos/daftpixie/ozskr --jq '{stars: .stargazers_count, forks: .forks_count, watchers: .subscribers_count}'

# Open issues/PRs
gh issue list --label "mcp" --state open
gh pr list --state open

# npm package health
npm info @ozskr/agent-wallet-sdk
npm info @ozskr/x402-solana-mcp
```

## Targets (Week 4)

| Metric | Target |
|--------|--------|
| npm weekly downloads (combined) | 50+ |
| GitHub stars | 10+ |
| MCP directory listings | 3+ |
| Community issues/PRs | 2+ |
| x402 test payments | 5+ (devnet) |

## Notes

- Both packages published with `--tag beta` (not latest)
- Attorney sign-off obtained for non-custodial SPL delegation model
- Attorney confirmed OSS publication does not fall under Tornado Cash pattern
- Security audit: PASS (10/10 checks, 0 failures)
- All 147 tests passing at time of publication
