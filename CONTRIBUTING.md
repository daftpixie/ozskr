# Contributing to ozskr.ai

Welcome! ozskr.ai is an open-source Web3 AI Agent platform built on Solana, developed exclusively with Claude Code. We welcome contributions from both human developers and AI-assisted workflows.

## Getting Started

1. **Fork the repo** and clone your fork
2. **Set up your environment** â€” see `docs/WINDOWS_DEV_SETUP.md` for Windows or install dependencies directly on Linux/macOS
3. **Install dependencies**: `pnpm install`
4. **Read CLAUDE.md** â€” this is the project's source of truth for conventions and patterns
5. **Create a feature branch**: `git checkout -b feat/your-feature`

## Development Workflow

```bash
# Start development
pnpm dev

# Before committing â€” always run both
pnpm lint
pnpm typecheck

# Run tests for your changes
pnpm test src/path/to/your.test.ts

# Commit with conventional format
git commit -m "feat: add Jupiter swap quote display"
```

## AI-Assisted Development Policy

This project embraces AI-assisted development. Here's our policy:

**Transparency**: If a PR contains substantial AI-generated code (more than a few lines of boilerplate), add the `Assisted-by: Claude Code` trailer to your commit message:

```
feat: implement Jupiter Ultra swap integration

Implemented the swap quote fetching and route display
components using the Jupiter Ultra API.

Assisted-by: Claude Code
```

**Accountability**: You are responsible for every line you submit, regardless of whether it was AI-generated. Review AI output carefully, especially:
- Solana transaction construction and signing flows
- DeFi operations (slippage, amounts, token addresses)
- API route security (input validation, auth checks)
- Environment variable handling

**Security-Critical Code**: Changes to these paths require extra human review:
- `src/lib/solana/` â€” transaction builders, RPC clients
- `src/features/trading/` â€” Jupiter, Raydium integration
- `src/features/wallet/` â€” wallet connection, signing
- `src/app/api/` â€” server-side API routes

## MCP Packages (`packages/`)

The `packages/` directory contains open-source npm packages published under the `@ozskr` scope:

- **`@ozskr/agent-wallet-sdk`** -- SPL delegation primitives for AI agent wallets
- **`@ozskr/x402-solana-mcp`** -- MCP server for x402 payments on Solana

### Package Development

```bash
# Typecheck both packages
pnpm --filter @ozskr/* typecheck

# Run all package tests
pnpm --filter @ozskr/* test

# Run tests for a single package
pnpm --filter @ozskr/agent-wallet-sdk test

# Build for publication
pnpm --filter @ozskr/* build
```

### Adding a New MCP Tool

1. Add the tool definition in `packages/x402-solana-mcp/src/server.ts` using `server.tool()`
2. Define the Zod input schema inline (all inputs must be validated)
3. Return results via `successResult()` or `errorResult()` helpers
4. Add tests in `packages/x402-solana-mcp/tests/server.test.ts`
5. Update the README tool reference table

### Package Security Requirements

- Agent keypairs must be encrypted at rest (scrypt + AES-256-GCM)
- File permissions must be 0600 for keypair files
- No secrets or hardcoded endpoints in published packages
- All Solana addresses validated with `assertIsAddress()` before use
- Transaction simulation required before any on-chain submission

## Code Standards

- **TypeScript strict** â€” no `any`, use `unknown` + type narrowing
- **@solana/kit** â€” never use deprecated web3.js v1 patterns
- **Named exports** â€” no default exports (except Next.js pages)
- **Zod validation** â€” all external data must be validated
- **Tests required** â€” DeFi functions must have tests, other functions should have tests

## Pull Request Process

1. Ensure `pnpm lint && pnpm typecheck` passes
2. Write/update tests for your changes
3. Update documentation if you changed public APIs
4. Fill out the PR template
5. Claude Code will automatically review your PR via GitHub Actions
6. Security-critical paths trigger an additional security-focused review
7. A maintainer will review and merge

## Security

If you discover a security vulnerability, **do NOT open a public issue**. Email matthew@vt-infinite.com with details. We'll respond within 48 hours.

## License

By contributing, you agree that your contributions will be licensed under the project's open-source license.
