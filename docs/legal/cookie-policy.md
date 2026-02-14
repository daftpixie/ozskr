# ozskr.ai Cookie & Local Storage Policy

**Effective Date:** [DATE — TO BE SET]

**Last Updated:** February 13, 2026

---

## 1. Introduction

Welcome to ozskr.ai ("Platform," "we," "us," or "our"). This Cookie & Local Storage Policy describes how we use cookies, browser storage technologies, and similar tracking mechanisms when you use our Web3 AI Influencer Platform built on the Solana blockchain.

This policy should be read in conjunction with our [Privacy Policy](/docs/legal/privacy-policy.md) and [Terms of Service](/docs/legal/terms-of-service.md).

By using the Platform, you acknowledge that you have read and understood this Cookie & Local Storage Policy.

---

## 2. What Are Cookies and Local Storage?

### 2.1 Cookies

Cookies are small text files that are placed on your device (computer, smartphone, or tablet) by websites you visit. Cookies are widely used to make websites work more efficiently and to provide information to website owners.

Cookies may be set by the website you are visiting ("first-party cookies") or by third-party services integrated into the website ("third-party cookies").

### 2.2 Local Storage

Local Storage (also known as Web Storage or DOM Storage) is a browser-based storage mechanism that allows websites to store data persistently in your browser. Unlike cookies, Local Storage data is not automatically transmitted to the server with every HTTP request.

### 2.3 Session Storage

Session Storage is similar to Local Storage but is cleared when you close your browser tab or window. It is used for temporary data that does not need to persist across browser sessions.

---

## 3. Cookies We Use

### 3.1 Essential Cookies

These cookies are strictly necessary for the Platform to function and cannot be disabled without breaking core functionality.

| Cookie Name | Purpose | Duration | Type |
|-------------|---------|----------|------|
| `sb-auth-token` | Supabase authentication session token (httpOnly, secure) | 7 days | First-party |
| `sb-refresh-token` | Supabase authentication refresh token (httpOnly, secure) | 30 days | First-party |

**Why we need these:** These cookies authenticate your wallet-based session using Sign-In with Solana (SIWS). Without these cookies, you cannot access your account, generate content, or use any Platform features.

### 3.2 Functional Cookies

These cookies enhance the user experience but are not strictly required for basic functionality.

| Cookie Name | Purpose | Duration | Type |
|-------------|---------|----------|------|
| `cf_clearance` | Cloudflare security challenge verification | 30 minutes | Third-party (Cloudflare) |
| `__cf_bm` | Cloudflare bot management and DDoS protection | 30 minutes | Third-party (Cloudflare) |

**Why we use these:** Cloudflare cookies protect the Platform from DDoS attacks, bots, and security threats. These cookies are set by our Content Delivery Network (CDN) provider.

### 3.3 Analytics Cookies

**Current Status:** We do not currently use analytics cookies.

**Future Use:** We may add privacy-respecting analytics tools such as Vercel Analytics (privacy mode) or Plausible Analytics in the future. If we do, we will update this policy and provide opt-out options for non-essential analytics cookies.

We do NOT use:
- Google Analytics
- Facebook Pixel
- Third-party advertising networks
- Cross-site tracking technologies
- Behavioral profiling cookies

### 3.4 Third-Party Wallet Cookies

When you connect a Solana wallet (e.g., Phantom, Solflare, Backpack), the wallet provider may set cookies to maintain your connection state. These cookies are governed by the wallet provider's privacy policy, not ours.

| Wallet Provider | Cookie Scope | Privacy Policy |
|-----------------|--------------|----------------|
| Phantom | Wallet extension state | https://phantom.app/privacy |
| Solflare | Wallet extension state | https://solflare.com/privacy |
| Backpack | Wallet extension state | https://backpack.app/privacy |

**Note:** ozskr.ai does not control or have access to these third-party wallet cookies.

---

## 4. Local Storage Usage

The Platform uses browser Local Storage to persist data on your device. This data is stored in your browser and is not automatically sent to our servers.

### 4.1 Essential Local Storage

| Storage Key | Purpose | Data Stored |
|-------------|---------|-------------|
| `ozskr-session` | Session state and JWT token | JWT token, wallet address, session expiry |
| `wallet-adapter-state` | Wallet connection preferences | Last connected wallet name (e.g., "Phantom"), auto-connect preference |

**Why we need this:** Session tokens stored in Local Storage allow you to remain authenticated when you return to the Platform. Wallet adapter state remembers your wallet preference to streamline reconnection.

### 4.2 User Preference Storage

