'use client';

/**
 * ContentLibrary
 * Full paginated content library for an agent's generated content.
 * Features type filters, skeleton loading, empty state, and publish flow.
 */

import { useState } from 'react';
import { Bot, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useCharacterGenerations } from '@/hooks/use-generations';
import { GenerationType } from '@/types/database';
import { ContentCard } from './content-card';
import { ContentDetailModal } from './content-detail-modal';
import { PublishModal } from './publish-modal';
import type { ContentGenerationResponse } from '@/types/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentLibraryProps {
  characterId: string;
  characterName: string;
}

type TypeFilter = 'all' | GenerationType;

// ---------------------------------------------------------------------------
// Skeleton grid
// ---------------------------------------------------------------------------

function LibrarySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-[#18181B] p-3">
          <Skeleton className="aspect-square w-full rounded-md" />
          <div className="flex gap-1">
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-5 w-12 rounded" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="h-7 flex-1 rounded" />
            <Skeleton className="h-7 flex-1 rounded" />
            <Skeleton className="h-7 flex-1 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter button
// ---------------------------------------------------------------------------

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-1 text-sm font-medium transition-colors',
        active
          ? 'bg-solana-purple text-white'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ContentLibrary
// ---------------------------------------------------------------------------

export function ContentLibrary({ characterId, characterName }: ContentLibraryProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [page, setPage] = useState(1);
  const [detailTarget, setDetailTarget] = useState<ContentGenerationResponse | null>(null);
  const [publishTarget, setPublishTarget] = useState<ContentGenerationResponse | null>(null);

  const { data, isLoading, isFetching } = useCharacterGenerations(characterId, {
    page,
    limit: 20,
    type: typeFilter === 'all' ? undefined : typeFilter,
  });

  const generations = data?.data ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;

  // Reset to page 1 when filter changes
  const handleFilterChange = (filter: TypeFilter) => {
    setTypeFilter(filter);
    setPage(1);
  };

  return (
    <section aria-label={`${characterName} content library`} className="space-y-4">
      {/* Section header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Content Library</h2>
          {pagination && (
            <p className="text-sm text-muted-foreground">
              {pagination.total} {pagination.total === 1 ? 'creation' : 'creations'}
            </p>
          )}
        </div>

        {/* Type filters */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-[#18181B] p-1">
          <FilterButton
            active={typeFilter === 'all'}
            onClick={() => handleFilterChange('all')}
          >
            All
          </FilterButton>
          <FilterButton
            active={typeFilter === GenerationType.TEXT}
            onClick={() => handleFilterChange(GenerationType.TEXT)}
          >
            Text
          </FilterButton>
          <FilterButton
            active={typeFilter === GenerationType.IMAGE}
            onClick={() => handleFilterChange(GenerationType.IMAGE)}
          >
            Image
          </FilterButton>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && <LibrarySkeleton />}

      {/* Empty state */}
      {!isLoading && generations.length === 0 && (
        <div
          className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center"
          aria-live="polite"
        >
          <Bot className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">
            No creations yet. Hit &lsquo;Create Something New&rsquo; to start.
          </p>
        </div>
      )}

      {/* Content grid */}
      {!isLoading && generations.length > 0 && (
        <div
          className={cn(
            'grid gap-4 sm:grid-cols-2 xl:grid-cols-3',
            isFetching && 'opacity-60 transition-opacity'
          )}
          aria-live="polite"
          aria-busy={isFetching}
        >
          {generations.map((gen) => (
            <ContentCard
              key={gen.id}
              generation={gen}
              onClick={(g) => setDetailTarget(g)}
              onPublish={(g) => setPublishTarget(g)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isFetching}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isFetching}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Detail modal */}
      <ContentDetailModal
        generation={detailTarget}
        open={detailTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null);
        }}
      />

      {/* Publish modal (triggered from card) */}
      {publishTarget && (
        <PublishModal
          open={publishTarget !== null}
          onOpenChange={(open) => {
            if (!open) setPublishTarget(null);
          }}
          contentGenerationId={publishTarget.id}
          outputText={publishTarget.outputText}
          outputUrl={publishTarget.outputUrl}
        />
      )}
    </section>
  );
}
