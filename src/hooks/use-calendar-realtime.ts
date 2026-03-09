'use client';

/**
 * useCalendarEntryStatus
 * Subscribes to a Trigger.dev run's realtime metadata using @trigger.dev/react-hooks.
 *
 * The run's metadata stages are set by social-post-publish.ts:
 *   loading → moderating → posting → complete
 *
 * Falls back to null (no live status) when the entry is not in `scheduled` status.
 */

import { useRealtimeRun } from '@trigger.dev/react-hooks';

export type CalendarEntryLiveStatus =
  | { stage: 'moderating'; label: 'Checking...' }
  | { stage: 'posting'; label: 'Publishing...' }
  | { stage: 'complete'; label: 'Published' }
  | null;

const TRIGGER_PUBLIC_KEY = process.env.NEXT_PUBLIC_TRIGGER_PUBLIC_KEY ?? '';

function deriveStageFromMetadata(
  metadata: Record<string, unknown> | undefined
): CalendarEntryLiveStatus {
  const stage = metadata?.stage as string | undefined;
  if (stage === 'moderating' || stage === 'loading') {
    return { stage: 'moderating', label: 'Checking...' };
  }
  if (stage === 'posting') {
    return { stage: 'posting', label: 'Publishing...' };
  }
  if (stage === 'complete') {
    return { stage: 'complete', label: 'Published' };
  }
  return null;
}

/**
 * Subscribes to the Trigger.dev run for a single calendar entry.
 * @param triggerRunId - The trigger run ID stored in content_calendar.trigger_schedule_id
 * @param isScheduled  - Whether the entry is in `scheduled` status (disables subscription otherwise)
 */
export function useCalendarEntryStatus(
  triggerRunId: string | null,
  isScheduled: boolean
): CalendarEntryLiveStatus {
  const enabled = isScheduled && !!triggerRunId && !!TRIGGER_PUBLIC_KEY;

  // useRealtimeRun is typed as AnyTask by default — no need to constrain to the specific task type
  const { run } = useRealtimeRun(
    enabled ? (triggerRunId ?? undefined) : undefined,
    {
      accessToken: TRIGGER_PUBLIC_KEY,
      enabled,
    }
  );

  if (!isScheduled || !run) return null;

  return deriveStageFromMetadata(run.metadata as Record<string, unknown> | undefined);
}
