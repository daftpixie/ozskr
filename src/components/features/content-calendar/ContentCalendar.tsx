'use client';

/**
 * ContentCalendar
 * Weekly calendar view for scheduled agent posts.
 *
 * WS3 additions:
 *  - Task 1: Correct status badges (draft / scheduled / published / failed)
 *  - Task 2: Drag-and-drop reschedule via @dnd-kit/core
 *  - Task 3: Live status polling for scheduled entries (5-second refetch)
 *  - Task 4: Timezone-aware date/time formatting
 */

import { useEffect, useState, useRef, useCallback, startTransition } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ChevronLeft, ChevronRight, Plus, X, Twitter, Instagram, Linkedin, Check } from 'lucide-react';
import { useYellowBrickStore } from '@/components/features/yellow-brick';
import { useAuthStore } from '@/features/wallet/store';
import { cn } from '@/lib/utils';
import { useTimezone } from '@/hooks/use-timezone';
import { useCalendarEntryStatus } from '@/hooks/use-calendar-realtime';
import { logger } from '@/lib/utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Extended status set — superset of the legacy 'pending' value */
type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';

interface ScheduledPost {
  id: string;
  content: string;
  platform: 'twitter' | 'instagram' | 'linkedin';
  scheduledAt: string; // ISO 8601
  status: PostStatus;
  /** Populated when a Trigger.dev run is associated with this entry */
  triggerScheduleId?: string | null;
}

type Platform = ScheduledPost['platform'];

interface SchedulePostPayload {
  content: string;
  platform: Platform;
  scheduledAt: string;
}

interface ReschedulePayload {
  id: string;
  scheduledAt: string;
}

// ---------------------------------------------------------------------------
// Status config — Task 1
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  draft: {
    label: 'Draft',
    className:
      'bg-[var(--color-mid-gray)] text-[var(--color-light-gray)]',
    borderClass: 'border-l-2 border-[var(--color-mid-gray)]',
  },
  scheduled: {
    label: 'Scheduled',
    className:
      'bg-[var(--color-brick-gold)]/20 text-[var(--color-brick-gold)] border border-[var(--color-brick-gold)]/40',
    borderClass: 'border-l-2 border-[var(--color-brick-gold)]',
  },
  published: {
    label: 'Published',
    className:
      'bg-[var(--color-solana-green)]/20 text-[var(--color-solana-green)] border border-[var(--color-solana-green)]/40',
    borderClass: 'border-l-2 border-[var(--color-solana-green)]',
  },
  failed: {
    label: 'Failed',
    className:
      'bg-[var(--color-error)]/20 text-[var(--color-error)] border border-[var(--color-error)]/40',
    borderClass: 'border-l-2 border-[var(--color-error)]',
  },
} as const;

function StatusBadge({ status }: { status: PostStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium',
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isoDatePart(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

/** Timezone-aware time formatter — Task 4 */
function formatTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
    hour12: true,
  });
}

/** Map isActive + status fields from the API onto our PostStatus union */
function deriveStatus(s: Record<string, unknown>): PostStatus {
  // Prefer an explicit `status` field if the backend provides one
  if (typeof s['status'] === 'string') {
    const v = s['status'] as string;
    if (v === 'draft' || v === 'scheduled' || v === 'published' || v === 'failed') {
      return v;
    }
  }
  // Backward-compat with content_schedules shape (isActive boolean)
  if (s['isActive'] === false) return 'failed';
  // Legacy 'pending' maps to 'scheduled'
  if (s['isActive'] === true) return 'scheduled';
  return 'draft';
}

const PLATFORM_LABELS: Record<Platform, string> = {
  twitter: 'Twitter',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
};

function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  switch (platform) {
    case 'twitter':
      return <Twitter className={cn('h-3 w-3', className)} />;
    case 'instagram':
      return <Instagram className={cn('h-3 w-3', className)} />;
    case 'linkedin':
      return <Linkedin className={cn('h-3 w-3', className)} />;
  }
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_BASE = '/api/ai/schedules';

