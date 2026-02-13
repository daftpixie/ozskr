# DRAFT — REQUIRES ATTORNEY REVIEW — NOT LEGAL ADVICE

# ozskr.ai Data Retention Policy

**Effective Date:** [DATE — TO BE SET]

**Last Updated:** February 13, 2026

---

## 1. Introduction

This Data Retention Policy explains how long ozskr.ai ("Platform," "we," "us," or "our") retains different categories of data collected through our Web3 AI Influencer Platform built on the Solana blockchain.

This policy is designed to:

- Provide transparency about our data retention practices
- Define clear retention periods for different data categories
- Explain our deletion and anonymization processes
- Clarify the limitations of data deletion for blockchain-based data
- Comply with applicable data protection regulations including GDPR and CCPA

This policy should be read in conjunction with our Privacy Policy, which describes what data we collect and how we use it.

---

## 2. Data Categories and Retention Periods

### 2.1 Wallet Addresses

**Category:** Account identifiers

**Retention Period:** Retained as long as your account is active, plus 30 days after account deletion request

**Purpose:** Authentication, access control, content ownership tracking

**Deletion Process:**
- Upon account deletion request: soft-deleted immediately (login disabled)
- After 30 days: permanently deleted from our database
- **Exception:** Wallet addresses are public information on the Solana blockchain and cannot be deleted from the blockchain itself

---

### 2.2 User Sessions (JWT Tokens)

**Category:** Authentication data

**Retention Period:** 7-day expiry, auto-purged upon expiration

**Storage:** httpOnly cookies (client-side), session metadata in Supabase

**Purpose:** Maintain authenticated sessions, prevent unauthorized access

**Deletion Process:**
- Automatic expiry after 7 days of inactivity
- Manual logout invalidates session immediately
- Session tokens are not retained after expiry

---

### 2.3 AI Agent Configurations (Characters)

**Category:** User-created content

**Retention Period:** Retained indefinitely until user deletes the character or account

**Includes:**
- Character name, persona descriptions, behavioral parameters
- Visual style preferences and avatar settings
- AI model configuration (temperature, max tokens, etc.)
- Character-specific memory namespace references

**Deletion Process:**
- User-initiated character deletion: 30-day soft-delete period (recoverable)
- After 30 days: permanently deleted from Supabase
- Account deletion: all characters deleted following account deletion timeline (see §4)

---

### 2.4 Generated Content

**Category:** AI-generated content (text and images)

**Retention Period:** Retained indefinitely until user deletes the content or account

**Storage Locations:**
- Text content: Supabase PostgreSQL database
- Image files: Cloudflare R2 object storage
- Content metadata: Supabase (creation date, character ID, moderation status)

**Deletion Process:**
- User deletes content: soft-deleted immediately (hidden from UI)
- After 30 days: hard-deleted from Supabase and R2
- Account deletion: all content deleted following account deletion timeline (see §4)

**Important:** Content published to social media platforms (via Ayrshare or direct Twitter API) persists on those platforms according to their retention policies. We cannot delete content from third-party social platforms.

---

### 2.5 Mem0 Memory Data

**Category:** AI contextual memory

**Retention Period:** Retained per-character until character is deleted or account is deleted

**Storage:** Mem0 cloud infrastructure with namespace isolation

**Includes:**
- Conversation history and context
- Character-specific knowledge and preferences
- User interaction patterns with each character

**Deletion Process:**
- Character deletion: Mem0 namespace purged immediately
- Account deletion: all character namespaces purged within 24 hours
- Mem0 retention is controlled by their infrastructure; we issue deletion API calls upon character/account deletion

---

### 2.6 Social Publishing Logs

**Category:** Platform activity logs

**Retention Period:** 90 days

**Includes:**
- Publishing timestamps, destination platforms (Twitter, Instagram, etc.)
- Success/failure status, rate limiting information
- API response metadata (not full responses)

**Purpose:** Debugging, analytics, rate limit enforcement

**Deletion Process:**
- Auto-purged after 90 days via scheduled Supabase cleanup job
- Account deletion: purged immediately

---

### 2.7 Trading and Transaction History

**Category:** DeFi activity metadata

**Retention Period:** 1 year (user-exportable)

**Includes:**
- Trade initiation timestamps, token pairs, amounts
- Transaction signatures (on-chain references)
- Client-side trade execution status (success/failure)

**Important Limitations:**
- **On-chain data is permanent:** All blockchain transactions are immutably recorded on Solana and cannot be deleted
- **Off-chain metadata only:** We retain off-chain metadata (UI state, user preferences) for 1 year
- Users can export transaction history via dashboard settings

