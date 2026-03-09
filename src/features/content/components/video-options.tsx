'use client';

/**
 * Video Options Panel
 *
 * Duration, resolution, and audio settings for video and video-text
 * content categories. Shows an estimated cost preview line.
 */

import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DURATION_OPTIONS = [5, 7, 8] as const;

const RESOLUTION_OPTIONS: Array<'720p' | '1080p' | '4K'> = ['720p', '1080p', '4K'];

/** Approximate price-per-second placeholder shown before a live quote loads */
const APPROX_PRICE_PER_SEC = 0.15;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VideoOptionsProps {
  duration: number;
  resolution: '720p' | '1080p' | '4K';
  generateAudio: boolean;
  onDurationChange: (s: number) => void;
  onResolutionChange: (r: '720p' | '1080p' | '4K') => void;
  onAudioChange: (v: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VideoOptions({
  duration,
  resolution,
  generateAudio,
  onDurationChange,
  onResolutionChange,
  onAudioChange,
}: VideoOptionsProps) {
  const estimatedBase = (APPROX_PRICE_PER_SEC * duration).toFixed(2);

  return (
    <div className="space-y-4 rounded-lg border border-[#27272A] bg-[#18181B] p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Video Settings
      </p>

      {/* Duration */}
      <div className="space-y-2">
        <Label className="text-sm">Duration</Label>
        <div role="radiogroup" aria-label="Video duration" className="flex gap-2">
          {DURATION_OPTIONS.map((sec) => (
            <button
              key={sec}
              type="button"
              role="radio"
              aria-checked={duration === sec}
              onClick={() => onDurationChange(sec)}
              className={cn(
                'flex-1 rounded-md border py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9945FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0B]',
                duration === sec
                  ? 'border-[#9945FF] bg-[#9945FF]/10 text-[#9945FF]'
                  : 'border-[#27272A] text-muted-foreground hover:border-[#9945FF]/30'
              )}
            >
              {sec}s
            </button>
          ))}
        </div>
      </div>

      {/* Resolution */}
      <div className="space-y-2">
        <Label htmlFor="video-resolution" className="text-sm">
          Resolution
        </Label>
        <Select
          value={resolution}
          onValueChange={(val) => onResolutionChange(val as '720p' | '1080p' | '4K')}
        >
          <SelectTrigger id="video-resolution" className="bg-[#0A0A0B]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESOLUTION_OPTIONS.map((res) => (
              <SelectItem key={res} value={res}>
                {res}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Audio */}
      <div className="flex items-center gap-3">
        <Checkbox
          id="generate-audio"
          checked={generateAudio}
          onCheckedChange={(checked) => onAudioChange(checked === true)}
        />
        <Label htmlFor="generate-audio" className="cursor-pointer text-sm">
          Generate audio
        </Label>
      </div>

      {/* Estimated cost preview */}
      <p className="text-xs text-muted-foreground">
        Estimated base:{' '}
        <span className="font-mono text-[#10B981]">
          {duration}s × ~${APPROX_PRICE_PER_SEC.toFixed(2)}/s = ~${estimatedBase}
        </span>{' '}
        (live pricing shown below)
      </p>
    </div>
  );
}
