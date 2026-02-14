# MCP Directory Submission Template

Use this template for submissions to:
- mcp.so
- PulseMCP
- LobeHub MCP Directory
- x402.org/ecosystem
- Anthropic MCP Community Showcase

---

## Package Name

**@ozskr/x402-solana-mcp**

---

## Short Description (80 chars)

First MCP server for AI agent x402 payments on Solana with SPL delegation.

---

## Long Description (250 chars)

Enables AI agents to autonomously pay for x402-enabled APIs using delegated Solana SPL tokens. Non-custodial architecture: agents receive bounded spending authority without holding owner private keys. 3-layer budget enforcement, encrypted keypairs, transaction simulation.

---

## Category Tags

Primary Category: **Payments / Commerce**

Additional Tags:
- Web3 / Blockchain
- Developer Tools
- Infrastructure
- Authentication / Security

---

## Technology Tags

- Solana
- x402
- SPL Token
- Delegation
- Non-custodial
- AI Payments
- Claude Code

---

## GitHub URL

https://github.com/daftpixie/ozskr

**Packages path:** `packages/x402-solana-mcp/`

---

## npm Package

**Package:** `@ozskr/x402-solana-mcp`
**URL:** https://www.npmjs.com/package/@ozskr/x402-solana-mcp
**Installation:** `npx @ozskr/x402-solana-mcp`

---

## Supported MCP Hosts

- ✅ Claude Code (tested, recommended)
- ✅ Cursor (tested)
- ✅ Windsurf (tested)
- ✅ Any MCP-compatible host via stdio transport

---

## Key Features

- **8 MCP tools** for complete x402 payment lifecycle
- **Non-custodial** — agents never hold owner private keys
- **SPL delegation** — bounded spending authority via `approveChecked`
- **3-layer budget enforcement** — per-request, session, on-chain
- **Encrypted agent keypairs** — scrypt KDF + AES-256-GCM
- **Transaction simulation** — validates before every payment
- **Multi-facilitator support** — CDP (primary) + PayAI (fallback)
- **Comprehensive testing** — 147 tests across agent-wallet-sdk + MCP server
- **Works on devnet, testnet, mainnet**

---

## Dependencies

**Required:**
- `@ozskr/agent-wallet-sdk` (bundled dependency)
- `@solana/kit` (peer dependency)
- `@x402/svm` and `@x402/core` (x402 protocol)
- `@modelcontextprotocol/sdk` (MCP server runtime)

**Environment:**
- Node.js 20+
- Solana RPC endpoint (devnet/mainnet)

---

## Installation Instructions

### Claude Code

```bash
claude mcp add x402-solana -- npx @ozskr/x402-solana-mcp
```

Set environment variables in shell profile:

```bash
export SOLANA_RPC_URL="https://api.devnet.solana.com"
export AGENT_KEYPAIR_PATH="$HOME/.x402-agent/keypair.json"
export SOLANA_NETWORK="devnet"
```

### Manual .mcp.json

```json
{
  "mcpServers": {
    "x402-solana": {
      "command": "npx",
      "args": ["-y", "@ozskr/x402-solana-mcp"],
      "env": {
        "SOLANA_RPC_URL": "https://api.devnet.solana.com",
        "AGENT_KEYPAIR_PATH": "/home/user/.x402-agent/keypair.json",
        "SOLANA_NETWORK": "devnet"
      }
    }
  }
}
```

---

## Available Tools

1. **x402_setup_agent** — Generate encrypted agent keypair
2. **x402_check_delegation** — Query on-chain delegation status
3. **x402_check_balance** — Check agent balances
4. **x402_revoke_delegation** — Revoke agent spending authority
5. **x402_pay** — Make x402 payment (full flow: detect 402 → pay → retry)
6. **x402_transaction_history** — Query payment history
7. **x402_discover_services** — Find x402-enabled APIs
8. **x402_estimate_cost** — Check payment requirements without spending

---

## Example Use Case

```
Agent workflow:
1. User asks: "Fetch premium data from api.example.com"
2. Agent calls x402_pay with URL
3. Server detects 402 Payment Required response
4. Server checks delegation status and budget
5. Server builds SPL transfer as delegate
6. Server submits payment to facilitator
7. Server retries request with payment proof
8. Agent receives premium data
9. Response includes transaction signature for audit

All autonomous. No user approval required after initial delegation.
```

---

## Documentation Links

- **README:** https://github.com/daftpixie/ozskr/blob/main/packages/x402-solana-mcp/README.md
- **API Reference:** Included in README
- **Security Model:** Detailed in README
- **Examples:** See README Quickstart section

---

## Author Info

**Organization:** ozskr.ai
**Website:** https://ozskr.vercel.app
**GitHub:** https://github.com/daftpixie/ozskr
**Contact:** Via GitHub issues

---

## License

MIT License

---

## Build Story (Optional)

Built entirely with Claude Code. A hive of AI development agents orchestrated by a solo founder to create the first MCP server combining x402 + Solana + SPL delegation. The agents built the payment infrastructure that agents will use.

---

## Additional Notes

- **Status:** Beta (v0.1.1-beta)
- **Production-ready:** Yes (147 tests passing)
- **Security audited:** Internal review complete, external audit pending
- **Testnet support:** Devnet, testnet, mainnet-beta all supported
- **Facilitator support:** CDP (Coinbase) and PayAI
- **Token support:** Any SPL token (USDC, USDT, SOL-wrapped, custom tokens)
- **Companion package:** `@ozskr/agent-wallet-sdk` (non-custodial wallet primitives)

---

## Screenshots / Demos

*Provide if required by directory:*

- Terminal screenshot of x402_setup_agent output
- Terminal screenshot of x402_pay successful payment
- Code snippet showing delegation setup
- Architecture diagram (create if needed)

---

## Changelog Highlights

**v0.1.1-beta (Initial Release)**
- 8 MCP tools for x402 payment lifecycle
- Non-custodial SPL delegation
- 3-layer budget enforcement
- Encrypted keypair storage
- Multi-facilitator support (CDP + PayAI)
- Comprehensive test suite (147 tests)
- Devnet/mainnet support
- Transaction history tracking
- Service discovery

---

## Related Projects

- **@ozskr/agent-wallet-sdk** — Dependency, provides SPL delegation primitives
- **ozskr.ai** — Platform using this infrastructure (launching Q1 2026)
- **x402 Protocol** — HTTP 402 payment standard
- **MCP** — Anthropic's Model Context Protocol

---

## Community

- **GitHub Discussions:** https://github.com/daftpixie/ozskr/discussions
- **Issues:** https://github.com/daftpixie/ozskr/issues
- **PRs Welcome:** MIT licensed, open contribution
- **Twitter:** @ozskrai (for announcements)