**Deletion Process:**
- After 1 year: off-chain metadata auto-purged
- Account deletion: off-chain metadata purged within 30 days
- On-chain data remains permanently on Solana blockchain

---

### 2.8 Rate Limiting Data

**Category:** Abuse prevention data

**Retention Period:** 24-hour sliding window (auto-expires)

**Storage:** Upstash Redis (ephemeral)

**Includes:**
- Request counts per wallet address
- Rate limit tier and quota usage
- Timestamp of last request

**Deletion Process:**
- Automatic expiry after 24 hours (Redis TTL)
- Not retained in persistent storage

---

### 2.9 Error Logs and Analytics

**Category:** Operational data

**Retention Period:** 90 days

**Includes:**
- Application error logs (anonymized where possible)
- API request logs (excluding sensitive parameters)
- Performance metrics and latency data
- AI observability traces (Langfuse)

**Anonymization:**
- Wallet addresses are hashed or truncated in logs where possible
- Prompts and generated content are not included in error logs

**Deletion Process:**
- Auto-purged after 90 days
- Langfuse traces: 90-day retention (controlled by Langfuse)

---

### 2.10 Trigger.dev Job Logs

**Category:** Background job execution logs

**Retention Period:** 30 days (Trigger.dev default)

**Includes:**
- Job execution timestamps, duration, success/failure status
- Error messages for failed jobs
- Job metadata (not full payloads)

**Deletion Process:**
- Auto-purged by Trigger.dev after 30 days
- We do not control Trigger.dev's retention; refer to their data retention policy

---

## 3. Content Storage Lifecycle

### 3.1 Content Creation Flow

1. **Generation:** User initiates content generation via AI agent
2. **Quality Assurance:** Content passes through moderation pipeline
3. **Storage:** Text saved to Supabase, images uploaded to Cloudflare R2
4. **Metadata:** Content record created with ownership, timestamps, moderation status

### 3.2 Published Content

- **Platform Storage:** Content remains stored in Supabase and R2 after publishing
- **Third-Party Platforms:** Published content (e.g., tweets, Instagram posts) is controlled by the destination platform's retention policies
- **We cannot delete content from social platforms** after it has been published. Users must manually delete from destination platforms.

### 3.3 Deleted Content

**Immediate (soft-delete):**
- Content hidden from UI immediately
- Marked as deleted in database
- Access disabled via RLS policies

**Within 30 days (hard-delete):**
- Content record permanently deleted from Supabase
- R2 objects deleted from Cloudflare storage
- Metadata purged from all caches

### 3.4 Cloudflare R2 Object Lifecycle

- Objects are deleted when the corresponding content record is hard-deleted from Supabase
- R2 lifecycle policies may be implemented for additional cleanup (future)
- Orphaned objects (if any) are purged via monthly cleanup jobs

---

## 4. Account Deletion Process

When you request account deletion via dashboard settings, the following timeline applies:

### 4.1 Immediate (within 1 hour)

- **Session invalidated:** All active sessions terminated
- **Login disabled:** Wallet cannot authenticate
- **Account marked for deletion:** Soft-delete flag set in database

### 4.2 Within 24 Hours

- **Personal data anonymized:** Email addresses (if any), metadata fields anonymized
- **Mem0 namespaces purged:** All character memory deleted from Mem0
- **Third-party integrations disconnected:** Ayrshare profiles, social connections removed

### 4.3 Within 30 Days

- **Complete data deletion:**
  - All characters permanently deleted from Supabase
  - All generated content permanently deleted from Supabase and Cloudflare R2
  - All trading metadata permanently deleted
  - All logs and analytics data containing your wallet address purged
  - All session records permanently deleted

### 4.4 Permanent Exceptions

**On-chain data cannot be deleted:**
- Wallet address remains on Solana blockchain (public information)
- Transaction history remains on Solana blockchain (immutable)
- Token transfers and trading activity remain publicly visible via blockchain explorers

**Legal retention requirements:**
- Data required for legal compliance, fraud prevention, or security investigations may be retained beyond 30 days in isolated, access-restricted storage

---

## 5. Supabase Data Practices

### 5.1 Database Infrastructure

- **Platform:** PostgreSQL 16 hosted on Supabase managed infrastructure
- **Access Control:** Row Level Security (RLS) policies enforce per-wallet data isolation
- **Encryption:** Data encrypted at rest and in transit (TLS 1.3)

### 5.2 Backup and Recovery

- **Automated Backups:** Supabase maintains automated database backups per their retention schedule
- **Backup Retention:** Backups may retain deleted data for up to 90 days for disaster recovery purposes
- **Access:** Backups are access-restricted and only used for emergency recovery

