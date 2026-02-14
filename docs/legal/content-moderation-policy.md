# ozskr.ai Content Moderation Policy

**Effective Date:** [DATE — TO BE SET]

**Last Updated:** February 13, 2026

---

## 1. Introduction

Welcome to ozskr.ai ("Platform," "we," "us," or "our"). This Content Moderation Policy describes how we moderate AI-generated content on our Web3 AI Influencer Platform.

Our content moderation approach balances two core principles:

1. **Safety First:** We are committed to maintaining a platform free from illegal content, harmful material, and content that violates our community standards.
2. **Creative Expression:** We support diverse creative expression and recognize that AI-generated content serves artistic, satirical, commentary, and experimental purposes.

This policy applies to all content generated through the Platform's AI systems, including text and images created via AI agents.

**Important:** Users are solely responsible for content published through their AI agents. By using the Platform, you agree to comply with this Content Moderation Policy and our Terms of Service.

---

## 2. Moderation Pipeline Overview

All AI-generated content passes through our automated 7-stage content pipeline before being stored or published:

1. **Parse** — Input validation and schema enforcement
2. **Context** — Retrieve character memory and conversation context
3. **Enhance** — Augment prompts with character persona and style guidelines
4. **Generate** — Create content via Claude API (text) and fal.ai (images)
5. **Quality** — Validate output against quality standards
6. **Moderation** — Safety and policy compliance checks (described below)
7. **Store** — Save approved content to database and object storage

### Stage 6: Moderation Pipeline Detail

The moderation stage consists of three sequential checks:

#### Stage 6.1: AI Text Moderation

- **Provider:** Anthropic Claude API safety filters
- **Applies to:** All text-based content generated via Claude
- **Checks for:** Harmful content categories per Anthropic's usage policies
- **Outcome:** Content is approved, flagged for review, or rejected

#### Stage 6.2: Image Safety Check

- **Provider:** fal.ai safety filters
- **Applies to:** All image-based content generated via fal.ai
- **Checks for:** Visual content that violates safety guidelines
- **Outcome:** Image is approved, flagged for review, or rejected

#### Stage 6.3: Platform Rules Check

- **Provider:** Custom validation logic (Zod schema + rule engine)
- **Applies to:** All content after AI provider checks
- **Checks for:** Platform-specific prohibited content patterns (see Section 3)
- **Outcome:** Content is approved, flagged for review, or rejected

Each stage can independently approve, flag for human review, or reject content. If any stage rejects content, the generation attempt fails and the user receives a moderation notice.

---

## 3. Automatically Blocked Content

The following categories of content are automatically blocked and will cause generation to fail:

### 3.1 Explicit Sexual Content

- Sexually explicit imagery or text
- Nudity or sexual acts
- Sexual services or solicitation
- Child Sexual Abuse Material (CSAM) — any content involving minors in sexual contexts is grounds for immediate account termination and law enforcement referral

### 3.2 Graphic Violence or Gore

- Realistic depictions of extreme violence or injury
- Gore, mutilation, or graphic injury imagery
- Content glorifying or promoting violence against individuals or groups

### 3.3 Threats and Incitement

- Direct threats of violence against specific individuals or groups
- Content that incites imminent violence or harm
- Content that promotes self-harm or suicide

### 3.4 Illegal Activities

- Instructions for creating weapons, explosives, or dangerous substances
- Content promoting illegal drug manufacturing or distribution
- Content facilitating human trafficking or exploitation
- Content promoting hacking, fraud, or other cybercrimes

### 3.5 Personal Information (Doxxing)

- Sharing of personally identifiable information (PII) without consent
- Private addresses, phone numbers, or contact information
- Social Security numbers, financial account numbers, or government IDs
- Private medical records or sensitive personal data

### 3.6 Financial Fraud and Manipulation

- Pump-and-dump schemes or coordinated market manipulation
- False or misleading financial advice presented as fact
- Impersonation of financial institutions or advisors
- Phishing attempts or credential harvesting

### 3.7 Impersonation Without Disclosure

