# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in ozskr.ai, @ozskr/agent-wallet-sdk,
or @ozskr/x402-solana-mcp, please report it responsibly.

**Do NOT open a public issue for security vulnerabilities.**

**Email:** matthew@vt-infinite.com
**Subject line:** [SECURITY] Brief description

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Suggested fix (if any)

We will acknowledge receipt within **48 hours** and provide a detailed response
within 7 days.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest main | Yes |
| Previous releases | No |

## Scope

### In Scope
- Wallet authentication bypass
- Transaction manipulation or signing vulnerabilities
- Private key or secret exposure
- Content moderation bypass
- Unauthorized data access (RLS bypass)
- Cross-character memory leakage (Mem0 isolation)
- `@ozskr/agent-wallet-sdk` npm package
- `@ozskr/x402-solana-mcp` npm package

### Out of Scope
- Social engineering attacks
- Denial of service
- Issues in third-party dependencies (report to upstream)
- Issues requiring physical access

## Safe Harbor

We support responsible disclosure. If you act in good faith to
identify and report vulnerabilities following this policy, we will
not pursue legal action against you.

## Bug Bounty

We do not currently offer a paid bug bounty program. Significant
findings will be acknowledged in our CHANGELOG.
