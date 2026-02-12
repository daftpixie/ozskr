'use client';

/**
 * $HOPE Balance Display Component
 * Shows $HOPE token balance with gradient styling and USD equivalent
 */

import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import Link from 'next/link';
import { getHopeBalance, formatHopeAmount } from '@/lib/solana/hope-token';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function HopeBalance() {
  const { publicKey, connected } = useWallet();

  // Fetch $HOPE balance using React Query
  const {
    data: balance,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['hope-balance', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return 0;
      return getHopeBalance(publicKey.toBase58());
    },
    enabled: connected && !!publicKey,
    staleTime: 30_000, // 30 seconds — balances update frequently
    refetchInterval: 30_000, // Auto-refresh every 30 seconds
  });

  /**
   * State 1: Wallet disconnected
   */
  if (!connected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0A0A0B] border border-[#9945FF]/20">
        <span className="text-sm text-gray-400">Connect wallet to view $HOPE</span>
      </div>
    );
  }

  /**
   * State 2: Loading
   */
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0A0A0B] border border-[#9945FF]/20">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#9945FF] border-t-transparent" />
        <span className="text-sm text-gray-400">Loading...</span>
      </div>
    );
  }

  /**
   * State 3: Error
   */
  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0A0A0B] border border-red-500/20">
        <span className="text-sm text-red-400">Failed to load $HOPE</span>
      </div>
    );
  }

  /**
   * State 4: Zero balance — Show "Get $HOPE" CTA
   */
  if (balance === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/dashboard/trade?output=HOPE">
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'border-[#F59E0B]/30 text-[#F59E0B]',
                  'hover:border-[#F59E0B] hover:bg-[#F59E0B]/10',
                  'transition-all duration-200'
                )}
              >
                Get $HOPE
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">Trade to get $HOPE tokens</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  /**
   * State 5: Has balance — Show with gradient styling
   */
  const displayBalance = balance ?? 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0A0A0B] border border-[#F59E0B]/20">
            {/* $HOPE icon (gradient circle) */}
            <div className="h-5 w-5 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195]" />

            {/* Balance with gradient text */}
            <span
              className={cn(
                'text-sm font-medium',
                'bg-gradient-to-r from-[#9945FF] to-[#14F195]',
                'bg-clip-text text-transparent'
              )}
            >
              {formatHopeAmount(displayBalance)}
            </span>

            {/* Link to trade page */}
            <Link href="/dashboard/trade?output=HOPE">
              <button
                className={cn(
                  'text-xs text-[#F59E0B] hover:text-[#F59E0B]/80',
                  'transition-colors duration-150'
                )}
                aria-label="Get more $HOPE"
              >
                +
              </button>
            </Link>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="space-y-1">
            <p className="text-xs font-medium">{formatHopeAmount(displayBalance)}</p>
            <p className="text-xs text-gray-400">USD equivalent: $0.00</p>
            <p className="text-xs text-gray-500">
              (Price feed coming soon)
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
