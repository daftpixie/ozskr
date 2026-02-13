# ozskr.ai Privacy Policy

**Effective Date:** [DATE — TO BE SET]

**Last Updated:** February 12, 2026

---

## 1. Introduction

Welcome to ozskr.ai ("Platform," "we," "us," or "our"). This Privacy Policy describes how we collect, use, store, and protect information when you use our Web3 AI Influencer Platform built on the Solana blockchain.

By connecting your wallet and using the Platform, you acknowledge that you have read and understood this Privacy Policy.

---

## 2. Information We Collect

### 2.1 Wallet Information

- **Wallet Addresses:** We collect your public Solana wallet address when you authenticate using Sign-In with Solana (SIWS). Wallet addresses are public information on the blockchain and are used to identify your account.
- **Transaction Data:** On-chain transaction data is publicly available on the Solana blockchain. We do not control or store private keys.

### 2.2 AI-Generated Content

- **Character Configurations:** We store AI agent character settings including name, persona descriptions, visual style preferences, and behavioral parameters.
- **Generated Content:** Text and image content generated via Claude API and fal.ai is stored in our database (Supabase PostgreSQL) and object storage (Cloudflare R2).
- **AI Memory Data:** Conversation context and character memory data managed through Mem0 for continuity in AI interactions.

### 2.3 Platform Usage Data

- **Service Interactions:** API requests, content generation attempts, social publishing activity, and token trading interactions.
- **Analytics Data:** Usage patterns, feature adoption metrics, agent performance statistics, and error logs (anonymized where possible).
- **Rate Limiting Data:** Request counts per wallet address stored in Upstash Redis for rate limit enforcement.

### 2.4 Technical Information

- **Device and Browser Information:** User agent strings, IP addresses (edge-level only, not persistently stored), browser type, and operating system.
- **Session Data:** Authentication tokens (JWT), session identifiers, and connection timestamps.

---

## 3. How We Use Information

### 3.1 Platform Services

- Authenticate users via wallet-based sign-in
- Provide AI agent creation and content generation services
- Enable social media publishing through Ayrshare integration
- Facilitate client-side token trading via Jupiter Ultra
- Store and retrieve character configurations and generated content

### 3.2 Platform Improvement

- Improve AI model performance through anonymized usage analysis
- Optimize content generation pipelines and quality assurance processes
- Enhance platform features based on usage patterns
- Debug and resolve technical issues

### 3.3 Security and Compliance

- Monitor for abuse, fraud, and platform violations
- Enforce rate limits to prevent platform abuse
- Detect and prevent unauthorized access
- Comply with legal obligations and respond to lawful requests

### 3.4 AI Observability

- Track AI model performance metrics via Langfuse
- Monitor content generation quality and latency
- Analyze prompt effectiveness and output characteristics

---

## 4. Third-Party Services

The Platform integrates with the following third-party services:

| Service | Purpose | Data Shared |
|---------|---------|-------------|
| **Anthropic (Claude API)** | Content generation | Character persona, generation prompts, context |
| **fal.ai** | Image generation | Image generation prompts, style parameters |
| **Ayrshare** | Social media publishing | Generated content, connected social accounts, publishing schedules |
| **Jupiter** | Token swaps (client-side) | Transaction data (public blockchain) |
| **Helius** | Solana RPC provider | Wallet addresses, transaction requests (public blockchain data) |
| **Supabase** | Database and authentication | All platform data with Row Level Security enforcement |
| **Upstash Redis** | Rate limiting and caching | Wallet addresses, request counts, cached data |
| **Mem0** | AI memory management | Character memory, conversation context |
| **Langfuse** | AI observability | AI model usage metrics, generation traces (anonymized) |
| **Cloudflare** | CDN, edge routing, object storage (R2) | Media files, cached content, request metadata |
| **Infisical** | Secrets management (internal) | No user data shared |

Each third-party service has its own privacy policy. We recommend reviewing their policies:

- Anthropic Privacy Policy: https://www.anthropic.com/privacy
- fal.ai Privacy Policy: https://fal.ai/privacy
- Ayrshare Privacy Policy: https://www.ayrshare.com/privacy-policy
- Supabase Privacy Policy: https://supabase.com/privacy
- Cloudflare Privacy Policy: https://www.cloudflare.com/privacypolicy/

---

## 5. Data Storage and Security

### 5.1 Storage Infrastructure

- **Database:** Supabase PostgreSQL with Row Level Security (RLS) policies ensuring users can only access their own data
- **Object Storage:** Cloudflare R2 for media files (images, videos)
- **AI Memory:** Mem0 cloud storage with per-character namespace isolation
- **Cache and Rate Limiting:** Upstash Redis with encryption at rest
- **Edge Routing:** Cloudflare Workers for request processing and rate limiting

### 5.2 Security Measures

