'use client';

/**
 * Trading Page
 * Jupiter swap interface for token trading on Solana.
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, TrendingUp, History } from 'lucide-react';
import { useYellowBrickStore } from '@/components/features/yellow-brick';
import { SwapHistory } from '@/features/trading/components/swap-history';
import { SwapConfirmModal } from '@/features/trading/components/swap-confirm-modal';
import { QuotePreviewCard } from '@/features/trading/components/quote-preview';
import { useSwapQuote } from '@/hooks/use-trading';
import { useWalletAuth } from '@/features/wallet/hooks/use-wallet-auth';
import { cn } from '@/lib/utils';
import type { QuotePreview } from '@/features/trading/lib/swap-flow';

// Mainnet token mints
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const DEFAULT_SLIPPAGE_BPS = 50;
const DEFAULT_PRIORITY_FEE = '5000';

interface SwapFormState {
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  inputSymbol: string;
  outputSymbol: string;
}

function SwapForm({
  onQuoteReady,
}: {
  onQuoteReady: (quote: QuotePreview, state: SwapFormState) => void;
}) {
  const [form, setForm] = useState<SwapFormState>({
    inputMint: SOL_MINT,
    outputMint: USDC_MINT,
    inputAmount: '',
    inputSymbol: 'SOL',
    outputSymbol: 'USDC',
  });

  const quoteParams =
    form.inputAmount && parseFloat(form.inputAmount) > 0
      ? {
          inputMint: form.inputMint,
          outputMint: form.outputMint,
          amount: Math.round(parseFloat(form.inputAmount) * 1e9).toString(),
          slippageBps: DEFAULT_SLIPPAGE_BPS,
        }
      : null;

  const { data: quote, isLoading: quoteLoading, error: quoteError } = useSwapQuote(quoteParams);

  const handleFlip = useCallback(() => {
    setForm((prev) => ({
      inputMint: prev.outputMint,
      outputMint: prev.inputMint,
      inputAmount: '',
      inputSymbol: prev.outputSymbol,
      outputSymbol: prev.inputSymbol,
    }));
  }, []);

  const handleReview = useCallback(() => {
    if (quote) {
      onQuoteReady(quote, form);
    }
  }, [quote, form, onQuoteReady]);

  return (
    <Card className="border-[#27272A] bg-[#18181B]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-white">
          <ArrowUpDown className="h-5 w-5 text-[#9945FF]" />
          Swap Tokens
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* From */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#71717A]">From</label>
          <div className="flex items-center gap-3 rounded-lg border border-[#27272A] bg-[#0A0A0B] px-4 py-3">
            <Badge className="shrink-0 bg-[#9945FF]/10 text-[#9945FF] border-[#9945FF]/20">
              {form.inputSymbol}
            </Badge>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              value={form.inputAmount}
              onChange={(e) => setForm((prev) => ({ ...prev, inputAmount: e.target.value }))}
              className="flex-1 bg-transparent text-right text-lg font-medium text-white outline-none placeholder:text-[#3F3F46]"
              aria-label={`Amount in ${form.inputSymbol}`}
            />
          </div>
        </div>

        {/* Flip button */}
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleFlip}
            className="h-8 w-8 rounded-full border border-[#27272A] bg-[#18181B] p-0 hover:bg-[#27272A]"
            aria-label="Flip swap direction"
          >
            <ArrowUpDown className="h-4 w-4 text-[#71717A]" />
          </Button>
        </div>

        {/* To */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#71717A]">To</label>
          <div className="flex items-center gap-3 rounded-lg border border-[#27272A] bg-[#0A0A0B] px-4 py-3">
            <Badge className="shrink-0 bg-[#14F195]/10 text-[#14F195] border-[#14F195]/20">
              {form.outputSymbol}
            </Badge>
            <div className="flex-1 text-right text-lg font-medium text-[#71717A]">
              {quoteLoading ? (
                <span className="inline-block h-6 w-20 animate-pulse rounded bg-[#27272A]" />
              ) : quote ? (
                <span className="text-white">{quote.outputAmount}</span>
              ) : (
                <span>—</span>
              )}
            </div>
          </div>
        </div>

        {/* Quote error */}
        {quoteError && (
          <p className="text-xs text-[#F87171]">
            Failed to get quote — {quoteError instanceof Error ? quoteError.message : 'unknown error'}
          </p>
        )}

        {/* Quote preview inline */}
        {quote && !quoteLoading && (
          <QuotePreviewCard quote={quote} />
        )}

        {/* Review button */}
        <Button
          type="button"
          onClick={handleReview}
          disabled={!quote || quoteLoading}
          className={cn(
            'w-full h-12 rounded-lg font-semibold text-[#0A0A0B]',
            'bg-gradient-to-r from-[#9945FF] to-[#14F195]',
            'hover:opacity-90 disabled:opacity-40',
          )}
        >
          {quoteLoading ? 'Getting quote...' : !form.inputAmount ? 'Enter amount' : !quote ? 'Swap' : 'Review Swap'}
        </Button>

        {/* Slippage notice */}
        <p className="text-center text-xs text-[#71717A]">
          Max slippage: 0.5% · Priority fee: 5000 lamports · Powered by Jupiter
        </p>
      </CardContent>
    </Card>
  );
}

export default function TradingPage() {
  const setContext = useYellowBrickStore((s) => s.setContext);
  const { user } = useWalletAuth();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingQuote, setPendingQuote] = useState<QuotePreview | null>(null);

  useEffect(() => {
    setContext('trading');
    return () => setContext('dashboard');
  }, [setContext]);

  const handleQuoteReady = useCallback((quote: QuotePreview) => {
    setPendingQuote(quote);
    setConfirmOpen(true);
  }, []);

  const handleSwapSuccess = useCallback(() => {
    setConfirmOpen(false);
    setPendingQuote(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Trading</h1>
        <p className="mt-1 text-sm text-[#71717A]">Swap tokens via Jupiter on Solana</p>
      </div>

      {/* Wallet not connected */}
      {!user && (
        <Card className="border-[#27272A] bg-[#18181B]">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-10 w-10 text-[#71717A]" />
            <p className="mt-4 text-sm text-[#71717A]">Connect your wallet to start trading</p>
          </CardContent>
        </Card>
      )}

      {/* Main layout */}
      {user && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Swap form */}
          <SwapForm onQuoteReady={handleQuoteReady} />

          {/* Swap history */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-[#71717A]" />
              <h2 className="text-sm font-medium text-[#A1A1AA]">Recent Swaps</h2>
            </div>
            <SwapHistory embedded />
          </div>
        </div>
      )}

      {/* Confirm modal */}
      <SwapConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        quote={pendingQuote}
        slippageBps={DEFAULT_SLIPPAGE_BPS}
        priorityFeeLamports={DEFAULT_PRIORITY_FEE}
        onSuccess={handleSwapSuccess}
      />
    </div>
  );
}
