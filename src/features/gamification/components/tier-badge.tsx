'use client';

/**
 * Tier Badge Component
 * Visual badge for user tier with tooltip showing progress to next tier
 */

import { UserTier } from '@/types/database';
import type { TierProgress } from '@/types/gamification';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TierBadgeProps {
  tier: UserTier;
  tierProgress?: TierProgress;
  size?: 'sm' | 'md' | 'lg';
}

const tierStyles: Record<UserTier, { bg: string; text: string; border: string }> = {
  [UserTier.NEWCOMER]: {
    bg: 'bg-gray-500/20',
    text: 'text-gray-400',
    border: 'border-gray-500/30',
  },
  [UserTier.CREATOR]: {
    bg: 'bg-solana-purple/20',
    text: 'text-solana-purple',
    border: 'border-solana-purple/30',
  },
  [UserTier.INFLUENCER]: {
    bg: 'bg-solana-green/20',
    text: 'text-solana-green',
    border: 'border-solana-green/30',
  },
  [UserTier.MOGUL]: {
    bg: 'bg-brick-gold/20',
    text: 'text-brick-gold',
    border: 'border-brick-gold/30',
  },
  [UserTier.LEGEND]: {
    bg: 'bg-gradient-to-r from-solana-purple/20 to-solana-green/20',
    text: 'bg-gradient-to-r from-solana-purple to-solana-green bg-clip-text text-transparent',
    border: 'border-solana-purple/30',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
};

export function TierBadge({ tier, tierProgress, size = 'md' }: TierBadgeProps) {
  const styles = tierStyles[tier];
  const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);

  const badgeContent = (
    <Badge
      className={cn(
        'inline-flex items-center rounded-md border font-semibold transition-colors',
        styles.bg,
        styles.text,
        styles.border,
        sizeClasses[size],
        // Add animation for LEGEND tier
        tier === UserTier.LEGEND && 'animate-pulse'
      )}
    >
      {tierName}
    </Badge>
  );

  if (!tierProgress || !tierProgress.nextTier) {
    // No tooltip for max tier or missing progress
    return badgeContent;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-semibold">
              {tierProgress.pointsToNextTier.toLocaleString()} points to{' '}
              {tierProgress.nextTier.charAt(0).toUpperCase() + tierProgress.nextTier.slice(1)}
            </p>
            <p className="text-xs text-muted-foreground">
              {tierProgress.progress}% progress
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
