'use client';

/**
 * ContentCard
 * Renders a single generation in the content library grid.
 * Handles text and image generation types with moderation status badges.
 */

import Image from 'next/image';
import { Copy, Eye, Share2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/utils/time';
import type { ContentGenerationResponse } from '@/types/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentCardProps {
  generation: ContentGenerationResponse;
  onClick: (generation: ContentGenerationResponse) => void;
  onPublish: (generation: ContentGenerationResponse) => void;
}

// ---------------------------------------------------------------------------
// Moderation badge
// ---------------------------------------------------------------------------

function ModerationBadge({ status }: { status: string }) {
  const classes = {
    approved:
      'bg-solana-green/20 text-solana-green border-solana-green/30',
    flagged:
      'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    rejected:
      'bg-destructive/20 text-destructive border-destructive/30',
    pending:
      'bg-muted text-muted-foreground',
    processing:
      'bg-muted text-muted-foreground',
  } as Record<string, string>;

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs capitalize',
        classes[status] ?? 'bg-muted text-muted-foreground'
      )}
    >
      {status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Quality score badge
// ---------------------------------------------------------------------------

function QualityBadge({ score }: { score: number }) {
  return (
    <Badge
      variant="secondary"
      className="text-xs tabular-nums text-[#10B981]"
    >
      {score.toFixed(2)} ✦
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Copy-to-clipboard helper
// ---------------------------------------------------------------------------

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}

// ---------------------------------------------------------------------------
// ContentCard
// ---------------------------------------------------------------------------

export function ContentCard({ generation, onClick, onPublish }: ContentCardProps) {
  const isImage =
    generation.generationType === 'image' ||
    generation.generationType === 'video';

  return (
    <Card
      className={cn(
        'group flex flex-col border-border bg-[#18181B] transition-colors',
        'hover:border-solana-purple/40 cursor-pointer'
      )}
    >
      {/* Clickable body */}
      <CardContent
        className="flex-1 p-0"
        onClick={() => onClick(generation)}
        role="button"
        tabIndex={0}
        aria-label={`View generation detail`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick(generation);
          }
        }}
      >
        {/* Image thumbnail */}
        {isImage && generation.outputUrl && (
          <div className="relative aspect-square w-full overflow-hidden rounded-t-lg">
            <Image
              src={generation.outputUrl}
              alt="Generated image"
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        )}

        {/* Placeholder when image URL is missing */}
        {isImage && !generation.outputUrl && (
          <div className="flex aspect-square w-full items-center justify-center rounded-t-lg bg-muted/20">
            <span className="text-xs text-muted-foreground">No preview</span>
          </div>
        )}

        {/* Text preview */}
        {!isImage && (
          <div className="p-4 pb-2">
            {generation.outputText ? (
              <p className="line-clamp-3 text-sm leading-relaxed text-foreground/90">
                {generation.outputText}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No output text
              </p>
            )}
          </div>
        )}
      </CardContent>

      {/* Footer */}
      <div className="flex flex-col gap-2 p-3 pt-2">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <ModerationBadge status={generation.moderationStatus} />
          {generation.qualityScore !== null && (
            <QualityBadge score={generation.qualityScore} />
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {timeAgo(generation.createdAt)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {isImage ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 flex-1 gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                if (generation.outputUrl) {
                  copyToClipboard(generation.outputUrl);
                }
              }}
            >
              <Copy className="h-3 w-3" />
              Copy URL
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 flex-1 gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                if (generation.outputText) {
                  copyToClipboard(generation.outputText);
                }
              }}
            >
              <Copy className="h-3 w-3" />
              Copy
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-7 flex-1 gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onClick(generation);
            }}
          >
            <Eye className="h-3 w-3" />
            View
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 flex-1 gap-1 text-xs text-muted-foreground hover:text-solana-purple"
            onClick={(e) => {
              e.stopPropagation();
              onPublish(generation);
            }}
            disabled={generation.moderationStatus === 'rejected'}
          >
            <Share2 className="h-3 w-3" />
            Publish
          </Button>
        </div>
      </div>
    </Card>
  );
}
