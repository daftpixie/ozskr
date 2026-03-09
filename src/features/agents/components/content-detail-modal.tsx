'use client';

/**
 * ContentDetailModal
 * Full-detail view for a single generation — text, image, metadata,
 * and publish action.
 */

import { useState } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Share2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils/time';
import { PublishModal } from './publish-modal';
import type { ContentGenerationResponse } from '@/types/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentDetailModalProps {
  generation: ContentGenerationResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1 break-words text-foreground">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContentDetailModal
// ---------------------------------------------------------------------------

export function ContentDetailModal({
  generation,
  open,
  onOpenChange,
}: ContentDetailModalProps) {
  const [publishOpen, setPublishOpen] = useState(false);
  const [enhancedPromptExpanded, setEnhancedPromptExpanded] = useState(false);

  if (!generation) return null;

  const isImage =
    generation.generationType === 'image' ||
    generation.generationType === 'video';

  const handleClose = () => {
    onOpenChange(false);
    setEnhancedPromptExpanded(false);
  };

  const moderationStatusColors: Record<string, string> = {
    approved: 'bg-solana-green/20 text-solana-green border-solana-green/30',
    flagged: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    rejected: 'bg-destructive/20 text-destructive border-destructive/30',
    pending: 'bg-muted text-muted-foreground',
    processing: 'bg-muted text-muted-foreground',
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generation Detail</DialogTitle>
            <DialogDescription>
              {generation.generationType} &middot; {formatDate(generation.createdAt)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Image output */}
            {isImage && generation.outputUrl && (
              <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                <Image
                  src={generation.outputUrl}
                  alt="Generated image"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 640px"
                />
              </div>
            )}

            {/* Text output */}
            {!isImage && generation.outputText && (
              <div className="rounded-lg border border-border bg-[#18181B] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    Output
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => copyToClipboard(generation.outputText!)}
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                </div>
                <p
                  className="whitespace-pre-wrap text-sm leading-relaxed"
                  aria-live="polite"
                >
                  {generation.outputText}
                </p>
              </div>
            )}

            {/* Metadata */}
            <div className="rounded-lg border border-border bg-[#18181B] p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Metadata
              </h3>
              <div className="space-y-2">
                <MetaRow label="Type" value={generation.generationType} />
                <MetaRow label="Model" value={generation.modelUsed} />
                <MetaRow
                  label="Quality Score"
                  value={
                    generation.qualityScore !== null ? (
                      <span className="text-[#10B981]">
                        {generation.qualityScore.toFixed(2)} ✦
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )
                  }
                />
                <MetaRow
                  label="Moderation"
                  value={
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs capitalize',
                        moderationStatusColors[generation.moderationStatus] ??
                          'bg-muted text-muted-foreground'
                      )}
                    >
                      {generation.moderationStatus}
                    </Badge>
                  }
                />
                <MetaRow
                  label="Cost"
                  value={
                    generation.costUsd ? (
                      `$${generation.costUsd}`
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )
                  }
                />
                <MetaRow
                  label="Latency"
                  value={
                    generation.latencyMs !== null ? (
                      `${generation.latencyMs.toLocaleString()} ms`
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )
                  }
                />
                <MetaRow
                  label="Cache Hit"
                  value={generation.cacheHit ? 'Yes' : 'No'}
                />
              </div>
            </div>

            {/* Enhanced prompt (collapsible) */}
            {generation.enhancedPrompt && (
              <div className="rounded-lg border border-border bg-[#18181B]">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                  onClick={() => setEnhancedPromptExpanded((v) => !v)}
                  aria-expanded={enhancedPromptExpanded}
                >
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Enhanced Prompt
                  </span>
                  {enhancedPromptExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {enhancedPromptExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3">
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {generation.enhancedPrompt}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {isImage && generation.outputUrl ? (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => copyToClipboard(generation.outputUrl!)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy URL
                </Button>
              ) : generation.outputText ? (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => copyToClipboard(generation.outputText!)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Text
                </Button>
              ) : null}

              <Button
                className="flex-1 bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90"
                onClick={() => setPublishOpen(true)}
                disabled={generation.moderationStatus === 'rejected'}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Publish
              </Button>

              <Button variant="ghost" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PublishModal
        open={publishOpen}
        onOpenChange={setPublishOpen}
        contentGenerationId={generation.id}
        outputText={generation.outputText}
        outputUrl={generation.outputUrl}
      />
    </>
  );
}