| Storage Key | Purpose | Data Stored |
|-------------|---------|-------------|
| `ozskr-theme` | UI theme preference | "dark" or "light" (default: dark) |
| `ozskr-sidebar-collapsed` | Dashboard sidebar state | "true" or "false" |
| `ozskr-onboarding-complete` | Onboarding flow completion status | "true" or "false" |
| `ozskr-feature-flags` | Cached feature flags | JSON object with feature flag states |

**Why we use this:** These preferences improve your user experience by remembering your UI choices across sessions.

### 4.3 Feature Flag Cache

The Platform uses feature flags to control gradual rollouts of new features. Feature flag states are cached in Local Storage to reduce server requests.

**Cache Duration:** Feature flags are refreshed every 5 minutes or when you reload the page.

### 4.4 Rate Limiting State

| Storage Key | Purpose | Data Stored |
|-------------|---------|-------------|
| `ozskr-rate-limit-cache` | Client-side rate limit awareness | Last request timestamp, request count |

**Why we use this:** This helps provide real-time feedback when you are approaching rate limits, preventing failed requests.

---

## 5. Session Storage Usage

The Platform uses browser Session Storage for temporary data that is cleared when you close the browser tab.

### 5.1 Current Session Storage

| Storage Key | Purpose | Data Stored |
|-------------|---------|-------------|
| `ozskr-content-draft` | Unsaved content generation draft | Character DNA, generation parameters, partial content |
| `ozskr-modal-state` | Modal dialog state | Open/closed state for generation modals |

**Why we use this:** Session Storage prevents data loss if you accidentally navigate away during content generation.

---

## 6. How to Manage Cookies and Local Storage

### 6.1 Browser Settings for Cookies

You can control and delete cookies through your browser settings. Here are instructions for common browsers:

**Google Chrome:**
1. Click the three dots menu (⋮) → Settings → Privacy and security → Cookies and other site data
2. Choose "Block all cookies" (breaks the Platform), "Block third-party cookies," or manage site-specific settings
3. To delete existing cookies: Click "See all cookies and site data" → Search "ozskr.ai" → Remove

**Mozilla Firefox:**
1. Click the menu (☰) → Settings → Privacy & Security → Cookies and Site Data
2. Choose "Block cookies" or "Custom" to block third-party cookies
3. To delete existing cookies: Click "Manage Data" → Search "ozskr.ai" → Remove Selected

**Safari:**
1. Safari menu → Preferences → Privacy
2. Choose "Block all cookies" or "Prevent cross-site tracking"
3. To delete existing cookies: Click "Manage Website Data" → Search "ozskr.ai" → Remove

**Microsoft Edge:**
1. Click the three dots menu (…) → Settings → Cookies and site permissions → Cookies and site data
2. Choose "Block all cookies" or "Block third-party cookies"
3. To delete existing cookies: Click "See all cookies and site data" → Search "ozskr.ai" → Remove

### 6.2 Clearing Local Storage

To manually clear Local Storage for ozskr.ai:

**All Modern Browsers:**
1. Open the Platform (https://ozskr.vercel.app)
2. Right-click anywhere on the page → Inspect (or press F12)
3. Go to the "Application" tab (Chrome/Edge) or "Storage" tab (Firefox)
4. Expand "Local Storage" in the left sidebar
5. Click on the ozskr.ai domain
6. Right-click → Clear or delete individual items

**Quick Clear (All Data):**
Most browsers allow you to clear all site data via Settings → Privacy → Site Settings → ozskr.ai → Clear Data.

### 6.3 Impact of Disabling Cookies and Storage

**If you disable essential cookies or clear Local Storage:**
- You will be logged out immediately
- You will not be able to sign in with your Solana wallet
- The Platform will not function properly
- Your UI preferences (theme, sidebar state) will be lost

**If you block third-party cookies only:**
- The Platform will continue to function normally
- Cloudflare security cookies may be affected, potentially triggering additional security challenges

---

## 7. Privacy Rights and Cookie Consent

### 7.1 GDPR Compliance (European Residents)

If you are a resident of the European Economic Area (EEA), United Kingdom, or Switzerland:

**Consent:** By using the Platform, you consent to the use of essential cookies and Local Storage required for authentication and core functionality.

**Opt-Out:** You have the right to opt out of non-essential cookies at any time through your browser settings (see Section 6).

**Right to Withdraw Consent:** You can withdraw consent by clearing cookies and Local Storage or by disconnecting your wallet and no longer using the Platform.

**Data Subject Rights:** You retain all rights under the GDPR, including the right to access, rectify, erase, restrict processing, and data portability. See our [Privacy Policy](/docs/legal/privacy-policy.md) for details.

### 7.2 CCPA Compliance (California Residents)

If you are a California resident:

**No Sale of Data:** We do not sell personal information collected via cookies or Local Storage.

**Do Not Track (DNT):** The Platform respects the Global Privacy Control (GPC) signal for California residents. If your browser sends a GPC signal, we will treat it as a request to opt out of the sale of personal information (though we do not sell data regardless).

**Right to Opt-Out:** You can opt out of non-essential cookies through your browser settings (see Section 6).

**Right to Delete:** You can request deletion of data stored in cookies and Local Storage by contacting matthew@vt-infinite.com. Note that deleting authentication cookies will log you out.

### 7.3 No Consent Required for Essential Cookies

Under GDPR and most privacy laws, websites are permitted to use strictly necessary cookies without consent if they are essential for the service requested by the user. Our authentication cookies fall into this category.

### 7.4 Cookie Banner (Future Implementation)

**Current Status:** We do not currently display a cookie consent banner because we only use essential cookies and do not use analytics or advertising cookies.

**Future Implementation:** If we add non-essential cookies (e.g., analytics), we will implement a cookie consent banner allowing you to:
- Accept all cookies
- Accept only essential cookies
- Customize your cookie preferences
- Withdraw consent at any time

---

## 8. Third-Party Cookie Policies

The Platform integrates with third-party services that may set cookies. We do not control these cookies and recommend reviewing their privacy policies:

| Service | Cookies Used | Privacy Policy |
|---------|--------------|----------------|
| **Cloudflare** | Security and DDoS protection cookies | https://www.cloudflare.com/privacypolicy/ |
| **Supabase** | Authentication cookies (first-party via our domain) | https://supabase.com/privacy |
| **Phantom Wallet** | Wallet connection state (browser extension only) | https://phantom.app/privacy |
| **Solflare Wallet** | Wallet connection state (browser extension only) | https://solflare.com/privacy |

**Note:** AI services (Anthropic, fal.ai), social publishing (Ayrshare), and blockchain RPC providers (Helius, Jupiter) do not set cookies in your browser. All interactions with these services occur server-side.

---

## 9. Data Security

### 9.1 Secure Cookies

All authentication cookies are set with the following security flags:
- `httpOnly`: Prevents JavaScript access to cookies (protects against XSS attacks)
- `secure`: Cookies are only transmitted over HTTPS
- `sameSite=Strict`: Cookies are only sent to ozskr.ai, not to third-party domains (protects against CSRF attacks)

### 9.2 Local Storage Security

Local Storage data is:
- Isolated per domain (other websites cannot access ozskr.ai Local Storage)
- Encrypted in transit via HTTPS
- **Not encrypted at rest** (standard browser limitation — do not store sensitive data in Local Storage)

**Important:** We never store private keys, seed phrases, or sensitive wallet credentials in cookies or Local Storage. All wallet signing operations occur in your wallet extension, not in the browser.

### 9.3 Session Token Expiration

- JWT tokens stored in Local Storage expire after **7 days of inactivity**
- Refresh tokens stored in httpOnly cookies expire after **30 days**
- Expired tokens are automatically removed and require re-authentication

---

## 10. Children's Privacy

The Platform is not directed at individuals under the age of 18. We do not knowingly use cookies or Local Storage to collect information from children under 18.

If we become aware that a child under 18 has provided us with personal information via cookies or Local Storage, we will take steps to delete such information.

---

## 11. Changes to This Policy

We may update this Cookie & Local Storage Policy from time to time to reflect changes in our practices, technologies, or legal requirements. We will notify you of material changes by:

- Posting a notice on the Platform
- Updating the "Last Updated" date at the top of this policy
- Sending a notification via the Platform interface (for significant changes)

Your continued use of the Platform after changes become effective constitutes acceptance of the updated policy.

**What constitutes a material change:**
- Introduction of new categories of cookies (e.g., analytics, advertising)
- Changes to data retention periods for cookies or Local Storage
- New third-party services that set cookies
- Changes to cookie security settings

---

## 12. Contact Us

If you have questions, concerns, or requests regarding this Cookie & Local Storage Policy, please contact us at:

**Email:** matthew@vt-infinite.com

**Address:** [TO BE SET]

For GDPR-related cookie inquiries, you may also contact our Data Protection Officer (if appointed) at the address above.

---

## 13. Additional Resources

- [Privacy Policy](/docs/legal/privacy-policy.md) — How we collect, use, and protect your data
- [Terms of Service](/docs/legal/terms-of-service.md) — Legal terms governing Platform use
- [Acceptable Use Policy](/docs/legal/acceptable-use-policy.md) — Content and behavior guidelines
- [Security Policy](/SECURITY.md) — How to report security vulnerabilities

---

