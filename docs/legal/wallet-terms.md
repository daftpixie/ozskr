# DRAFT — REQUIRES ATTORNEY REVIEW — NOT LEGAL ADVICE

# ozskr.ai Wallet & Transaction Terms

**Effective Date:** [DATE — TO BE SET]

**Last Updated:** February 13, 2026

---

## 1. Introduction

These Wallet & Transaction Terms ("Wallet Terms") govern your use of wallet-connected features and decentralized finance (DeFi) functionality on the ozskr.ai platform ("Platform," "we," "us," or "our"). These terms supplement our Terms of Service and Privacy Policy.

By connecting a Solana wallet to the Platform and using any blockchain-related features, you acknowledge that you have read, understood, and agreed to be bound by these Wallet Terms.

**IMPORTANT: The Platform is a non-custodial interface. We do not hold, control, or have access to your funds. You maintain full responsibility for the security and management of your wallet and private keys.**

---

## 2. Non-Custodial Architecture

### 2.1 No Custody of Funds

- The Platform **NEVER** holds, stores, controls, or has access to user funds, tokens, or assets
- The Platform **NEVER** holds, stores, or has access to private keys, seed phrases, or wallet credentials
- The Platform **NEVER** takes custody of cryptocurrency on behalf of users
- All cryptocurrency assets remain in user-controlled wallets at all times

### 2.2 Interface Only

- The Platform acts solely as a frontend interface to interact with the Solana blockchain and third-party DeFi protocols
- The Platform facilitates the construction and display of transaction data but does not execute transactions on your behalf
- All transaction signing occurs client-side via your connected wallet software (e.g., Phantom, Solflare, Backpack)

### 2.3 User Responsibility

- You maintain full control and ownership of all assets in your wallet at all times
- You are solely responsible for:
  - Safeguarding your private keys and seed phrases
  - Verifying the security of your wallet software
  - Understanding the risks associated with blockchain transactions
  - Ensuring the accuracy of all transaction details before signing
  - Backing up your wallet recovery information

### 2.4 Platform Limitations

- The Platform **CANNOT**:
  - Recover lost or stolen funds
  - Reverse, cancel, or modify confirmed blockchain transactions
  - Access your wallet if you lose your private keys or seed phrase
  - Freeze, restrict, or control your wallet or assets
  - Provide refunds for blockchain transactions

---

## 3. Wallet Connection

### 3.1 Authentication Method

- The Platform uses Sign-In with Solana (SIWS) for wallet-based authentication
- Your public Solana wallet address serves as your account identifier
- Authentication creates a session token but does not grant the Platform access to your wallet contents or private keys

### 3.2 Wallet Address as Identity

- Your wallet address is linked to your Platform account for authentication and data association
- There is no automatic relationship between your Platform account and the contents, balances, or activity of your connected wallet
- Connecting a wallet does not authorize the Platform to access wallet contents, execute transactions, or manage assets

### 3.3 Wallet Disconnection

- You may disconnect your wallet from the Platform at any time through your wallet software or the Platform interface
- Disconnecting your wallet terminates your current session but does not delete your Platform account or associated data
- You may reconnect the same wallet or connect a different wallet address to your account

### 3.4 Multiple Wallets

- You may connect multiple wallet addresses to separate Platform accounts
- Each wallet address is treated as a distinct account identity
- Character configurations, generated content, and other Platform data are isolated per wallet address

---

## 4. Transaction Execution

### 4.1 Explicit User Confirmation Required

- **ALL** blockchain transactions initiated through the Platform require explicit confirmation via your wallet software's approval popup
- You must manually review and approve each transaction before it is broadcast to the blockchain
- The Platform **NEVER** auto-signs, pre-approves, or executes transactions without your explicit consent

### 4.2 Transaction Simulation

- The Platform simulates transactions using Solana's `simulateTransaction` RPC method before presenting them for your approval
- Transaction simulation provides an estimate of transaction success and resource consumption
- **Simulation does NOT guarantee transaction success**—actual execution may fail due to:
  - Changes in blockchain state between simulation and execution
  - Network congestion or RPC node inconsistencies
  - Insufficient funds for transaction fees
  - Smart contract execution errors
  - Slippage exceeding configured limits (for swaps)

### 4.3 User Review Obligation

