'use client';

/**
 * Stats Bar Component
 * Compact stats bar for dashboard home page showing points, tier, and streak
 */

import { Card, CardContent } from '@/components/ui/card';
import { TierBadge } from './tier-badge';
import { useUserStats } from '@/hooks/use-gamification';
import { Skeleton } from '@/components/ui/skeleton';

export function StatsBar() {
  const { data: stats, isLoading } = useUserStats();

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-28" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-6">
          {/* Total Points */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Total Points:</span>
            <span className="text-lg font-bold font-display text-white">
              {stats.totalPoints.toLocaleString()}
            </span>
            <TierBadge
              tier={stats.tier}
              tierProgress={stats.tierProgress}
              size="sm"
            />
          </div>

          {/* Current Streak */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Streak:</span>
            <span className="text-lg font-bold font-display text-brick-gold">
              🔥 {stats.currentStreakDays}
            </span>
            <span className="text-sm text-muted-foreground">
              {stats.currentStreakDays === 1 ? 'day' : 'days'}
            </span>
          </div>

          {/* Longest Streak */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Best Streak:</span>
            <span className="text-lg font-bold font-display text-solana-green">
              {stats.longestStreakDays}
            </span>
            <span className="text-sm text-muted-foreground">
              {stats.longestStreakDays === 1 ? 'day' : 'days'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
