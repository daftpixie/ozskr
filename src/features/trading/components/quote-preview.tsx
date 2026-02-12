/**
 * Quote Preview Component
 * Displays swap quote details with price impact warning
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, TrendingDown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuotePreview } from '../lib/swap-flow';
import { useEffect, useState } from 'react';

interface QuotePreviewProps {
  quote: QuotePreview;
  className?: string;
}

export function QuotePreviewCard({ quote, className }: QuotePreviewProps) {
  const priceImpactNum = parseFloat(quote.priceImpact);
  const isHighImpact = priceImpactNum > 1;
  const isCriticalImpact = priceImpactNum > 5;

  // Countdown timer for quote expiry
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    const expiryTime = new Date(quote.expiresAt).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiryTime - now) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [quote.expiresAt]);

  return (
    <Card className={cn('border-solana-purple/20 bg-card p-6', className)}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Quote Preview</h3>
          {timeRemaining !== null && timeRemaining > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Expires in {timeRemaining}s</span>
            </div>
          )}
        </div>

        {/* Exchange Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">You pay</span>
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={quote.inputToken.logoURI}
                alt={quote.inputToken.symbol}
                className="h-5 w-5 rounded-full"
              />
              <span className="font-mono text-sm font-medium text-white">
                {quote.inputAmount} {quote.inputToken.symbol}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">You receive</span>
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={quote.outputToken.logoURI}
                alt={quote.outputToken.symbol}
                className="h-5 w-5 rounded-full"
              />
              <span className="font-mono text-sm font-medium text-solana-green">
                {quote.outputAmount} {quote.outputToken.symbol}
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Details */}
        <div className="space-y-3">
          {/* Exchange Rate */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Rate</span>
            <span className="font-mono text-white">
              1 {quote.inputToken.symbol} = {quote.exchangeRate}{' '}
              {quote.outputToken.symbol}
            </span>
          </div>

          {/* Price Impact */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Price Impact</span>
            <div className="flex items-center gap-2">
              {isHighImpact && (
                <TrendingDown
                  className={cn(
                    'h-4 w-4',
                    isCriticalImpact ? 'text-destructive' : 'text-yellow-500'
                  )}
                />
              )}
              <Badge
                variant={
                  isCriticalImpact
                    ? 'destructive'
                    : isHighImpact
                    ? 'default'
                    : 'secondary'
                }
                className={cn(
                  isHighImpact &&
                    !isCriticalImpact &&
                    'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                )}
              >
                {quote.priceImpact}%
              </Badge>
            </div>
          </div>

          {/* Minimum Received */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Minimum Received</span>
            <span className="font-mono text-white">
              {quote.minimumReceived} {quote.outputToken.symbol}
            </span>
          </div>

          {/* Network Fee */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Network Fee</span>
            <span className="font-mono text-white">
              {quote.networkFee.displayAmount} SOL
            </span>
          </div>
        </div>

        {/* High Impact Warning */}
        {isCriticalImpact && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-destructive">
                  High Price Impact
                </p>
                <p className="text-xs text-destructive/80">
                  This trade will have a significant impact on the market price
                  (&gt;5%). Consider reducing the trade size or waiting for better
                  liquidity.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quote Expired Warning */}
        {timeRemaining === 0 && (
          <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-500">
                  Quote Expired
                </p>
                <p className="text-xs text-yellow-500/80">
                  Please request a new quote to continue.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
