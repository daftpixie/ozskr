'use client';

/**
 * Price Summary Card
 *
 * Displays the full cost breakdown for the selected content category and
 * model configuration, the agent's current USDC balance, and a warning
 * when the balance is insufficient.
 */

import { AlertCircle, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PriceQuote } from '@/lib/pricing/pricing-calculator';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PriceSummaryProps {
  quote: PriceQuote | undefined;
  isLoading: boolean;
  agentBalance: number | null;
  characterId: string;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function usd(value: number): string {
  return value.toFixed(4);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PriceSummary({
  quote,
  isLoading,
  agentBalance,
}: PriceSummaryProps) {
  const totalCost = quote?.platformCostUsd ?? 0;
  const baseCost = quote?.baseCostUsd ?? 0;
  const markupCost = totalCost - baseCost;
  const remainingAfter = agentBalance !== null ? agentBalance - totalCost : null;
  const isInsufficient =
    agentBalance !== null && quote !== undefined && agentBalance < totalCost;

  return (
    <Card
      className={cn(
        'border p-4',
        isInsufficient
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-[#27272A] bg-[#18181B]'
      )}
    >
      <div className="space-y-3">
        {/* Header */}
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Cost Breakdown
        </p>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <>
            {/* Breakdown rows */}
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Provider cost</span>
                <span className="font-mono">${usd(baseCost)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Platform fee (20%)</span>
                <span className="font-mono">${usd(markupCost)}</span>
              </div>
              <div className="my-1 border-t border-[#27272A]" />
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-mono text-[#F59E0B] font-bold">
                  ${usd(totalCost)} USDC
                </span>
              </div>
            </div>

            {/* Breakdown detail line */}
            {quote?.breakdown && (
              <p className="text-[10px] leading-tight text-muted-foreground">
                {quote.breakdown}
              </p>
            )}

            {/* Agent wallet balance */}
            {agentBalance !== null && (
              <>
                <div className="border-t border-[#27272A]" />
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Wallet className="h-3.5 w-3.5" />
                      <span>Agent balance</span>
                    </div>
                    <span className="font-mono">{agentBalance.toFixed(4)} USDC</span>
                  </div>
                  {remainingAfter !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Remaining after</span>
                      <span
                        className={cn(
                          'font-mono',
                          remainingAfter < 0 ? 'text-destructive' : 'text-foreground'
                        )}
                      >
                        {remainingAfter.toFixed(4)} USDC
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Insufficient balance warning */}
            {isInsufficient && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-xs text-destructive">
                  Insufficient agent wallet balance. Please delegate more USDC from
                  the Delegation panel.
                </p>
              </div>
            )}

            {/* No balance info */}
            {agentBalance === null && (
              <p className="text-xs text-muted-foreground">
                No active delegation found. Delegate USDC to this agent to enable
                on-chain payments.
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
