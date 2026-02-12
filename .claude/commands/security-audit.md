---
description: Run a security audit on staged or specified files
allowed-tools: Read, Grep, Glob
---

Perform a comprehensive security audit using the `security-auditor` agent's checklist. Focus on:

1. Scan $ARGUMENTS (or `git diff --cached` if no arguments) for security issues
2. Check all 10 audit categories from the security-auditor definition
3. Flag any KEY_EXPOSURE, TX_SAFETY, SLIPPAGE, ADDRESS, RLS, VALIDATION, RATE_LIMIT, MEM0_ISOLATION, MODERATION, or DEPENDENCY issues
4. Report Pass/Fail with file:line references

Output the standard security audit format. Critical failures MUST block the commit.
