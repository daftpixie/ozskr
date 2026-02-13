'use client';

/**
 * Leaderboard Page
 * Display ranked users by period with current user position
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { TierBadge } from '@/features/gamification/components/tier-badge';
import { useLeaderboard, useLeaderboardPosition } from '@/hooks/use-gamification';
import { LeaderboardPeriod } from '@/types/database';
import type { LeaderboardEntryResponse } from '@/types/gamification';
import { cn } from '@/lib/utils';
import { Crown, User } from 'lucide-react';

const periodLabels: Record<LeaderboardPeriod, string> = {
  [LeaderboardPeriod.DAILY]: 'Daily',
  [LeaderboardPeriod.WEEKLY]: 'Weekly',
  [LeaderboardPeriod.MONTHLY]: 'Monthly',
  [LeaderboardPeriod.ALL_TIME]: 'All Time',
};

const rankEmojis: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

function LeaderboardEntry({
  entry,
  isCurrentUser = false,
  showTopGradient = false,
}: {
  entry: LeaderboardEntryResponse;
  isCurrentUser?: boolean;
  showTopGradient?: boolean;
}) {
  const displayName = entry.displayName || `${entry.walletAddress.slice(0, 4)}...${entry.walletAddress.slice(-4)}`;

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border p-4 transition-colors',
        isCurrentUser
          ? 'border-solana-purple bg-solana-purple/10'
          : 'border-border bg-card',
        showTopGradient && 'bg-gradient-to-r from-solana-purple/5 to-solana-green/5'
      )}
    >
      <div className="flex items-center gap-4">
        {/* Rank */}
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold',
            showTopGradient
              ? 'bg-gradient-to-br from-solana-purple to-solana-green text-white'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {rankEmojis[entry.rank] || `#${entry.rank}`}
        </div>

        {/* User Info */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-solana-purple/10">
            <User className="h-4 w-4 text-solana-purple" />
          </div>
          <div>
            <p className="font-medium text-white">{displayName}</p>
            <div className="mt-1">
              <TierBadge tier={entry.tier} size="sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Points */}
      <div className="text-right">
        <p className="text-lg font-bold text-white">
          {entry.totalPoints.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">points</p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<LeaderboardPeriod>(LeaderboardPeriod.ALL_TIME);
  const { data: leaderboard, isLoading } = useLeaderboard(period);
  const { data: position } = useLeaderboardPosition();

  const top3 = leaderboard?.entries.slice(0, 3) || [];
  const rest = leaderboard?.entries.slice(3) || [];

  // Check if current user is in top 100
  const currentUserInTop100 = leaderboard?.entries.some(
    (e) => e.walletAddress === position?.currentUser.walletAddress
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-white">
            <Crown className="h-8 w-8 text-brick-gold" />
            Leaderboard
          </h1>
          <p className="mt-2 text-muted-foreground">
            See who rules the Emerald City
          </p>
        </div>
      </div>

      {/* Period Selector */}
      <Tabs value={period} onValueChange={(v: string) => setPeriod(v as LeaderboardPeriod)}>
        <TabsList>
          {Object.entries(periodLabels).map(([key, label]) => (
            <TabsTrigger key={key} value={key}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Content */}
        <TabsContent value={period} className="mt-6 space-y-6">
          {isLoading ? (
            <LoadingSkeleton />
          ) : !leaderboard || leaderboard.entries.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Crown className="h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-center text-muted-foreground">
                  No leaderboard data available yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Top 3 */}
              {top3.length > 0 && (
                <div className="grid gap-4 md:grid-cols-3">
                  {top3.map((entry) => (
                    <Card
                      key={entry.walletAddress}
                      className="border-border bg-gradient-to-br from-solana-purple/10 to-solana-green/10"
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center justify-center text-4xl">
                          {rankEmojis[entry.rank]}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-center">
                        <div>
                          <p className="font-semibold text-white">
                            {entry.displayName ||
                              `${entry.walletAddress.slice(0, 4)}...${entry.walletAddress.slice(-4)}`}
                          </p>
                          <div className="mt-2 flex justify-center">
                            <TierBadge tier={entry.tier} size="sm" />
                          </div>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-white">
                            {entry.totalPoints.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">points</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Rest of leaderboard */}
              {rest.length > 0 && (
                <Card className="border-border bg-card">
                  <CardContent className="space-y-3 p-6">
                    {rest.map((entry) => (
                      <LeaderboardEntry
                        key={entry.walletAddress}
                        entry={entry}
                        isCurrentUser={entry.walletAddress === position?.currentUser.walletAddress}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Current User Position (if outside top 100) */}
              {position && !currentUserInTop100 && (
                <Card className="border-solana-purple bg-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Your Rank</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Users above */}
                    {position.above.map((entry) => (
                      <LeaderboardEntry key={entry.walletAddress} entry={entry} />
                    ))}

                    {/* Current user */}
                    <LeaderboardEntry entry={position.currentUser} isCurrentUser />

                    {/* Users below */}
                    {position.below.map((entry) => (
                      <LeaderboardEntry key={entry.walletAddress} entry={entry} />
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Cache info */}
          {leaderboard && (
            <p className="text-center text-xs text-muted-foreground">
              Last updated: {new Date(leaderboard.cachedAt).toLocaleString()}
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
