'use client';

/**
 * Content Category Picker
 *
 * Five category cards in a horizontal scrolling row. Selected card uses the
 * Solana purple accent; unselected cards use the dark card style with a
 * hover-state border transition.
 */

import { FileText, Image, Layers, Video, Clapperboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentCategory } from '@/lib/pricing/model-registry';

// ---------------------------------------------------------------------------
// Category definitions
// ---------------------------------------------------------------------------

interface CategoryDef {
  value: ContentCategory;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const CATEGORIES: CategoryDef[] = [
  { value: 'text', label: 'Text', Icon: FileText },
  { value: 'image', label: 'Image', Icon: Image },
  { value: 'image-text', label: 'Image + Text', Icon: Layers },
  { value: 'video', label: 'Video', Icon: Video },
  { value: 'video-text', label: 'Video + Text', Icon: Clapperboard },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ContentCategoryPickerProps {
  value: ContentCategory;
  onChange: (cat: ContentCategory) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContentCategoryPicker({ value, onChange }: ContentCategoryPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Content category"
      className="flex gap-2 overflow-x-auto pb-1"
    >
      {CATEGORIES.map(({ value: cat, label, Icon }) => {
        const isSelected = value === cat;

        return (
          <button
            key={cat}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(cat)}
            className={cn(
              'flex min-w-[100px] flex-1 flex-col items-center gap-2 rounded-lg border px-3 py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9945FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0B]',
              isSelected
                ? 'border-[#9945FF] bg-[#9945FF]/10 text-[#9945FF]'
                : 'border-[#27272A] bg-[#18181B] text-muted-foreground hover:border-[#9945FF]/30'
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="text-xs font-medium leading-none">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
