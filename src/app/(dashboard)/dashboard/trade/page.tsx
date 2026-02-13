/**
 * Trade Page
 * Main swap interface with token selection and quote preview
 */

'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowDownUp, Loader2, RefreshCw } from 'lucide-react';
import { useWalletAuth } from '@/features/wallet/hooks/use-wallet-auth';
import { useSwapQuote, useTokenList, useTokenBalance } from '@/hooks/use-trading';
import { QuotePreviewCard } from '@/features/trading/components/quote-preview';
import { SwapConfirmModal } from '@/features/trading/components/swap-confirm-modal';
import { SwapHistory } from '@/features/trading/components/swap-history';
import { cn } from '@/lib/utils';
import { parseTokenAmount, formatTokenAmount } from '@/lib/solana/tokens';
import { HOPE_MINT } from '@/lib/solana/hope-token';
import { getNetworkConfig } from '@/lib/solana/network-config';
import type { SwapQuoteRequest } from '@/types/trading';

function TradePageContent() {
  const { user, isAuthenticated } = useWalletAuth();
  const { data: tokens, isLoading: tokensLoading } = useTokenList();
  const searchParams = useSearchParams();

  // Token selection
  const [inputMint, setInputMint] = useState('So11111111111111111111111111111111111111112'); // SOL
  const [outputMint, setOutputMint] = useState(() => {
    const outputParam = searchParams.get('output');
    if (outputParam === 'HOPE') return HOPE_MINT;
    return getNetworkConfig().usdcMint;
  });

  // Amount and slippage
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(50); // 0.5%
  const [customSlippage, setCustomSlippage] = useState('');

  // Quote state
  const [quoteParams, setQuoteParams] = useState<SwapQuoteRequest | null>(null);
  const [quoteCleared, setQuoteCleared] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Fetch input token balance
  const { data: inputBalance } = useTokenBalance(user?.walletAddress, inputMint);

  // Fetch quote
  const { data: quote, isLoading: quoteLoading, refetch: refetchQuote } = useSwapQuote(quoteParams);

  // Derive currentQuote from query data — no useEffect needed
  const currentQuote = useMemo(() => {
    if (quoteCleared) return null;
    return quote ?? null;
  }, [quote, quoteCleared]);

  // Get quote handler
  const handleGetQuote = () => {
    if (!amount || parseFloat(amount) <= 0) return;

    // Convert amount to base units (lamports for SOL, etc.)
    const inputToken = tokens?.find((t) => t.mint === inputMint);
    if (!inputToken) return;

    // Use parseTokenAmount for precise BigInt conversion — no floating point
    const baseAmount = parseTokenAmount(amount, inputToken.decimals).toString();

    setQuoteCleared(false);
    setQuoteParams({
      inputMint,
      outputMint,
      amount: baseAmount,
      slippageBps,
    });
  };

  // Set max amount
  const handleSetMax = () => {
    if (!inputBalance) return;
    const inputToken = tokens?.find((t) => t.mint === inputMint);
    if (!inputToken) return;

    // Use formatTokenAmount for precise string conversion — no floating point
    const formatted = formatTokenAmount(BigInt(inputBalance.balance), inputToken.decimals);
    setAmount(formatted);
  };

  // Swap input/output tokens
  const handleSwapTokens = () => {
    const temp = inputMint;
    setInputMint(outputMint);
    setOutputMint(temp);
    setAmount('');
    setQuoteParams(null);
    setQuoteCleared(true);
  };

  // Handle slippage change
  const handleSlippageChange = (value: string) => {
    if (value === 'custom') {
      setCustomSlippage('');
      return;
    }
    setSlippageBps(parseInt(value));
    setCustomSlippage('');
  };

  const handleCustomSlippageChange = (value: string) => {
    setCustomSlippage(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0.1 && numValue <= 3) {
      setSlippageBps(Math.floor(numValue * 100));
    }
  };

  // Wallet disconnected state
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="border-border/50 bg-card p-8 text-center">
          <p className="text-muted-foreground">
            Connect your wallet to start trading
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-white">Trade</h1>
        <p className="mt-2 text-muted-foreground">
          Swap tokens on Solana with Jupiter
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Swap Interface */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-border/50 bg-card">
            <CardHeader>
              <CardTitle>Swap</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Input Token */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>From</Label>
                  {inputBalance && (
                    <span className="font-mono text-xs text-muted-foreground">
                      Balance: {inputBalance.balance}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Select value={inputMint} onValueChange={setInputMint}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tokensLoading && (
                        <div className="p-2 text-center text-sm text-muted-foreground">
                          Loading...
                        </div>
                      )}
                      {tokens?.map((token) => (
                        <SelectItem
                          key={token.mint}
                          value={token.mint}
                          disabled={token.mint === outputMint}
                        >
                          <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={token.logoURI}
                              alt={token.symbol}
                              className="h-4 w-4 rounded-full"
                            />
                            {token.symbol}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pr-16 font-mono"
                      step="any"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSetMax}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-xs"
                      disabled={!inputBalance}
                    >
                      MAX
                    </Button>
                  </div>
                </div>
              </div>

              {/* Swap Direction Button */}
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleSwapTokens}
                  className="rounded-full"
                >
                  <ArrowDownUp className="h-4 w-4" />
                </Button>
              </div>

              {/* Output Token */}
              <div className="space-y-2">
                <Label>To</Label>
                <Select value={outputMint} onValueChange={setOutputMint}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tokens?.map((token) => (
                      <SelectItem
                        key={token.mint}
                        value={token.mint}
                        disabled={token.mint === inputMint}
                      >
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={token.logoURI}
                            alt={token.symbol}
                            className="h-4 w-4 rounded-full"
                          />
                          {token.symbol}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Slippage Settings */}
              <div className="space-y-2">
                <Label>Slippage Tolerance</Label>
                <div className="flex gap-2">
                  <Button
                    variant={slippageBps === 50 && !customSlippage ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSlippageChange('50')}
                    className={cn(
                      slippageBps === 50 &&
                        !customSlippage &&
                        'bg-solana-purple hover:bg-solana-purple/90'
                    )}
                  >
                    0.5%
                  </Button>
                  <Button
                    variant={slippageBps === 100 && !customSlippage ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSlippageChange('100')}
                    className={cn(
                      slippageBps === 100 &&
                        !customSlippage &&
                        'bg-solana-purple hover:bg-solana-purple/90'
                    )}
                  >
                    1%
                  </Button>
                  <Button
                    variant={slippageBps === 200 && !customSlippage ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSlippageChange('200')}
                    className={cn(
                      slippageBps === 200 &&
                        !customSlippage &&
                        'bg-solana-purple hover:bg-solana-purple/90'
                    )}
                  >
                    2%
                  </Button>
                  <Input
                    type="number"
                    placeholder="Custom"
                    value={customSlippage}
                    onChange={(e) => handleCustomSlippageChange(e.target.value)}
                    className="w-24 font-mono"
                    max={3}
                    step={0.1}
                  />
                </div>
                {slippageBps > 100 && (
                  <p className="text-xs text-yellow-500">
                    High slippage may result in unfavorable rates
                  </p>
                )}
              </div>

              {/* Get Quote Button */}
              <Button
                onClick={handleGetQuote}
                disabled={!amount || parseFloat(amount) <= 0 || quoteLoading}
                className="w-full bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90"
              >
                {quoteLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting Quote...
                  </>
                ) : (
                  'Get Quote'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Quote Preview */}
          {currentQuote && (
            <div className="space-y-4">
              <QuotePreviewCard quote={currentQuote} />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => refetchQuote()}
                  className="flex-1"
                  disabled={quoteLoading}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Quote
                </Button>
                <Button
                  onClick={() => setConfirmModalOpen(true)}
                  disabled={parseFloat(currentQuote.priceImpact) > 5}
                  className="flex-1 bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90"
                >
                  Swap
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Recent Swaps */}
        <div className="lg:col-span-1">
          <SwapHistory embedded />
        </div>
      </div>

      {/* Swap Confirmation Modal */}
      <SwapConfirmModal
        open={confirmModalOpen}
        onOpenChange={setConfirmModalOpen}
        quote={currentQuote}
        slippageBps={slippageBps}
        priorityFeeLamports="0"
        onSuccess={() => {
          setAmount('');
          setQuoteParams(null);
          setQuoteCleared(true);
        }}
      />
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><p className="text-muted-foreground">Loading trade...</p></div>}>
      <TradePageContent />
    </Suspense>
  );
}
