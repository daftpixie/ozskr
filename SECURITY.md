# Security Policy

## Reporting a Vulnerability

**Do NOT open a public issue for security vulnerabilities.**

Email **security@ozskr.ai** with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment

We will respond within **48 hours** and provide a timeline for resolution.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest main | ✅ |
| Previous releases | ❌ |

## Scope

### In Scope
- Wallet authentication bypass
- Transaction manipulation or signing vulnerabilities
- Private key or secret exposure
- Content moderation bypass
- Unauthorized data access (RLS bypass)
- Cross-character memory leakage (Mem0 isolation)

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