- Content impersonating real individuals (celebrities, public figures, private individuals) without clear disclosure that the content is AI-generated parody or commentary
- Deepfakes or synthetic media designed to deceive
- Brand impersonation or trademark infringement for fraudulent purposes

### 3.8 Platform Integrity Violations

- Content designed to bypass or defeat moderation systems
- Attempts to manipulate AI models through prompt injection
- Spam, malware distribution, or phishing content
- Content that exploits platform vulnerabilities

---

## 4. Content Flagged for Review

The following categories of content are flagged for human review rather than automatically blocked:

### 4.1 Political Content or Commentary

- Content discussing political figures, elections, or policy debates
- Satirical or commentary content involving public figures
- Content that may be protected speech but requires contextual review

### 4.2 Token or Project Mentions

- Content mentioning other cryptocurrency tokens or projects
- Content that may constitute shilling or undisclosed promotion
- Comparative statements about token performance or prospects

### 4.3 Borderline Safety Categories

- Content with high AI safety filter confidence scores in borderline categories
- Content that may be satirical, artistic, or educational but resembles prohibited categories
- Content involving sensitive topics (religion, health, identity) requiring contextual evaluation

### 4.4 User-Reported Content

- Content reported by other users via the Platform's reporting system
- Content flagged by community moderators or trusted reporters
- Content subject to legal takedown requests

### 4.5 High-Volume or Anomalous Patterns

- Accounts generating unusually high volumes of similar content
- Content patterns suggesting coordinated inauthentic behavior
- Content that deviates significantly from the character's established persona

---

## 5. Human Review Process

### 5.1 Review Team

- Content flagged for review is assessed by the Platform's moderation team
- Reviewers are trained on this policy and platform-specific guidelines
- During the beta phase, moderation is conducted by platform operators
- As the Platform scales, we plan to implement a tiered moderation team with escalation protocols

### 5.2 Review Timeline

- **Standard Review:** Within 48 hours of flagging
- **Urgent Review:** Within 4 hours for content involving potential illegal activity or imminent harm
- **Expedited Appeal:** Within 24 hours for appeals from verified users or time-sensitive content

Users will receive a notification when their content enters review and when a decision is made.

### 5.3 Review Outcomes

Reviewers can take the following actions:

1. **Approve:** Content is released and made available for publishing or display
2. **Approve with Warning:** Content is released with a notice to the user about borderline policy compliance
3. **Modify:** Content is edited to remove policy-violating elements (requires user consent)
4. **Remove:** Content is deleted and user is notified with reason for removal
5. **Escalate:** Complex cases are escalated to senior moderators or legal review

### 5.4 Documentation Requirements

- All review decisions are logged with decision rationale
- Reviewers document which policy section(s) apply to the decision
- Patterns of violations are tracked at the account level
- Aggregate moderation statistics are used for policy improvement

---

## 6. Appeal Process

Users have the right to appeal moderation decisions.

### 6.1 Filing an Appeal

- Appeals must be submitted within **14 days** of the moderation action
- Appeals can be submitted via the Platform interface or by emailing matthew@vt-infinite.com
- Appeals must include:
  - Content ID or generation ID
  - Explanation of why the decision should be reconsidered
  - Any relevant context or justification

### 6.2 Appeal Review

- Appeals are reviewed by a different moderator than the original reviewer
- Appeal responses are provided within **5 business days**
- Reviewers consider:
  - Whether the content was correctly evaluated under this policy
  - Whether new context changes the moderation decision
  - Whether the policy was applied consistently with similar cases

### 6.3 Appeal Outcomes

- **Upheld:** Original decision is maintained
- **Reversed:** Content is approved and restored (if applicable)
- **Modified:** Original decision is adjusted (e.g., warning instead of removal)

### 6.4 Final Appeal

- If the appeal is denied, users may request a **final review** by platform administrators
- Final appeals are discretionary and reviewed within **10 business days**
- Administrator decisions are final

---

## 7. Transparency Reporting

We are committed to transparency in our moderation practices.

### 7.1 Planned Transparency Reports

Beginning in Q3 2026, we plan to publish **quarterly transparency reports** including:

- Total number of content generation attempts
- Number of content items moderated (by stage: AI filters, platform rules, human review)
- Breakdown of moderation actions by category (approved, flagged, rejected)
- Number of appeals filed and appeal outcomes
- Account-level enforcement actions (warnings, suspensions, bans)

### 7.2 Aggregate Statistics

- Transparency reports will include aggregate, anonymized data only
- No individual user data or content will be disclosed
- Reports will be published at https://ozskr.ai/transparency

### 7.3 Government and Legal Requests

- We will report the number of government or legal requests for content removal
- We will disclose the jurisdictions of requests and whether we complied
- Individual request details will only be disclosed if legally permitted

---

## 8. User Responsibilities

### 8.1 Content Accountability

- **You are responsible** for all content generated and published through your AI agents
- You must review AI-generated content before publishing to social media or public platforms
- You are responsible for ensuring content complies with destination platform policies (e.g., Twitter, Instagram)

### 8.2 Prohibited Actions

Users must not:

- Attempt to circumvent or defeat moderation systems through prompt manipulation, encoding, obfuscation, or other techniques
- Use the Platform to generate content with the intent to violate this policy
- Repeatedly generate policy-violating content to test moderation boundaries
- Share techniques for bypassing moderation with other users
- Use AI agents to harass, threaten, or target individuals or groups

### 8.3 Reporting Obligations

Users are encouraged to report content that violates this policy:

- Use the in-platform reporting system to flag concerning content
- Provide specific details about the policy violation
- Report content generated by other users that violates community standards

**Good faith reporting is protected.** Users will not face retaliation for reporting policy violations in good faith.

---

## 9. Enforcement Actions

Violations of this Content Moderation Policy may result in the following enforcement actions:

### 9.1 Warning (Minor Violations)

- **First offense** for minor or borderline violations
- User receives a written warning explaining the violation
- Warning is logged in the user's account history
- No restriction on platform access

**Examples:** Borderline language in generated content, unintentional policy violation, single instance of flagged content that was not published.

### 9.2 Content Removal

- Violating content is deleted from the Platform
- User retains platform access
- User is notified of the removal with specific policy citation

**Examples:** Content that violates Section 3 categories but represents an isolated incident, user-reported content found to violate policies.

### 9.3 Temporary Agent Suspension

- AI agent is suspended for **7 to 30 days** depending on severity
- User cannot generate or publish content from the suspended agent
- Other agents on the account (if any) remain active
- User can appeal the suspension

**Examples:** Repeated attempts to generate prohibited content, pattern of policy violations from a specific agent, serious violation that does not warrant permanent ban.

### 9.4 Account Suspension

- Entire account is suspended for **30 to 90 days**
- User loses access to all platform features
- $HOPE token balances remain accessible (non-custodial wallet)
- Suspension is noted in account history

**Examples:** Multiple agents generating violating content, attempts to circumvent moderation, coordinated policy violations, serious breach of community standards.

### 9.5 Permanent Account Ban

- Account is permanently terminated
- User is prohibited from creating new accounts
- All associated agents are deleted
- $HOPE token balances remain accessible (non-custodial wallet)
- User may appeal within 30 days

**Examples:** CSAM or child exploitation content, credible threats of violence, persistent circumvention of moderation, use of platform for illegal activities, severe or repeated violations after prior enforcement actions.

### 9.6 Law Enforcement Referral

- Platform reserves the right to report illegal content to law enforcement
- We cooperate with lawful requests for user information
- We may preserve evidence of illegal activity as required by law

**Examples:** CSAM, credible threats of violence, content related to terrorism or human trafficking, financial fraud or theft.

### 9.7 Escalation Path

- **First violation:** Warning
- **Second violation (within 90 days):** Content removal + written warning
- **Third violation (within 90 days):** Temporary agent suspension (7-14 days)
- **Fourth violation (within 180 days):** Account suspension (30-60 days)
- **Fifth violation or severe single violation:** Permanent ban

**Note:** Severe violations (Section 3.1, 3.3, 3.4, 3.5, 3.6) may result in immediate suspension or ban regardless of prior history.

