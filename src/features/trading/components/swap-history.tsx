/**
 * Swap History Component
 * Displays paginated list of recent swaps
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSwapHistory } from '@/hooks/use-trading';
import { SwapStatus } from '@/types/database';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface SwapHistoryProps {
  embedded?: boolean;
  className?: string;
}

export function SwapHistory({ embedded = false, className }: SwapHistoryProps) {
  const [page, setPage] = useState(1);
  const limit = embedded ? 5 : 20;
  const { data, isLoading, error } = useSwapHistory(page, limit);

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  const getStatusBadge = (status: SwapStatus) => {
    switch (status) {
      case SwapStatus.CONFIRMED:
        return (
          <Badge
            variant="default"
            className="bg-solana-green/10 text-solana-green border-solana-green/20"
          >
            Confirmed
          </Badge>
        );
      case SwapStatus.PENDING:
      case SwapStatus.SIMULATED:
        return (
          <Badge
            variant="default"
            className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
          >
            Pending
          </Badge>
        );
      case SwapStatus.FAILED:
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getExplorerUrl = (signature: string) => {
    return `https://solscan.io/tx/${signature}?cluster=devnet`;
  };

  const Content = (
    <div className="space-y-4">
      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: embedded ? 3 : 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
          <p className="text-sm text-destructive">
            Failed to load swap history
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && data && data.swaps.length === 0 && (
        <div className="rounded-lg border border-border/50 bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No swap history yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your completed swaps will appear here
          </p>
        </div>
      )}

      {/* Swap List */}
      {!isLoading && !error && data && data.swaps.length > 0 && (
        <>
          <div className="space-y-3">
            {data.swaps.map((swap) => (
              <Card key={swap.id} className="border-border/50 bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    {/* Swap Pair */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-white">
                          {swap.inputMint === 'So11111111111111111111111111111111111111112'
                            ? 'SOL'
                            : swap.inputMint.slice(0, 4)}
                        </span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <span className="font-mono text-sm font-medium text-white">
                          {swap.outputMint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
                            ? 'USDC'
                            : swap.outputMint.slice(0, 4)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(swap.createdAt)}
                      </p>
                    </div>

                    {/* Amounts */}
                    <div className="text-right">
                      <p className="font-mono text-sm text-white">
                        {swap.inputAmount}
                      </p>
                      {swap.outputAmount && (
                        <p className="font-mono text-xs text-solana-green">
                          {swap.outputAmount}
                        </p>
                      )}
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2">
                      {getStatusBadge(swap.status)}
                      {swap.transactionSignature && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a
                            href={getExplorerUrl(swap.transactionSignature)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Error Message */}
                  {swap.status === SwapStatus.FAILED && swap.errorMessage && (
                    <div className="mt-2 rounded bg-destructive/10 px-2 py-1">
                      <p className="text-xs text-destructive/80">
                        {swap.errorMessage}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {!embedded && totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (embedded) {
    return <div className={className}>{Content}</div>;
  }

  return (
    <Card className={cn('border-border/50 bg-card', className)}>
      <CardHeader>
        <CardTitle>Swap History</CardTitle>
      </CardHeader>
      <CardContent>{Content}</CardContent>
    </Card>
  );
}