- You are solely responsible for reviewing all transaction details before signing, including:
  - Recipient addresses
  - Token types and amounts
  - Network fees (base fee + priority fee)
  - Smart contract interactions
  - Slippage tolerance and price impact (for swaps)
- The Platform displays transaction details to assist your review, but you bear full responsibility for accuracy verification

### 4.4 No Platform Signing

- The Platform **DOES NOT** and **WILL NOT**:
  - Store or access your private keys
  - Sign transactions on your behalf
  - Execute transactions without wallet popup confirmation
  - Use "trusted" or "pre-approved" transaction patterns
  - Implement automated signing of any kind

---

## 5. Transaction Finality

### 5.1 Blockchain Immutability

- Solana blockchain transactions are **final and irreversible** once confirmed
- Confirmed transactions cannot be undone, reversed, canceled, or modified by you, the Platform, or any third party
- This immutability is a fundamental characteristic of blockchain technology

### 5.2 Failed Transactions

- Transactions may fail after submission due to network conditions, insufficient balances, or smart contract errors
- **Failed transactions may still incur network fees** (base transaction fees and priority fees)
- The Platform is not responsible for failed transactions or fees incurred from failed transactions

### 5.3 User Verification Responsibility

- You are solely responsible for verifying:
  - **Recipient addresses:** Sending funds to an incorrect address is permanent and irreversible
  - **Token types:** Ensure you are sending the correct token (e.g., SOL vs. USDC vs. $HOPE)
  - **Amounts:** Verify decimal places and unit conversions (lamports vs. SOL)
  - **Smart contract interactions:** Understand what permissions or actions you are authorizing

### 5.4 No Recourse for User Error

- The Platform cannot reverse transactions sent to incorrect addresses, with incorrect amounts, or involving incorrect tokens
- There is no customer support mechanism to recover funds from erroneous transactions
- Blockchain transactions operate on a "code is law" basis—execution is final

---

## 6. Jupiter Swap Integration

### 6.1 Third-Party Aggregator

- Token swaps on the Platform are executed via **Jupiter Ultra**, a third-party decentralized exchange (DEX) aggregator
- Jupiter routes swap transactions through underlying liquidity sources (e.g., Raydium, Orca, Serum)
- The Platform does not operate a DEX, liquidity pool, or trading exchange

### 6.2 Slippage Protection

- The Platform applies a default slippage tolerance of **50 basis points (0.5%)** to protect against price movement during transaction execution
- You may adjust slippage tolerance in the Platform interface
- Higher slippage increases the likelihood of transaction execution but exposes you to greater price deviation risk
- If the actual execution price exceeds your slippage tolerance, the transaction will fail (and may still incur network fees)

### 6.3 Price Impact Warnings

- The Platform displays estimated price impact for swap transactions based on Jupiter's quote data
- Large trades may experience significant price impact due to liquidity constraints
- Price impact warnings are estimates—actual execution prices may differ

### 6.4 No Price Control or Guarantees

- The Platform **DOES NOT**:
  - Set or control token prices
  - Guarantee execution at quoted prices
  - Provide price oracles or authoritative price data
  - Act as a counterparty, market maker, or liquidity provider
- Token prices are determined by decentralized market forces across liquidity pools

### 6.5 Platform Role

- The Platform is **NOT**:
  - An exchange, broker, dealer, or financial intermediary
  - A custodian of funds or liquidity provider
  - A party to swap transactions (transactions occur directly between your wallet and smart contracts)
- The Platform provides interface tooling only

### 6.6 No Execution Guarantee

- Swap transactions may fail due to:
  - Slippage exceeding tolerance
  - Insufficient liquidity in routing pools
  - Network congestion or RPC failures
  - Smart contract errors
  - Changes in pool state between quote and execution
- Failed swaps may still incur network fees

---

## 7. Network Fees

### 7.1 User Responsibility for Fees

- You are solely responsible for all Solana network fees, including:
  - **Base transaction fees:** Minimum fee required for transaction processing (~0.000005 SOL per signature)
  - **Priority fees:** Optional additional fees to increase transaction priority during network congestion
  - **Account rent:** Fees for creating or maintaining on-chain accounts (may be refundable upon account closure)

### 7.2 Priority Fee Suggestions

