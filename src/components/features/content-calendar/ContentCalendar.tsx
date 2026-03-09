'use client';

/**
 * ContentCalendar
 * Weekly calendar view for scheduled agent posts.
 * Fetches from /api/ai/schedules and gracefully handles empty/error states.
 */

import { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, X, Twitter, Instagram, Linkedin } from 'lucide-react';
import { useYellowBrickStore } from '@/components/features/yellow-brick';
import { useAuthStore } from '@/features/wallet/store';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScheduledPost {
  id: string;
  content: string;
  platform: 'twitter' | 'instagram' | 'linkedin';
  scheduledAt: string; // ISO 8601
  status: 'pending' | 'published' | 'failed';
}

type Platform = ScheduledPost['platform'];

interface SchedulePostPayload {
  content: string;
  platform: Platform;
  scheduledAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Returns Monday of the week containing `date` */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun, 1 = Mon …
  const diff = (day === 0 ? -6 : 1 - day); // shift so Monday = 0
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
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
// API fetcher — tolerates 404 / malformed responses
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

    // The existing API returns { data: [...], pagination: {...} }
    // We map the existing schedule shape onto ScheduledPost
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

          // Map contentType to platform (best-effort)
          let platform: Platform = 'twitter';
          if (typeof s['contentType'] === 'string') {
            if (s['contentType'] === 'image') platform = 'instagram';
            else if (s['contentType'] === 'video') platform = 'linkedin';
          }

          const status: ScheduledPost['status'] =
            s['isActive'] === false ? 'failed' : 'pending';

          if (!scheduledAt) return [];

