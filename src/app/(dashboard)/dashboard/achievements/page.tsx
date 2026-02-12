'use client';

/**
 * Achievements Page
 * Display all achievements with filtering by category
 */

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAchievements } from '@/hooks/use-gamification';
import { AchievementCategory } from '@/types/database';
import type { UnlockedAchievementResponse, LockedAchievementResponse } from '@/types/gamification';
import { cn } from '@/lib/utils';
import { CheckCircle } from 'lucide-react';

type FilterCategory = 'all' | AchievementCategory;

const categoryLabels: Record<FilterCategory, string> = {
  all: 'All',
  [AchievementCategory.CREATION]: 'Creation',
  [AchievementCategory.PUBLISHING]: 'Publishing',
  [AchievementCategory.ENGAGEMENT]: 'Engagement',
  [AchievementCategory.STREAK]: 'Streak',
};

function isRecentlyUnlocked(unlockedAt: string): boolean {
  const unlockTime = new Date(unlockedAt).getTime();
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  return now - unlockTime < dayInMs;
}

function AchievementCard({
  achievement,
  unlocked,
}: {
  achievement: UnlockedAchievementResponse | LockedAchievementResponse;
  unlocked: boolean;
}) {
  const isRecent = unlocked && isRecentlyUnlocked((achievement as UnlockedAchievementResponse).unlockedAt);

  return (
    <Card
      className={cn(
        'border-border bg-card transition-all',
        unlocked ? 'opacity-100' : 'opacity-50',
        isRecent && 'shadow-[0_0_20px_rgba(245,158,11,0.4)] border-brick-gold/50'
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl',
              unlocked
                ? 'bg-solana-purple/20'
                : 'bg-gray-500/10'
            )}
          >
            {achievement.icon}
          </div>

          {/* Content */}
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {achievement.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {achievement.description}
                </p>
              </div>
              {unlocked && (
                <CheckCircle className="h-5 w-5 shrink-0 text-solana-green" />
              )}
            </div>

            {/* Progress (locked only) */}
            {!unlocked && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {(achievement as LockedAchievementResponse).currentValue} /{' '}
                    {achievement.requirementValue}
                  </span>
                  <span className="font-semibold text-white">
                    {(achievement as LockedAchievementResponse).progress}%
                  </span>
                </div>
                <Progress value={(achievement as LockedAchievementResponse).progress} />
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between">
              <Badge
                variant="outline"
                className="border-solana-purple/30 bg-solana-purple/10 text-solana-purple"
              >
                {categoryLabels[achievement.category]}
              </Badge>
              <span className="text-sm font-semibold text-brick-gold">
                +{achievement.pointsReward} points
              </span>
            </div>

            {/* Unlock date (unlocked only) */}
            {unlocked && (
              <p className="text-xs text-muted-foreground">
                Unlocked {new Date((achievement as UnlockedAchievementResponse).unlockedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function AchievementsPage() {
  const { data, isLoading } = useAchievements();
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');

  const filteredAchievements = useMemo(() => {
    if (!data) return { unlocked: [], locked: [] };

    if (activeCategory === 'all') {
      return data;
    }

    return {
      unlocked: data.unlocked.filter((a) => a.category === activeCategory),
      locked: data.locked.filter((a) => a.category === activeCategory),
    };
  }, [data, activeCategory]);

  const totalAchievements = data
    ? data.unlocked.length + data.locked.length
    : 0;
  const unlockedCount = data?.unlocked.length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Achievements</h1>
        <p className="mt-2 text-muted-foreground">
          {isLoading
            ? 'Loading achievements...'
            : `${unlockedCount} of ${totalAchievements} unlocked`}
        </p>
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as FilterCategory)}>
        <TabsList className="w-full justify-start">
          {Object.entries(categoryLabels).map(([key, label]) => (
            <TabsTrigger key={key} value={key}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Content */}
        <TabsContent value={activeCategory} className="mt-6">
          {isLoading ? (
            <LoadingSkeleton />
          ) : filteredAchievements.unlocked.length === 0 && filteredAchievements.locked.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-center text-muted-foreground">
                  No achievements in this category yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Unlocked achievements first */}
              {filteredAchievements.unlocked
                .sort((a, b) => {
                  // Recently unlocked first
                  const aRecent = isRecentlyUnlocked(a.unlockedAt);
                  const bRecent = isRecentlyUnlocked(b.unlockedAt);
                  if (aRecent && !bRecent) return -1;
                  if (!aRecent && bRecent) return 1;
                  // Then by unlock date (newest first)
                  return new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime();
                })
                .map((achievement) => (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    unlocked
                  />
                ))}

              {/* Locked achievements */}
              {filteredAchievements.locked
                .sort((a, b) => b.progress - a.progress) // Highest progress first
                .map((achievement) => (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    unlocked={false}
                  />
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
