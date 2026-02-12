/**
 * Portfolio Page
 * Displays token balances and total portfolio value
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowUpDown,
  Wallet,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { useWalletAuth } from '@/features/wallet/hooks/use-wallet-auth';
import { usePortfolio } from '@/hooks/use-trading';
import { cn } from '@/lib/utils';

type SortMode = 'value' | 'alphabetical';

export default function PortfolioPage() {
  const { user, isAuthenticated } = useWalletAuth();
  const { data: portfolio, isLoading, refetch } = usePortfolio(user?.walletAddress);
  const [sortMode, setSortMode] = useState<SortMode>('value');

  // Sort tokens
  const sortedTokens = portfolio?.tokens
    ? [...portfolio.tokens].sort((a, b) => {
        if (sortMode === 'value') {
          const aValue = a.usdValue ?? 0;
          const bValue = b.usdValue ?? 0;
          return bValue - aValue;
        } else {
          return a.token.symbol.localeCompare(b.token.symbol);
        }
      })
    : [];

  // Wallet disconnected state
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="border-border/50 bg-card p-8 text-center">
          <Wallet className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">
            Connect your wallet to view your portfolio
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Portfolio</h1>
        <p className="mt-2 text-muted-foreground">
          Your token balances and portfolio value
        </p>
      </div>

      {/* Portfolio Summary */}
      <Card className="border-border/50 bg-gradient-to-br from-solana-purple/10 to-solana-green/10">
        <CardContent className="p-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
            {isLoading ? (
              <div className="h-10 w-48 animate-pulse rounded bg-muted" />
            ) : portfolio?.totalUsdValue !== null ? (
              <div className="flex items-baseline gap-2">
                <h2 className="bg-gradient-to-r from-solana-purple to-solana-green bg-clip-text text-4xl font-bold text-transparent">
                  ${portfolio?.totalUsdValue?.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </h2>
                {portfolio?.isStale && (
                  <Badge variant="secondary" className="text-xs">
                    Stale
                  </Badge>
                )}
              </div>
            ) : (
              <p className="text-xl text-muted-foreground">—</p>
            )}
            {portfolio && (
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(portfolio.lastUpdated).toLocaleString()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Token List */}
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Your Tokens</CardTitle>
            <div className="flex gap-2">
              {/* Sort Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSortMode((m) => (m === 'value' ? 'alphabetical' : 'value'))
                }
              >
                <ArrowUpDown className="mr-2 h-4 w-4" />
                {sortMode === 'value' ? 'By Value' : 'A-Z'}
              </Button>

              {/* Refresh */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw
                  className={cn('h-4 w-4', isLoading && 'animate-spin')}
                />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                    <div className="space-y-2">
                      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                  <div className="space-y-2 text-right">
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading &&
            portfolio &&
            (sortedTokens.length === 0 || portfolio.tokens.length === 0) && (
              <div className="rounded-lg border border-border/50 bg-card p-8 text-center">
                <Wallet className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">
                  No tokens found in your wallet
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Get some SOL to start trading
                </p>
              </div>
            )}

          {/* Token List */}
          {!isLoading && sortedTokens.length > 0 && (
            <div className="space-y-3">
              {sortedTokens.map((item) => (
                <div
                  key={item.token.mint}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-card p-4 transition-colors hover:bg-accent/50"
                >
                  {/* Token Info */}
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.token.logoURI}
                      alt={item.token.symbol}
                      className="h-10 w-10 rounded-full"
                    />
                    <div>
                      <p className="font-medium text-white">
                        {item.token.symbol}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.token.name}
                      </p>
                    </div>
                  </div>

                  {/* Balance and Value */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-mono text-sm font-medium text-white">
                        {item.formattedBalance}
                      </p>
                      {item.usdValue !== null && (
                        <p className="font-mono text-xs text-muted-foreground">
                          ${item.usdValue.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      )}
                    </div>

                    {/* Trade Button */}
                    <Link
                      href={`/dashboard/trade?input=${item.token.mint}`}
                    >
                      <Button variant="outline" size="sm">
                        Trade
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