          return [{ id, content, platform, scheduledAt, status }];
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
      // Map to existing API shape
      scheduleType: 'one_time',
      nextRunAt: payload.scheduledAt,
      contentType: payload.platform === 'instagram' ? 'image' : 'text',
      promptTemplate: payload.content,
      characterId: '00000000-0000-0000-0000-000000000000', // placeholder — real form would select character
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

// ---------------------------------------------------------------------------
// Schedule Post Modal
// ---------------------------------------------------------------------------

interface SchedulePostModalProps {
  open: boolean;
  onClose: () => void;
  defaultDate?: Date;
  onSuccess: () => void;
}

function SchedulePostModal({ open, onClose, defaultDate, onSuccess }: SchedulePostModalProps) {
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
    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
    mutation.mutate({ content, platform, scheduledAt });
  };

  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-full max-w-md rounded-lg border border-[#27272A] bg-[#18181B] p-0 text-white shadow-2xl backdrop:bg-black/60"
      onClose={onClose}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#27272A] px-6 py-4">
        <h2 className="font-display text-lg font-semibold">Schedule Post</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[#71717A] transition-colors hover:text-white"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
        {/* Content textarea */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#A1A1AA]" htmlFor="post-content">
            What should your agent post?
          </label>
          <textarea
            id="post-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            minLength={1}
            rows={4}
            className="w-full resize-none rounded-md border border-[#27272A] bg-[#0A0A0B] px-3 py-2 text-sm text-white placeholder-[#52525B] focus:border-[#F59E0B] focus:outline-none"
            placeholder="Enter post content or prompt for your agent..."
          />
        </div>

        {/* Platform select */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#A1A1AA]" htmlFor="post-platform">
            Platform
          </label>
          <select
            id="post-platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            className="w-full rounded-md border border-[#27272A] bg-[#0A0A0B] px-3 py-2 text-sm text-white focus:border-[#F59E0B] focus:outline-none"
          >
            <option value="twitter">Twitter / X</option>
            <option value="instagram">Instagram</option>
            <option value="linkedin">LinkedIn</option>
          </select>
        </div>

        {/* Date + time row */}
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="block text-sm font-medium text-[#A1A1AA]" htmlFor="post-date">
              Date
            </label>
            <input
              id="post-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full rounded-md border border-[#27272A] bg-[#0A0A0B] px-3 py-2 text-sm text-white focus:border-[#F59E0B] focus:outline-none"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="block text-sm font-medium text-[#A1A1AA]" htmlFor="post-time">
              Time
            </label>
            <input
              id="post-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              className="w-full rounded-md border border-[#27272A] bg-[#0A0A0B] px-3 py-2 text-sm text-white focus:border-[#F59E0B] focus:outline-none"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        {/* Success */}
        {success && (
          <p className="text-sm text-[#14F195]" aria-live="polite">
            Post scheduled successfully!
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#27272A] px-4 py-2 text-sm text-[#A1A1AA] transition-colors hover:border-[#3F3F46] hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || !content.trim()}
            className="rounded-md bg-[#F59E0B] px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? 'Scheduling…' : 'Schedule'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// Post Chip
// ---------------------------------------------------------------------------

function PostChip({ post }: { post: ScheduledPost }) {
  const preview =
    post.content.length > 40 ? post.content.slice(0, 40) + '…' : post.content;

  return (
    <div className="flex items-start gap-1.5 rounded border-l-2 border-[#F59E0B] bg-[#27272A] px-2 py-1 text-left">
      <PlatformIcon platform={post.platform} className="mt-0.5 shrink-0 text-[#F59E0B]" />
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-white">{formatTime(post.scheduledAt)}</p>
        <p className="truncate text-[10px] leading-tight text-[#A1A1AA]">{preview}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ContentCalendar() {
  const setContext = useYellowBrickStore((s) => s.setContext);
  const token = useAuthStore((s) => s.token);

  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);

  // Set YellowBrick context to calendar on mount
  useEffect(() => {
    setContext('calendar');
    return () => setContext('dashboard');
  }, [setContext]);

  const { data: posts = [], isError } = useQuery<ScheduledPost[]>({
    queryKey: ['calendar-posts', token],
    queryFn: () => fetchScheduledPosts(token),
    retry: false,
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

  return (
    <div className="min-h-full bg-[#0A0A0B] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Content Calendar</h1>
          <p className="mt-1 text-sm text-[#71717A]">
            Schedule and manage your agent posts across platforms
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedDay(undefined);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-md bg-[#F59E0B] px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
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
          className="rounded border border-[#27272A] px-3 py-1 text-xs text-[#A1A1AA] transition-colors hover:border-[#3F3F46] hover:text-white"
        >
          This week
        </button>
        <button
          type="button"
          onClick={prevWeek}
          aria-label="Previous week"
          className="rounded border border-[#27272A] p-1.5 text-[#A1A1AA] transition-colors hover:border-[#3F3F46] hover:text-white"
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
          className="rounded border border-[#27272A] p-1.5 text-[#A1A1AA] transition-colors hover:border-[#3F3F46] hover:text-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Error banner */}
      {isError && (
        <p className="mb-4 text-sm text-[#71717A]" role="status">
          Could not load scheduled posts. Showing empty calendar.
        </p>
      )}

      {/* Weekly grid */}
      <div
        className="grid grid-cols-7 gap-2"
        role="grid"
        aria-label={`Week of ${weekLabel}`}
      >
        {DAYS.map((dayName, i) => {
          const day = dayDates[i] ?? addDays(weekStart, i);
          const dayPosts = postsForDay(day);
          const today = isToday(day);

          return (
            <div
              key={dayName}
              role="gridcell"
              className={cn(
                'flex min-h-[200px] flex-col rounded-lg border bg-[#18181B] p-3',
                today ? 'border-[#F59E0B]/60' : 'border-[#27272A]'
              )}
            >
              {/* Day header */}
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-[#71717A]">{dayName}</span>
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                    today
                      ? 'bg-[#F59E0B] text-black'
                      : 'text-[#A1A1AA]'
                  )}
                >
                  {day.getDate()}
                </span>
              </div>

              {/* Post chips */}
              <div className="flex flex-1 flex-col gap-1.5" aria-live="polite">
                {dayPosts.length > 0 ? (
                  dayPosts.map((post) => <PostChip key={post.id} post={post} />)
                ) : (
                  <p className="mt-2 text-center text-[10px] text-[#3F3F46]">No posts</p>
                )}
              </div>

              {/* Add post shortcut */}
              <button
                type="button"
                onClick={() => {
                  setSelectedDay(day);
                  setModalOpen(true);
                }}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-dashed border-[#3F3F46] py-1 text-[10px] text-[#52525B] transition-colors hover:border-[#F59E0B]/40 hover:text-[#F59E0B]/70"
                aria-label={`Schedule post for ${formatDate(day)}`}
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center gap-6">
        {(['twitter', 'instagram', 'linkedin'] as Platform[]).map((p) => (
          <div key={p} className="flex items-center gap-1.5 text-xs text-[#71717A]">
            <PlatformIcon platform={p} className="text-[#F59E0B]" />
            <span>{PLATFORM_LABELS[p]}</span>
          </div>
        ))}
      </div>

      {/* Schedule post modal */}
      <SchedulePostModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultDate={selectedDay}
        onSuccess={() => setModalOpen(false)}
      />
    </div>
  );
}
