# Railway Deployment — Trigger.dev Workers

## Overview
Trigger.dev background jobs (scheduled content generation, social publishing, metrics refresh) run on Railway as a separate service from the Next.js application.

## Architecture
```
Vercel (Next.js app) → Trigger.dev Cloud → Railway (Worker)
```

The Next.js app enqueues jobs via the Trigger.dev SDK. Trigger.dev Cloud orchestrates job execution. Railway runs the worker process that executes the actual job logic.

## Railway Setup

### 1. Create Project
```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
```

### 2. Configure Environment
Set these environment variables in Railway dashboard:
- `TRIGGER_API_KEY` — from Trigger.dev dashboard
- `TRIGGER_API_URL` — Trigger.dev API endpoint
- `ANTHROPIC_API_KEY` — for content generation jobs
- `MEM0_API_KEY` — for memory-enhanced generation
- `AYRSHARE_API_KEY` — for social publishing jobs
- `SUPABASE_SERVICE_ROLE_KEY` — for database writes
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `LANGFUSE_SECRET_KEY` — for telemetry
- `LANGFUSE_PUBLIC_KEY` — for telemetry
- `LANGFUSE_BASEURL` — Langfuse endpoint

### 3. Deploy
```bash
railway up
```

### 4. Health Check
Railway automatically monitors the process. Configure restart policy:
- Max restarts: 10
- Restart delay: 30s

## Job Inventory

| Job | Schedule | Dependencies |
|-----|----------|-------------|
| `generate-scheduled` | Cron per character | Anthropic, Mem0, Supabase |
| `publish-social` | After generation | Ayrshare, Supabase |
| `refresh-metrics` | Every 15 minutes | Supabase |

## Monitoring
- Railway dashboard: CPU, memory, logs
- Trigger.dev dashboard: Job success/failure rates, execution times
- Langfuse: AI generation traces
