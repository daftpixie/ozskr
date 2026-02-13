'use client';

/**
 * Access Gate Component
 * Wraps protected features, showing upgrade prompt when user's tier is insufficient.
 */

import { type ReactNode } from 'react';
import { AccessTier, meetsMinimumTier, getTierLabel, TIER_THRESHOLDS } from '@/lib/auth/access-tier';
import { formatHopeAmount } from '@/lib/solana/hope-token';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

interface AccessGateProps {
  /** Minimum tier required to see the children */
  requiredTier: AccessTier;
  /** Current user's access tier */
  currentTier: AccessTier;
  /** Content to show when tier is sufficient */
  children: ReactNode;
  /** Optional loading state */
  isLoading?: boolean;
}

export function AccessGate({ requiredTier, currentTier, children, isLoading }: AccessGateProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-solana-purple border-t-transparent" />
        <span className="ml-3 text-sm text-muted-foreground">Verifying access...</span>
      </div>
    );
  }

  if (meetsMinimumTier(currentTier, requiredTier)) {
    return <>{children}</>;
  }

  const requiredAmount = TIER_THRESHOLDS[requiredTier];

  return (
    <Card className="mx-auto max-w-md border-white/5 bg-white/[0.02]">
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-solana-purple/10">
          <Lock className="h-6 w-6 text-solana-purple" />
        </div>
        <h3 className="font-display text-lg font-semibold text-white">
          {getTierLabel(requiredTier)} Required
        </h3>
        <p className="text-sm text-muted-foreground">
          This feature requires {getTierLabel(requiredTier)} access.
          Hold at least {formatHopeAmount(requiredAmount)} to unlock.
        </p>
        <p className="text-xs text-muted-foreground">
          Your current tier: <span className="font-medium text-white">{getTierLabel(currentTier)}</span>
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="border border-white/10 text-sm text-muted-foreground hover:text-white"
          onClick={() => window.open('https://jup.ag/swap/SOL-HOPE', '_blank')}
        >
          Get $HOPE on Jupiter
        </Button>
      </CardContent>
    </Card>
  );
}