- The Platform may suggest priority fee levels (e.g., "Low," "Medium," "High") based on current network conditions
- Priority fee suggestions are **NOT** guarantees of transaction inclusion or execution speed
- You may adjust or ignore priority fee suggestions at your discretion
- Higher priority fees increase the likelihood of faster transaction confirmation but do not guarantee it

### 7.3 Fee Estimates

- Fee estimates displayed in the Platform interface are approximations based on current network conditions
- **Actual fees may differ** due to:
  - Network congestion changes between quote and execution
  - Transaction complexity (number of accounts, compute units consumed)
  - RPC node variability
- You are responsible for ensuring sufficient SOL balance to cover all fees

### 7.4 No Fee Refunds

- Network fees are paid directly to Solana validators and are non-refundable
- The Platform does not collect, control, or receive network fees
- Fees are charged for failed transactions if the transaction was broadcast to the network

---

## 8. $HOPE Token

### 8.1 Utility Token

- $HOPE is a **platform engagement and utility token** designed for use within the ozskr.ai ecosystem
- $HOPE is used to:
  - Unlock platform features and functionality tiers
  - Access premium content generation capabilities
  - Participate in gamification and leaderboard systems
  - Reward platform activity and contributions

### 8.2 No Guaranteed Value

- $HOPE has **NO guaranteed monetary value, price floor, or redemption mechanism**
- The Platform makes **NO representations or promises** regarding $HOPE's market value, liquidity, or future price
- $HOPE value is determined by decentralized market forces and may fluctuate or go to zero

### 8.3 Not an Investment or Security

- $HOPE is **NOT**:
  - An investment contract, security, or financial instrument
  - A share of ownership, equity, or profit-sharing arrangement
  - A promise of financial returns or appreciation
- Do not purchase $HOPE with the expectation of profit

### 8.4 See Token Usage Terms

- Complete terms governing $HOPE creation, distribution, and use are available in our separate **Token Usage Terms** document
- By interacting with $HOPE on the Platform, you agree to the Token Usage Terms

---

## 9. Risk Disclosures

### 9.1 Cryptocurrency Volatility

- Cryptocurrency and blockchain tokens are **highly volatile and speculative assets**
- Token prices can experience extreme fluctuations in short periods
- You may lose some or all of the value of your cryptocurrency holdings
- Past performance does not indicate or guarantee future results

### 9.2 Total Loss Risk

- You should **NEVER** invest or transact with more cryptocurrency than you can afford to lose
- Token values can decline to zero
- Smart contract vulnerabilities, protocol failures, or market events can result in permanent loss of funds

### 9.3 Smart Contract Risk

- DeFi protocols, liquidity pools, and token contracts are software systems that may contain bugs, vulnerabilities, or exploitable flaws
- Smart contract audits do not guarantee security or eliminate risk
- Exploits, hacks, or protocol failures can result in loss of funds

### 9.4 Blockchain Network Risk

- Blockchain networks may experience:
  - **Congestion:** High transaction volume leading to delayed confirmations or failed transactions
  - **Outages:** RPC node failures, validator downtime, or network partitions
  - **Forks:** Chain splits resulting in asset duplication or loss depending on fork resolution
  - **Protocol changes:** Network upgrades that may affect token functionality or compatibility

### 9.5 Regulatory Risk

- Cryptocurrency regulation is evolving and varies by jurisdiction
- Regulatory changes may affect:
  - The legality of cryptocurrency transactions
  - Tax treatment of digital assets
  - Platform access or feature availability in certain regions
  - Token classification (e.g., security vs. utility)

### 9.6 Liquidity Risk

- Tokens may have limited or no liquidity on decentralized exchanges
- You may be unable to sell tokens at desired prices or at all
- Low liquidity increases price slippage and volatility

### 9.7 Wallet Security Risk

- You are solely responsible for securing your wallet private keys and seed phrases
- Loss or theft of private keys results in **permanent and irreversible loss of access** to your funds
- Phishing attacks, malware, and social engineering scams targeting wallet credentials are common

---

## 10. Platform Limitations and Disclaimers

### 10.1 "As Is" Service