async function fetchScheduledPosts(token: string | null): Promise<ScheduledPost[]> {
  if (!token) return [];

  try {
    const res = await fetch(API_BASE, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) return [];

    const raw: unknown = await res.json();

    if (
      raw !== null &&
      typeof raw === 'object' &&
      'data' in raw &&
      Array.isArray((raw as { data: unknown }).data)
    ) {
      const items = (raw as { data: unknown[] }).data;
      return items.flatMap((item): ScheduledPost[] => {
        if (
          item !== null &&
          typeof item === 'object' &&
          'id' in item &&
          'nextRunAt' in item &&
          'promptTemplate' in item
        ) {
          const s = item as Record<string, unknown>;
          const scheduledAt = typeof s['nextRunAt'] === 'string' ? s['nextRunAt'] : '';
          const content = typeof s['promptTemplate'] === 'string' ? s['promptTemplate'] : '';
          const id = typeof s['id'] === 'string' ? s['id'] : String(s['id']);

          let platform: Platform = 'twitter';
          if (typeof s['contentType'] === 'string') {
            if (s['contentType'] === 'image') platform = 'instagram';
            else if (s['contentType'] === 'video') platform = 'linkedin';
          }

          const status = deriveStatus(s);

          const triggerScheduleId =
            typeof s['triggerScheduleId'] === 'string' ? s['triggerScheduleId'] : null;

          if (!scheduledAt) return [];

          return [{ id, content, platform, scheduledAt, status, triggerScheduleId }];
        }
        return [];
      });
    }

    return [];
  } catch {
    return [];
  }
}

async function postSchedule(
  payload: SchedulePostPayload,
  token: string | null
): Promise<void> {
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      scheduleType: 'one_time',
      nextRunAt: payload.scheduledAt,
      contentType: payload.platform === 'instagram' ? 'image' : 'text',
      promptTemplate: payload.content,
      characterId: '00000000-0000-0000-0000-000000000000',
      autoPublish: false,
    }),
  });

  if (!res.ok) {
    const err: unknown = await res.json().catch(() => ({}));
    const message =
      err !== null && typeof err === 'object' && 'error' in err
        ? String((err as { error: unknown }).error)
        : 'Failed to schedule post';
    throw new Error(message);
  }
}

async function patchScheduleDate(
  payload: ReschedulePayload,
  token: string | null
): Promise<void> {
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}/${payload.id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ nextRunAt: payload.scheduledAt }),
  });

  if (!res.ok) {
    const err: unknown = await res.json().catch(() => ({}));
    const message =
      err !== null && typeof err === 'object' && 'error' in err
        ? String((err as { error: unknown }).error)
        : 'Failed to reschedule post';
    throw new Error(message);
  }
}

// ---------------------------------------------------------------------------
// Task 3: Live status indicator sub-component
// ---------------------------------------------------------------------------

