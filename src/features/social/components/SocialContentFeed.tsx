'use client';

/**
 * SocialContentFeed
 * Displays the Tapestry content feed for a character — each published post
 * mirrored to the on-chain social graph.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTapestryFeed } from '../hooks/useTapestryFeed';
import { FileText, Twitter } from 'lucide-react';

interface SocialContentFeedProps {
  characterId: string;
}

function formatRelativeTime(createdAt: number | undefined): string {
  if (!createdAt) return '';
  const now = Date.now();
  // createdAt may be in seconds or ms
  const ts = createdAt > 1e12 ? createdAt : createdAt * 1000;
  const diffMs = now - ts;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

function PlatformBadge({ platform }: { platform?: string }) {
  if (platform === 'twitter' || platform === 'x') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[#1DA1F2]">
        <Twitter className="h-3 w-3" />
        Twitter/X
      </span>
    );
  }
  return (
    <span className="text-xs text-zinc-500">
      {platform ?? 'Tapestry'}
    </span>
  );
}

function ContentSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <Skeleton className="mb-2 h-4 w-full bg-zinc-800" />
          <Skeleton className="h-4 w-2/3 bg-zinc-800" />
          <div className="mt-3 flex gap-3">
            <Skeleton className="h-3 w-16 bg-zinc-800" />
            <Skeleton className="h-3 w-20 bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SocialContentFeed({ characterId }: SocialContentFeedProps) {
  const [page, setPage] = useState(1);
  const { data: feed, isLoading, isError } = useTapestryFeed(characterId, page);

  if (isLoading) {
    return (
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-base text-zinc-50">Content Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <ContentSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-zinc-800 bg-zinc-900">
        <CardContent className="py-6">
          <p className="text-sm text-red-400">Failed to load content feed. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  const contents = feed?.contents ?? [];

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <CardTitle className="text-base text-zinc-50">Content Feed</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {contents.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <FileText className="h-8 w-8 text-zinc-600" />
            <p className="text-sm text-zinc-400">No content published yet. Start creating!</p>
          </div>
        ) : (
          <>
            {contents.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
              >
                <p className="text-sm text-zinc-300">
                  {item.contentText ?? `Content #${item.id.slice(0, 8)}`}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <PlatformBadge platform={item.platform} />
                  {item.created_at && (
                    <span className="text-xs text-zinc-500">
                      {formatRelativeTime(item.created_at)}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {contents.length >= (feed?.limit ?? 20) && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-zinc-400 hover:text-zinc-50"
                onClick={() => setPage((p) => p + 1)}
              >
                Load more
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