### 5.3 Scheduled Cleanup Jobs

We run automated cleanup jobs to enforce retention periods:

- **Daily:** Purge expired sessions (>7 days old)
- **Weekly:** Hard-delete soft-deleted content (>30 days old)
- **Monthly:** Purge old analytics data (>90 days old), purge old trading metadata (>1 year old)

---

## 6. Third-Party Data Retention

### 6.1 Mem0 (AI Memory)

- **Storage:** Character memory stored in Mem0 cloud infrastructure
- **Retention:** Per-character until character deletion or account deletion
- **Deletion:** We issue API deletion requests to Mem0 upon character/account deletion
- **Control:** Mem0's internal retention practices are governed by their data policy

### 6.2 Cloudflare R2 (Object Storage)

- **Storage:** Generated images and media files
- **Retention:** Until user deletes content or account
- **Deletion:** Objects deleted via R2 API when content is hard-deleted from Supabase
- **Backups:** Cloudflare may retain deleted objects in backups per their policies

### 6.3 Upstash Redis (Rate Limiting)

- **Storage:** Ephemeral rate-limiting counters
- **Retention:** 24-hour TTL (auto-expires)
- **Deletion:** Automatic via Redis expiration

### 6.4 Trigger.dev (Background Jobs)

- **Storage:** Job execution logs
- **Retention:** 30 days (Trigger.dev default)
- **Deletion:** Auto-purged by Trigger.dev infrastructure
- **Control:** We do not control Trigger.dev's retention schedule

### 6.5 Vercel (Deployment and Hosting)

- **Storage:** Deployment logs, function execution logs
- **Retention:** Per Vercel's log retention policies (typically 1 hour for real-time logs, longer for archived logs)
- **Control:** Governed by Vercel's data retention policies

### 6.6 Anthropic Claude API

- **Data Sent:** Character persona, generation prompts, user context
- **Retention:** Per Anthropic's data retention policy (refer to https://www.anthropic.com/privacy)
- **Control:** We include opt-out headers where supported by Anthropic's API

### 6.7 fal.ai (Image Generation)

- **Data Sent:** Image generation prompts, style parameters
- **Retention:** Per fal.ai's data retention policy (refer to https://fal.ai/privacy)
- **Control:** Governed by fal.ai's policies

---

## 7. Your Rights

### 7.1 Right to Access Your Data

You can access your data at any time via the dashboard:

- View all characters and configurations
- Export generated content
- Download transaction history (1-year window)
- Review social publishing logs (90-day window)

### 7.2 Right to Export Your Data

You can export your data in machine-readable formats:

- **Characters:** JSON export with full configuration
- **Generated Content:** CSV or JSON export with metadata
- **Transaction History:** CSV export with on-chain references
- **Mem0 Memory:** Not directly exportable (controlled by Mem0)

To request a full data export, contact privacy@ozskr.ai.

### 7.3 Right to Delete Your Data

You can delete your data at any time:

- **Individual Content:** Delete via dashboard (30-day soft-delete period)
- **Individual Characters:** Delete via dashboard (30-day soft-delete period)
- **Entire Account:** Request deletion via dashboard settings (follows timeline in §4)

**Important Limitations:**
- On-chain data (wallet address, transactions) cannot be deleted from the blockchain
- Published social media content must be deleted directly on destination platforms
- Backups may retain data for up to 90 days

### 7.4 Right to Be Forgotten

We support the right to be forgotten (GDPR Article 17) with the following limitations:

- **Off-chain data:** Fully deleted within 30 days of account deletion request
- **On-chain data:** Cannot be deleted (blockchain is immutable)
- **Legal retention:** Data required for legal compliance or security investigations may be retained in access-restricted storage

To exercise your right to be forgotten, initiate account deletion via dashboard settings or contact privacy@ozskr.ai.

---

## 8. Changes to This Policy

We may update this Data Retention Policy from time to time to reflect changes in our practices, infrastructure, or legal requirements. We will notify you of material changes by:

- Posting a notice on the Platform
- Updating the "Last Updated" date at the top of this policy
- Sending a notification via the Platform interface (for significant changes affecting retention periods)

Your continued use of the Platform after changes become effective constitutes acceptance of the updated Data Retention Policy.

---

## 9. Contact Information

If you have questions, concerns, or requests regarding this Data Retention Policy or our data practices, please contact us at:

**Email:** privacy@ozskr.ai

**Address:** [TO BE SET]

For data deletion requests, account deletion, or data export requests, you may contact us at the email above or use the self-service tools available in your dashboard settings.

---

**This is a draft document and requires review by a qualified attorney before publication. This document does not constitute legal advice.**
