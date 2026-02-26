import { schedules } from '@trigger.dev/sdk/v3';
import { processScheduledContent } from '@/lib/jobs/generate-scheduled';

/**
 * Scheduled task: runs every 15 minutes, picks up any due content_schedules
 * and generates content via the AI pipeline.
 */
export const processSchedulesTask = schedules.task({
  id: 'process-scheduled-content',
  cron: '*/15 * * * *',
  run: async () => {
    return processScheduledContent();
  },
});
