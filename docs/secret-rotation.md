# Secret Rotation Procedures

## Overview
All secrets are managed through Infisical. Rotation follows a zero-downtime approach: new secret is deployed alongside old, verified working, then old secret is revoked.

## Rotation Schedule

| Service | Secret | Rotation Frequency | Impact |
|---------|--------|-------------------|--------|
| Anthropic | ANTHROPIC_API_KEY | 90 days | Content generation stops |
| Supabase | SUPABASE_SERVICE_ROLE_KEY | 90 days | All API routes fail |
| Supabase | JWT_SECRET | 90 days | All sessions invalidated |
| Helius | NEXT_PUBLIC_HELIUS_RPC_URL | As needed | RPC calls fail, fallback to public |
| Upstash | UPSTASH_REDIS_REST_TOKEN | 90 days | Rate limiting disabled |
| Langfuse | LANGFUSE_SECRET_KEY | 90 days | Telemetry stops (non-fatal) |
| fal.ai | FAL_KEY | 90 days | Image generation stops |
| Mem0 | MEM0_API_KEY | 90 days | Memory recall fails |
| Ayrshare | AYRSHARE_API_KEY | 90 days | Social publishing stops |
| Trigger.dev | TRIGGER_API_KEY | 90 days | Background jobs stop |
| Cloudflare R2 | R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY | 90 days | Media storage fails |

## Zero-Downtime Rotation Procedure

### Step 1: Generate New Secret
Generate the new secret in the service's dashboard. Do NOT revoke the old secret yet.

### Step 2: Update Infisical
1. Open Infisical dashboard → Project → Environment (staging first)
2. Update the secret value to the new secret
3. Verify the update is saved

### Step 3: Deploy & Verify (Staging)
1. Trigger a staging deployment (or restart the staging server)
2. Verify the application starts successfully
3. Test the affected functionality end-to-end
4. Check logs for any errors related to the rotated secret

### Step 4: Deploy & Verify (Production)
1. Update the secret in Infisical production environment
2. Trigger a production deployment
3. Monitor logs for 15 minutes
4. Verify affected functionality

### Step 5: Revoke Old Secret
Only after production is verified working with the new secret:
1. Revoke/delete the old secret in the service's dashboard
2. Verify application continues working

## Emergency Rotation
If a secret is compromised:
1. Generate new secret immediately
2. Update Infisical production environment
3. Deploy immediately (skip staging)
4. Revoke old secret
5. Audit logs for unauthorized access during exposure window