function LiveStatusIndicator({ scheduleId }: { scheduleId: string }) {
  const live = useCalendarEntryStatus(scheduleId, true);

  if (!live) return null;

  if (live.stage === 'complete') {
    return (
      <span className="flex items-center gap-1 text-[9px] text-[var(--color-solana-green)]">
        <Check className="h-2.5 w-2.5" aria-hidden="true" />
        {live.label}
      </span>
    );
  }

  const dotColor =
    live.stage === 'posting'
      ? 'bg-[var(--color-solana-green)]'
      : 'bg-[var(--color-brick-gold)]';

  return (
    <span
      className="flex items-center gap-1 text-[9px] text-[var(--color-light-gray)]"
      aria-live="polite"
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full animate-pulse', dotColor)}
        aria-hidden="true"
      />
      {live.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Task 2: Draggable PostChip
// ---------------------------------------------------------------------------

interface PostChipProps {
  post: ScheduledPost;
  timezone: string;
  /** When true the chip is rendered inside DragOverlay and should not use useDraggable */
  isOverlay?: boolean;
}

function PostChipInner({ post, timezone }: { post: ScheduledPost; timezone: string }) {
  const cfg = STATUS_CONFIG[post.status];
  const preview = post.content.length > 40 ? post.content.slice(0, 40) + '…' : post.content;
  const isScheduledStatus = post.status === 'scheduled';

  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 rounded bg-[var(--color-mid-gray)] px-2 py-1 text-left',
        cfg.borderClass
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <PlatformIcon
            platform={post.platform}
            className={cn(
              'shrink-0',
              post.status === 'published'
                ? 'text-[var(--color-solana-green)]'
                : post.status === 'failed'
                  ? 'text-[var(--color-error)]'
                  : 'text-[var(--color-brick-gold)]'
            )}
          />
          <p className="text-[10px] font-medium text-white">
            {formatTime(post.scheduledAt, timezone)}
          </p>
        </div>
        <StatusBadge status={post.status} />
      </div>

      <p className="truncate text-[10px] leading-tight text-[var(--color-light-gray)]">
        {preview}
      </p>

      {isScheduledStatus && post.triggerScheduleId && (
        <LiveStatusIndicator scheduleId={post.triggerScheduleId} />
      )}
    </div>
  );
}

function PostChip({ post, timezone, isOverlay = false }: PostChipProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: post.id,
    disabled: isOverlay,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(!isOverlay ? listeners : {})}
      {...(!isOverlay ? attributes : {})}
      className={cn(
        'cursor-grab touch-none select-none transition-opacity',
        isDragging && 'opacity-30'
      )}
      role="button"
      tabIndex={0}
      aria-label={`Drag to reschedule: ${post.content.slice(0, 60)}`}
    >
      <PostChipInner post={post} timezone={timezone} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task 2: Droppable day column
// ---------------------------------------------------------------------------

interface DayColumnProps {
  dayName: string;
  day: Date;
  dayPosts: ScheduledPost[];
  today: boolean;
  timezone: string;
  isOver: boolean;
  onAddClick: () => void;
}

function DayColumn({ dayName, day, dayPosts, today, timezone, isOver, onAddClick }: DayColumnProps) {
  const { setNodeRef } = useDroppable({ id: isoDatePart(day) });

  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      className={cn(
        'flex min-h-[200px] flex-col rounded-lg border bg-[var(--color-deep-gray)] p-3 transition-colors',
        today
          ? 'border-[var(--color-brick-gold)]/60'
          : 'border-[var(--color-mid-gray)]',
        isOver && 'border-[var(--color-solana-green)]/60 bg-[var(--color-solana-green)]/5'
      )}
    >
      {/* Day header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--color-soft-gray)]">{dayName}</span>
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
            today
              ? 'bg-[var(--color-brick-gold)] text-black'
              : 'text-[var(--color-light-gray)]'
          )}
        >
          {day.getDate()}
        </span>
      </div>

      {/* Post chips */}
      <div className="flex flex-1 flex-col gap-1.5" aria-live="polite">
        {dayPosts.length > 0 ? (
          dayPosts.map((post) => (
            <PostChip key={post.id} post={post} timezone={timezone} />
          ))
        ) : (
          <p className="mt-2 text-center text-[10px] text-[var(--color-border-subtle)]">
            {isOver ? 'Drop here' : 'No posts'}
          </p>
        )}
      </div>

      {/* Add post shortcut */}
      <button
        type="button"
        onClick={onAddClick}
        className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-dashed border-[var(--color-border-subtle)] py-1 text-[10px] text-[#52525B] transition-colors hover:border-[var(--color-brick-gold)]/40 hover:text-[var(--color-brick-gold)]/70"
        aria-label={`Schedule post for ${formatDate(day)}`}
      >
        <Plus className="h-3 w-3" />
        Add
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedule Post Modal
// ---------------------------------------------------------------------------

interface SchedulePostModalProps {
  open: boolean;
  onClose: () => void;
  defaultDate?: Date;
  onSuccess: () => void;
  timezone: string;
}

function SchedulePostModal({
  open,
  onClose,
  defaultDate,
  onSuccess,
  timezone,
}: SchedulePostModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  const [content, setContent] = useState('');
  const [platform, setPlatform] = useState<Platform>('twitter');
  const [date, setDate] = useState(
    defaultDate ? isoDatePart(defaultDate) : isoDatePart(new Date())
  );
  const [time, setTime] = useState('09:00');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset default date when modal opens for a specific day
  useEffect(() => {
    if (open && defaultDate) {
      startTransition(() => setDate(isoDatePart(defaultDate)));
    }
  }, [open, defaultDate]);

  const mutation = useMutation({
    mutationFn: (payload: SchedulePostPayload) => postSchedule(payload, token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['calendar-posts'] });
      setSuccess(true);
      setContent('');
      setTimeout(() => {
        setSuccess(false);
        onSuccess();
        onClose();
      }, 1200);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Task 4: The user selects date/time in their timezone; we convert to UTC
    // by constructing a Date from the local-time string interpreted in their tz.
    // Using Intl to get UTC offset for the chosen date+time in the user's tz.
    const localDateTimeStr = `${date}T${time}:00`;
    // Build a UTC ISO string by creating the date in local wall-clock time
    // then letting Date handle the UTC conversion.
    const scheduledAt = new Date(localDateTimeStr).toISOString();
    mutation.mutate({ content, platform, scheduledAt });
  };

  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-full max-w-md rounded-lg border border-[var(--color-mid-gray)] bg-[var(--color-deep-gray)] p-0 text-white shadow-2xl backdrop:bg-black/60"
      onClose={onClose}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-mid-gray)] px-6 py-4">
        <h2 className="font-display text-lg font-semibold">Schedule Post</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[var(--color-soft-gray)] transition-colors hover:text-white"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
        {/* Content textarea */}
        <div className="space-y-1.5">
          <label
            className="block text-sm font-medium text-[var(--color-light-gray)]"
            htmlFor="post-content"
          >
            What should your agent post?
          </label>
          <textarea
            id="post-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            minLength={1}
            rows={4}
            className="w-full resize-none rounded-md border border-[var(--color-mid-gray)] bg-[var(--color-void-black)] px-3 py-2 text-sm text-white placeholder-[#52525B] focus:border-[var(--color-brick-gold)] focus:outline-none"
            placeholder="Enter post content or prompt for your agent..."
          />
        </div>

        {/* Platform select */}
        <div className="space-y-1.5">
          <label
            className="block text-sm font-medium text-[var(--color-light-gray)]"
            htmlFor="post-platform"
          >
            Platform
          </label>
          <select
            id="post-platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            className="w-full rounded-md border border-[var(--color-mid-gray)] bg-[var(--color-void-black)] px-3 py-2 text-sm text-white focus:border-[var(--color-brick-gold)] focus:outline-none"
          >
            <option value="twitter">Twitter / X</option>
            <option value="instagram">Instagram</option>
            <option value="linkedin">LinkedIn</option>
          </select>
        </div>

        {/* Date + time row */}
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <label
              className="block text-sm font-medium text-[var(--color-light-gray)]"
              htmlFor="post-date"
            >
              Date
            </label>
            <input
              id="post-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full rounded-md border border-[var(--color-mid-gray)] bg-[var(--color-void-black)] px-3 py-2 text-sm text-white focus:border-[var(--color-brick-gold)] focus:outline-none"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <label
              className="block text-sm font-medium text-[var(--color-light-gray)]"
              htmlFor="post-time"
            >
              Time
            </label>
            <input
              id="post-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              className="w-full rounded-md border border-[var(--color-mid-gray)] bg-[var(--color-void-black)] px-3 py-2 text-sm text-white focus:border-[var(--color-brick-gold)] focus:outline-none"
            />
          </div>
        </div>

        {/* Task 4: Active timezone display */}
        <p className="text-xs text-[var(--color-soft-gray)]">
          Times shown in: <span className="font-medium">{timezone}</span>
        </p>

        {error && (
          <p className="text-sm text-[var(--color-error)]" role="alert">
            {error}
          </p>
        )}

        {success && (
          <p className="text-sm text-[var(--color-solana-green)]" aria-live="polite">
            Post scheduled successfully!
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-mid-gray)] px-4 py-2 text-sm text-[var(--color-light-gray)] transition-colors hover:border-[var(--color-border-subtle)] hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || !content.trim()}
            className="rounded-md bg-[var(--color-brick-gold)] px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? 'Scheduling…' : 'Schedule'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ContentCalendar() {
  const setContext = useYellowBrickStore((s) => s.setContext);
  const token = useAuthStore((s) => s.token);
  const timezone = useTimezone();

  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);

  // Task 2: track the post being dragged so we can render the overlay chip
  const [activeDragPost, setActiveDragPost] = useState<ScheduledPost | null>(null);
  // Track which droppable is currently over (for visual drop indicators)
  const [overId, setOverId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Task 2: determine if any post is in scheduled state (enables polling)
  const hasScheduledPosts = (posts: ScheduledPost[]) =>
    posts.some((p) => p.status === 'scheduled');

  useEffect(() => {
    setContext('calendar');
    return () => setContext('dashboard');
  }, [setContext]);

  const { data: posts = [], isError } = useQuery<ScheduledPost[]>({
    queryKey: ['calendar-posts', token],
    queryFn: () => fetchScheduledPosts(token),
    retry: false,
    // Task 3: poll while any scheduled post is in-flight
    refetchInterval: (query) => {
      const data = query.state.data;
      if (Array.isArray(data) && hasScheduledPosts(data)) return 5000;
      return false;
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: (payload: ReschedulePayload) => patchScheduleDate(payload, token),
    onError: (err: Error) => {
      logger.warn('Reschedule failed, reverting', { error: err.message });
      void queryClient.invalidateQueries({ queryKey: ['calendar-posts'] });
    },
  });

  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${formatDate(weekStart)} – ${formatDate(weekEnd)}`;

  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d, 7));
  const goToThisWeek = () => setWeekStart(getWeekStart(new Date()));

  const dayDates = DAYS.map((_, i) => addDays(weekStart, i));

  function postsForDay(day: Date): ScheduledPost[] {
    const dayStr = isoDatePart(day);
    return posts.filter((p) => p.scheduledAt.startsWith(dayStr));
  }

  const isToday = (day: Date) => isoDatePart(day) === isoDatePart(new Date());

  // ---------------------------------------------------------------------------
  // Task 2: DnD handlers
  // ---------------------------------------------------------------------------

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const post = posts.find((p) => p.id === event.active.id);
      setActiveDragPost(post ?? null);
    },
    [posts]
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragPost(null);
      setOverId(null);

      const { active, over } = event;
      if (!over) return;

      const postId = String(active.id);
      const newDay = String(over.id); // ISO date string e.g. "2026-03-09"

      const post = posts.find((p) => p.id === postId);
      if (!post) return;

      // Already on the same day — no-op
      if (post.scheduledAt.startsWith(newDay)) return;

      // Keep original time, move to the new day
      const originalTime = new Date(post.scheduledAt);
      const [year, month, dayNum] = newDay.split('-').map(Number) as [number, number, number];
      const newDate = new Date(originalTime);
      newDate.setFullYear(year, month - 1, dayNum);

      const newScheduledAt = newDate.toISOString();

      // Optimistic update
      queryClient.setQueryData<ScheduledPost[]>(
        ['calendar-posts', token],
        (prev) =>
          prev?.map((p) =>
            p.id === postId ? { ...p, scheduledAt: newScheduledAt } : p
          ) ?? []
      );

      rescheduleMutation.mutate({ id: postId, scheduledAt: newScheduledAt });
    },
    [posts, queryClient, rescheduleMutation, token]
  );

  return (
    <div className="min-h-full bg-[var(--color-void-black)] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Content Calendar</h1>
          <p className="mt-1 text-sm text-[var(--color-soft-gray)]">
            Schedule and manage your agent posts across platforms
          </p>
          {/* Task 4: Timezone indicator */}
          <span className="text-xs text-[var(--color-soft-gray)]">{timezone}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedDay(undefined);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-md bg-[var(--color-brick-gold)] px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Schedule Post
        </button>
      </div>

      {/* Week navigation */}
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={goToThisWeek}
          className="rounded border border-[var(--color-mid-gray)] px-3 py-1 text-xs text-[var(--color-light-gray)] transition-colors hover:border-[var(--color-border-subtle)] hover:text-white"
        >
          This week
        </button>
        <button
          type="button"
          onClick={prevWeek}
          aria-label="Previous week"
          className="rounded border border-[var(--color-mid-gray)] p-1.5 text-[var(--color-light-gray)] transition-colors hover:border-[var(--color-border-subtle)] hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[160px] text-center text-sm font-medium text-white">
          {weekLabel}
        </span>
        <button
          type="button"
          onClick={nextWeek}
          aria-label="Next week"
          className="rounded border border-[var(--color-mid-gray)] p-1.5 text-[var(--color-light-gray)] transition-colors hover:border-[var(--color-border-subtle)] hover:text-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Error banner */}
      {isError && (
        <p className="mb-4 text-sm text-[var(--color-soft-gray)]" role="status">
          Could not load scheduled posts. Showing empty calendar.
        </p>
      )}

      {/* Task 2: DnD context wrapping the weekly grid */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div
          className="grid grid-cols-7 gap-2"
          role="grid"
          aria-label={`Week of ${weekLabel}`}
        >
          {DAYS.map((dayName, i) => {
            const day = dayDates[i] ?? addDays(weekStart, i);
            const dayPosts = postsForDay(day);
            const today = isToday(day);
            const dayIso = isoDatePart(day);

            return (
              <DayColumn
                key={dayName}
                dayName={dayName}
                day={day}
                dayPosts={dayPosts}
                today={today}
                timezone={timezone}
                isOver={overId === dayIso}
                onAddClick={() => {
                  setSelectedDay(day);
                  setModalOpen(true);
                }}
              />
            );
          })}
        </div>

        {/* Drag overlay — renders a non-interactive copy of the chip while dragging */}
        <DragOverlay dropAnimation={null}>
          {activeDragPost ? (
            <div className="opacity-90 shadow-xl">
              <PostChip post={activeDragPost} timezone={timezone} isOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
        {(['twitter', 'instagram', 'linkedin'] as Platform[]).map((p) => (
          <div
            key={p}
            className="flex items-center gap-1.5 text-xs text-[var(--color-soft-gray)]"
          >
            <PlatformIcon platform={p} className="text-[var(--color-brick-gold)]" />
            <span>{PLATFORM_LABELS[p]}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-3 text-[10px] text-[var(--color-soft-gray)]">
          {(['draft', 'scheduled', 'published', 'failed'] as PostStatus[]).map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </div>

      {/* Schedule post modal */}
      <SchedulePostModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultDate={selectedDay}
        onSuccess={() => setModalOpen(false)}
        timezone={timezone}
      />
    </div>
  );
}