- The Platform and all wallet-connected features are provided **"AS IS"** and **"AS AVAILABLE"** without warranties of any kind, express or implied
- We disclaim all warranties, including:
  - Merchantability, fitness for a particular purpose, and non-infringement
  - Accuracy, reliability, or completeness of transaction data, price quotes, or blockchain information
  - Uninterrupted, error-free, or secure operation

### 10.2 No Liability for Losses

The Platform and its operators, affiliates, and service providers are **NOT LIABLE** for:

- **Failed transactions** due to network conditions, RPC errors, or smart contract failures
- **Token price changes, volatility, or loss of value** resulting from market forces
- **Wallet security breaches, phishing attacks, or loss of private keys**
- **Network issues, outages, congestion, or forks** affecting the Solana blockchain
- **Third-party protocol failures, exploits, or vulnerabilities** (including Jupiter, Raydium, or other DeFi protocols)
- **User error** in transaction details (incorrect addresses, amounts, or tokens)
- **Slippage, price impact, or unfavorable execution prices** on swap transactions
- **Regulatory or legal consequences** of your cryptocurrency transactions

### 10.3 Maximum Liability Cap

To the maximum extent permitted by law, our total aggregate liability for any claims arising from your use of wallet-connected features shall not exceed **$100 USD** or the equivalent in cryptocurrency.

### 10.4 Transaction Data Accuracy

- Transaction previews, fee estimates, and price quotes are based on real-time data from blockchain RPC nodes and third-party APIs
- This data may be inaccurate, delayed, or incomplete
- You are solely responsible for verifying transaction accuracy before signing

### 10.5 No Financial Advice

- The Platform does not provide financial, investment, tax, or legal advice
- Transaction suggestions, price displays, and portfolio analytics are informational only
- Consult qualified professionals before making financial decisions

---

## 11. Prohibited Activities

You agree **NOT** to use the Platform's wallet-connected features for any of the following prohibited activities:

### 11.1 Market Manipulation

- Engaging in wash trading, spoofing, pump-and-dump schemes, or other manipulative trading practices
- Coordinating with others to artificially inflate or deflate token prices
- Disseminating false or misleading information to manipulate markets

### 11.2 Exploits and Attacks

- Exploiting smart contract vulnerabilities, bugs, or unintended behaviors for personal gain
- Conducting denial-of-service attacks, spam attacks, or other disruptive activities against the Platform or blockchain networks
- Reverse engineering, decompiling, or attempting to extract source code from Platform services

### 11.3 Illegal Activities

- Using the Platform for money laundering, terrorist financing, or other illegal financial activities
- Transacting in tokens that represent proceeds of crime or illegal activities
- Violating sanctions, export controls, or other applicable laws

### 11.4 Unauthorized Access

- Accessing another user's wallet, account, or private keys without authorization
- Circumventing security measures, rate limits, or access controls
- Using automated tools (bots) in violation of the Terms of Service

### 11.5 Enforcement

- Violations of prohibited activities may result in account suspension, termination, or referral to law enforcement
- We reserve the right to cooperate with legal authorities and provide information in response to lawful requests

---

## 12. Changes to These Terms

### 12.1 Right to Modify

We may update these Wallet Terms from time to time to reflect:

- Changes in Platform features or functionality
- Updates to third-party integrations (e.g., Jupiter, Solana network)
- Legal, regulatory, or compliance requirements
- Security enhancements or risk mitigation measures

### 12.2 Notice of Changes

We will notify you of material changes to these Wallet Terms by:

- Posting a notice on the Platform
- Updating the "Last Updated" date at the top of this document
- Sending an in-app notification (for significant changes affecting your rights or obligations)

### 12.3 Acceptance of Changes

Your continued use of wallet-connected features after changes become effective constitutes acceptance of the updated Wallet Terms. If you do not agree to the changes, you must discontinue use of wallet-connected features.

---

## 13. Contact Information

If you have questions, concerns, or disputes regarding these Wallet Terms or wallet-connected functionality, please contact us at:

**Email:** legal@ozskr.ai

**For Security Issues:** security@ozskr.ai (see our Security Policy for vulnerability reporting)

For general support inquiries, please refer to our Terms of Service for contact information.

---

**This is a draft document and requires review by a qualified attorney before publication. This document does not constitute legal advice.**

**By using wallet-connected features on the Platform, you acknowledge that you have read, understood, and agreed to these Wallet & Transaction Terms.**
