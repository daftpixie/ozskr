import { schedules } from '@trigger.dev/sdk/v3';
import { refreshEngagementMetrics } from '@/lib/jobs/refresh-metrics';

/**
 * Scheduled task: runs every 6 hours, refreshes engagement metrics for
 * recent posts and recomputes daily analytics snapshots per character.
 */
export const refreshMetricsTask = schedules.task({
  id: 'refresh-engagement-metrics',
  cron: '0 */6 * * *',
  run: async () => {
    const updated = await refreshEngagementMetrics();
    return { postsUpdated: updated };
  },
});
