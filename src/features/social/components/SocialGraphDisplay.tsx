'use client';

/**
 * SocialGraphDisplay
 * Shows followers and following for a character in a two-column layout.
 * Collapses to a tabbed single-column on mobile.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTapestryFollowers, useTapestryFollowing } from '../hooks/useTapestryGraph';
import type { TapestryGraphProfile } from '../hooks/useTapestryGraph';
import { UserRound, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SocialGraphDisplayProps {
  characterId: string;
}

function ProfilePill({ profile }: { profile: TapestryGraphProfile }) {
  const initials = profile.username
    .replace(/^ozskr_/, '')
    .split('_')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';

  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] text-xs font-bold text-white">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-50">@{profile.username}</p>
        {profile.bio && (
          <p className="truncate text-xs text-zinc-400">{profile.bio}</p>
        )}
      </div>
    </div>
  );
}

function GraphSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
          <Skeleton className="h-8 w-8 rounded-full bg-zinc-800" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24 bg-zinc-800" />
            <Skeleton className="h-3 w-32 bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyGraph({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <Users className="h-6 w-6 text-zinc-600" />
      <p className="text-xs text-zinc-500">No {label} yet</p>
    </div>
  );
}

type GraphTab = 'following' | 'followers';

export function SocialGraphDisplay({ characterId }: SocialGraphDisplayProps) {
  const [mobileTab, setMobileTab] = useState<GraphTab>('following');

  const { data: followersData, isLoading: followersLoading } = useTapestryFollowers(characterId);
  const { data: followingData, isLoading: followingLoading } = useTapestryFollowing(characterId);

  const followers = followersData?.profiles ?? [];
  const following = followingData?.profiles ?? [];

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-zinc-50">
          <UserRound className="h-4 w-4" />
          Agent Network
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Mobile tab switcher */}
        <div className="mb-4 flex rounded-lg border border-zinc-800 bg-zinc-950 p-1 md:hidden">
          {(['following', 'followers'] as GraphTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={cn(
                'flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition-colors',
                mobileTab === tab
                  ? 'bg-zinc-800 text-zinc-50'
                  : 'text-zinc-400 hover:text-zinc-50'
              )}
            >
              {tab} ({tab === 'followers' ? followers.length : following.length})
            </button>
          ))}
        </div>

        {/* Desktop: two-column; Mobile: single column based on tab */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Following column */}
          <div className={cn(mobileTab !== 'following' && 'hidden md:block')}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Following ({following.length})
            </p>
            {followingLoading ? (
              <GraphSkeleton />
            ) : following.length === 0 ? (
              <EmptyGraph label="connections" />
            ) : (
              <div className="space-y-2">
                {following.map((p) => (
                  <ProfilePill key={p.id} profile={p} />
                ))}
              </div>
            )}
          </div>

          {/* Followers column */}
          <div className={cn(mobileTab !== 'followers' && 'hidden md:block')}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Followers ({followers.length})
            </p>
            {followersLoading ? (
              <GraphSkeleton />
            ) : followers.length === 0 ? (
              <EmptyGraph label="followers" />
            ) : (
              <div className="space-y-2">
                {followers.map((p) => (
                  <ProfilePill key={p.id} profile={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
