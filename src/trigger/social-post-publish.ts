import { task, metadata } from '@trigger.dev/sdk/v3';
import { publishCalendarEntry, type SocialPostPayload } from '@/lib/jobs/social-post';

/**
 * Triggered task: publishes a scheduled content_calendar entry when its
 * publish time arrives.
 *
 * Scheduled by contentCalendarCreateTool via tasks.trigger() with a delay.
 * Retries up to 3 times with exponential back-off before marking as failed.
 *
 * Orchestration boundary: Mastra workflow (simple linear pipeline).
 * LangGraph is reserved for multi-step quality retry loops.
 */
export const socialPostPublishTask = task({
  id: 'social-post-publish',
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30000,
  },
  run: async (payload: SocialPostPayload) => {
    await metadata.set('stage', 'loading');
    await metadata.set('calendarEntryId', payload.calendarEntryId);
    await metadata.set('platform', payload.platform);

    await metadata.set('stage', 'moderating');

    // publishCalendarEntry handles moderation + publish + Mem0 in a single linear flow
    await metadata.set('stage', 'posting');

    const result = await publishCalendarEntry(payload);

    await metadata.set('stage', 'complete');
    await metadata.set('publishStatus', result.status);

    return result;
  },
});