- **Encryption:** Data encrypted in transit (TLS 1.3) and at rest
- **Access Control:** Row Level Security (RLS) policies on all database tables
- **Authentication:** Wallet-based authentication with JWT tokens
- **Rate Limiting:** Per-wallet rate limits enforced at the edge layer
- **Content Moderation:** Automated moderation pipeline for all generated content
- **Server-Side Validation:** Zod schema validation on all API endpoints
- **No Custody:** Platform never holds private keys or has custody of user funds

### 5.3 Data Isolation

- Each user's data is isolated via RLS policies using wallet address as the authorization context
- AI memory is namespaced per character with server-side enforcement
- Generated content is linked to the creating wallet address

---

## 6. Blockchain Data

### 6.1 Public Nature of Blockchain

- Wallet addresses are public information on the Solana blockchain
- All on-chain transactions are permanently recorded and publicly viewable
- Transaction history, token balances, and trading activity are visible to anyone via blockchain explorers
- The Platform cannot delete or modify blockchain data

### 6.2 Off-Chain Data

- Character configurations, generated content, and AI memory are stored off-chain and can be deleted upon request
- Social media posts published via the Platform may persist on destination platforms according to their policies

---

## 7. Your Rights

### 7.1 California Residents (CCPA)

If you are a California resident, you have the following rights:

- **Right to Know:** Request disclosure of the categories and specific pieces of personal information we have collected about you
- **Right to Delete:** Request deletion of your personal information (subject to exceptions for legal compliance and security)
- **Right to Opt-Out:** Opt out of the sale of personal information (note: we do not sell personal information)
- **Right to Non-Discrimination:** You will not be discriminated against for exercising your privacy rights

To exercise these rights, contact us at privacy@ozskr.ai.

### 7.2 European Residents (GDPR)

If you are a resident of the European Economic Area (EEA), you have the following rights:

- **Right of Access:** Request access to your personal data
- **Right to Rectification:** Request correction of inaccurate personal data
- **Right to Erasure:** Request deletion of your personal data ("right to be forgotten")
- **Right to Data Portability:** Receive your personal data in a structured, machine-readable format
- **Right to Restriction of Processing:** Request limitation on how we process your data
- **Right to Object:** Object to our processing of your personal data
- **Right to Withdraw Consent:** Withdraw consent at any time (where processing is based on consent)
- **Right to Lodge a Complaint:** File a complaint with your local data protection authority

To exercise these rights, contact us at privacy@ozskr.ai.

### 7.3 Limitations on Data Deletion

- Blockchain data (wallet addresses, transaction history) cannot be deleted as it is immutably recorded on the Solana blockchain
- We may retain certain data for legal compliance, fraud prevention, and security purposes
- Deleted data may persist in backups for up to 90 days

---

## 8. Data Retention

### 8.1 Active Account Data

- Character configurations, generated content, and AI memory are retained while your account is active
- Session tokens expire after 7 days of inactivity
- Rate limiting data is retained for 24 hours in Redis

### 8.2 Deleted Content

- Generated content marked for deletion is retained for 90 days, then permanently purged
- AI memory can be deleted per-character via the Platform interface
- Character deletions are permanent after 30-day soft-delete period

### 8.3 Analytics and Logs

- Anonymized analytics data may be retained indefinitely for platform improvement
- Error logs and security logs are retained for 1 year
- Langfuse AI observability traces are retained for 90 days

---

## 9. Cookies and Tracking

### 9.1 Essential Cookies

- **Session Tokens:** JWT tokens stored in httpOnly cookies for authentication (required for platform functionality)
- **Wallet Connection:** Wallet adapter session data stored in localStorage

### 9.2 No Third-Party Tracking

- We do not use third-party tracking cookies for advertising or analytics
- We do not participate in cross-site tracking or behavioral advertising networks
- Cloudflare may set cookies for security and performance purposes (see Cloudflare's privacy policy)

---

## 10. Children's Privacy

The Platform is not directed at individuals under the age of 18. We do not knowingly collect personal information from children under 18. If we become aware that a child under 18 has provided us with personal information, we will take steps to delete such information.

---

## 11. Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, regulatory, or operational reasons. We will notify you of material changes by:

- Posting a notice on the Platform
- Updating the "Last Updated" date at the top of this policy
- Sending a notification via the Platform interface (for significant changes)

Your continued use of the Platform after changes become effective constitutes acceptance of the updated Privacy Policy.

---

## 12. International Data Transfers

The Platform is operated in the United States. If you access the Platform from outside the United States, your information may be transferred to, stored, and processed in the United States or other countries where our service providers operate.

By using the Platform, you consent to the transfer of your information to countries outside your country of residence, which may have different data protection laws.

---

## 13. Contact Us

If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:

**Email:** privacy@ozskr.ai

**Address:** [TO BE SET]

For GDPR-related inquiries, you may also contact our Data Protection Officer (if appointed) at the address above.

---