---

## 10. Special Considerations

### 10.1 Parody, Satire, and Commentary

- We recognize that parody, satire, and social commentary are valuable forms of expression
- Content that uses protected speech techniques will be reviewed in context
- Users should clearly label parody or satirical content when publishing
- Context matters: reviewers will consider artistic intent, target audience, and potential for harm

### 10.2 Educational and Research Content

- Content created for educational or research purposes may be granted exceptions
- Users conducting research must contact matthew@vt-infinite.com in advance
- Approved researchers may generate content that would otherwise be flagged, subject to strict safeguards
- Research exceptions are granted on a case-by-case basis

### 10.3 Newsworthy or Documentary Content

- Content covering newsworthy events or documented facts may include sensitive material
- Reviewers will consider journalistic standards and public interest
- Users should provide context when generating content about sensitive current events

### 10.4 Cultural and Regional Context

- We recognize that norms and sensitivities vary across cultures and regions
- Moderation decisions consider the global nature of the Platform
- Content legal in one jurisdiction may still violate platform policies
- When in doubt, content is evaluated against the most protective standard

---

## 11. AI Agent Character Personas

### 11.1 Character Design Flexibility

- Users have broad creative freedom to design AI agent personas
- Character personas can include edgy, provocative, or unconventional personalities
- Personas must not be designed primarily to generate prohibited content

### 11.2 Character Persona Restrictions

The following character designs are prohibited:

- Personas designed to impersonate real individuals without disclosure
- Personas designed to circumvent moderation (e.g., "ignore safety filters")
- Personas that explicitly encourage illegal activity or harm
- Personas that sexualize minors or promote CSAM

### 11.3 Persona vs. Output

- A provocative or edgy character persona does not grant exemption from content policies
- All content generated by any persona is subject to the same moderation pipeline
- Reviewers evaluate the output, not the character description

---

## 12. Platform-Generated Content

### 12.1 Disclosure Requirements

- All AI-generated content must be labeled as AI-generated when published to external platforms
- Users must comply with destination platform policies regarding synthetic media
- The Platform automatically adds AI disclosure metadata where supported by destination platforms

### 12.2 AI Watermarking

- We support AI content watermarking standards as they emerge
- Images generated via fal.ai may include C2PA metadata where supported
- Users must not remove or alter AI disclosure watermarks or metadata

---

## 13. Changes to This Policy

We may update this Content Moderation Policy from time to time to reflect:

- Changes in AI safety best practices
- Evolving community standards
- New content categories or moderation techniques
- Legal or regulatory requirements
- User feedback and transparency report findings

### 13.1 Notice of Changes

We will notify you of material changes by:

- Posting a notice on the Platform
- Updating the "Last Updated" date at the top of this policy
- Sending a notification via the Platform interface (for significant changes)

### 13.2 Effective Date of Changes

- Changes take effect **30 days** after notice is posted (unless urgent legal/safety changes require immediate effect)
- Your continued use of the Platform after changes take effect constitutes acceptance of the updated policy

---

## 14. Contact Information

If you have questions, concerns, or appeals regarding this Content Moderation Policy, please contact us at:

**Email:** matthew@vt-infinite.com

**Privacy Inquiries:** matthew@vt-infinite.com

**Legal Inquiries:** matthew@vt-infinite.com

**Address:** [TO BE SET]

For urgent safety concerns involving imminent harm or illegal activity, please also contact local law enforcement.

---

## 15. Policy Interpretation

### 15.1 Good Faith Application

- This policy is applied in good faith to maintain platform safety and integrity
- Moderators use reasonable judgment when evaluating borderline cases
- We do not selectively enforce policies based on viewpoint or ideology

### 15.2 Precedent and Consistency

- We strive for consistency in moderation decisions
- Prior decisions inform future cases involving similar content
- Transparency reports help ensure consistent application of policies

### 15.3 Conflicts with Other Policies

- In case of conflict between this policy and our Terms of Service, Terms of Service prevail
- In case of conflict with applicable law, applicable law prevails
- Users are responsible for complying with all applicable laws and platform policies

---

