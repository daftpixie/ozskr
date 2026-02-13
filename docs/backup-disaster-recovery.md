# Backup & Disaster Recovery

## Backup Strategy

### Supabase Database
- **Automatic backups**: Enabled via Supabase Pro plan (daily, 7-day retention)
- **Point-in-time recovery**: Available on Pro plan (up to 7 days)
- **Manual backups**: `pg_dump` via direct connection for pre-migration snapshots

#### Manual Backup Procedure
```bash
# Set connection string from Supabase dashboard
export DATABASE_URL="postgresql://..."

# Full backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Schema only
pg_dump --schema-only $DATABASE_URL > schema-$(date +%Y%m%d).sql
```

### Cloudflare R2 (Media Storage)
- **Cross-region replication**: Configure in Cloudflare dashboard
- **Versioning**: Enable bucket versioning for rollback capability
- Media files are generated content — regenerable from prompts stored in DB

### Infisical (Secrets)
- **Export**: Infisical supports encrypted secret exports
- **Backup frequency**: After every rotation
- Store encrypted backup in a separate secure location

## Disaster Recovery Plan

### Severity Levels

| Level | Description | RTO | RPO |
|-------|-------------|-----|-----|
| S1 | Full outage (Vercel + DB) | 1 hour | 24 hours |
| S2 | Partial outage (one service) | 30 min | 1 hour |
| S3 | Data corruption | 2 hours | Point-in-time |
| S4 | Secret compromise | 15 min | N/A |

### Recovery Procedures

#### S1: Full Outage
1. Check Vercel status page — if Vercel-wide, wait for resolution
2. If deployment-specific: roll back to last known good deployment via Vercel dashboard
3. If database: restore from Supabase automatic backup
4. Verify all services are connected and functional
5. Run health check endpoints

#### S2: Partial Service Outage
1. Identify the failed service (check monitoring dashboard)
2. If RPC: automatic fallback to public endpoint is built-in
3. If Redis: rate limiting degrades gracefully (allows requests)
4. If Trigger.dev: jobs queue and retry automatically
5. If R2: media uploads fail but app continues functioning

#### S3: Data Corruption
1. Identify the affected tables/rows
2. Use Supabase point-in-time recovery to restore to pre-corruption state
3. If limited scope: restore specific tables from pg_dump backup
4. Verify RLS policies are intact after restore
5. Re-run any failed background jobs

#### S4: Secret Compromise
1. Follow Emergency Rotation procedure in `secret-rotation.md`
2. Audit all logs from compromise window
3. Check for unauthorized data access
4. Notify affected users if personal data was exposed
5. Document incident and update security procedures

## Testing DR Procedures
- **Quarterly**: Test database restore from backup
- **After rotation**: Verify application works with new secrets
- **Pre-launch**: Full DR drill with all severity levels
