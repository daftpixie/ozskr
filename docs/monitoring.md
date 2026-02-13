# Monitoring & Alerting

## Health Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `GET /api/health` | Application health | `200 { status: "ok" }` |
| `GET /api/health/ready` | Readiness probe (DB + Redis) | `200 { status: "ready" }` |

## Monitoring Stack

### Application Monitoring
- **Vercel Analytics**: Core Web Vitals, page load times, error rates
- **Vercel Logs**: Application logs (structured JSON in production)

### AI Observability
- **Langfuse**: All Claude API calls traced with input/output, token usage, latency, cache hits
- Dashboard: `LANGFUSE_BASEURL/dashboard`

### Infrastructure
- **Vercel**: Deployment status, serverless function invocations, bandwidth
- **Railway**: Worker CPU/memory, restart count, job execution logs
- **Supabase Dashboard**: Database size, connection pool, RLS policy violations
- **Upstash Console**: Redis memory usage, request count, rate limit hits

### Error Tracking
- `logger.error()` calls are structured JSON — parse with log aggregator
- Optional: `setErrorTracker()` hook in `src/lib/utils/logger.ts` for external services (Sentry, Datadog, etc.)

## Alerting Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| API error rate | > 1% | > 5% | Check Vercel logs |
| API latency (p95) | > 2s | > 5s | Check RPC/Supabase |
| Claude API errors | > 5/hour | > 20/hour | Check API key/quota |
| Job failure rate | > 10% | > 50% | Check Railway logs |
| Supabase connections | > 80% pool | > 95% pool | Scale connection pool |
| Redis memory | > 80% | > 95% | Review rate limit config |
| Build failures | Any | N/A | Fix before merge |

## Runbook: Common Issues

### High API Latency
1. Check Helius RPC status: https://status.helius.dev
2. Check Supabase status: project dashboard
3. Check if rate limits are being hit (Upstash console)
4. Review recent deployments for regressions

### Claude API Errors
1. Check Anthropic status: https://status.anthropic.com
2. Verify API key is valid (Infisical)
3. Check token usage against quota
4. Review Langfuse traces for error patterns

### Job Failures
1. Check Railway logs for the specific job
2. Check Trigger.dev dashboard for error details
3. Verify all job dependencies (API keys, DB access)
4. Check if the job is hitting timeout limits
