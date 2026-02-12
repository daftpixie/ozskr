/**
 * Swap Confirmation Modal
 * Handles swap confirmation and progress tracking
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Check,
  AlertCircle,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuotePreview, SwapResult, SwapStage } from '../lib/swap-flow';
import { useExecuteSwap } from '@/hooks/use-trading';

interface SwapConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: QuotePreview | null;
  slippageBps: number;
  priorityFeeLamports: string;
  onSuccess?: () => void;
}

const STAGE_LABELS: Record<SwapStage, string> = {
  validating: 'Validating transaction...',
  quoting: 'Getting quote...',
  previewing: 'Preparing swap...',
  simulating: 'Simulating transaction...',
  signing: 'Awaiting wallet signature...',
  submitting: 'Submitting to network...',
  confirming: 'Confirming transaction...',
  recording: 'Recording swap...',
  complete: 'Complete',
  error: 'Error',
};

const STAGE_ORDER = [
  'validating',
  'simulating',
  'signing',
  'submitting',
  'confirming',
  'complete',
] as const;

export function SwapConfirmModal({
  open,
  onOpenChange,
  quote,
  slippageBps,
  priorityFeeLamports,
  onSuccess,
}: SwapConfirmModalProps) {
  const [currentStage, setCurrentStage] = useState<SwapStage | null>(null);
  const [result, setResult] = useState<SwapResult | null>(null);

  const { mutate: executeSwap, isPending } = useExecuteSwap((stage) => {
    setCurrentStage(stage);
  });

  const isComplete = currentStage === 'complete' || (result?.success ?? false);
  const hasError = currentStage === 'error' || (result !== null && !result.success);

  const handleConfirm = () => {
    if (!quote) return;

    executeSwap(
      {
        inputMint: quote.inputToken.mint,
        outputMint: quote.outputToken.mint,
        inputAmount: quote.inputAmount,
        slippageBps,
        priorityFeeLamports,
      },
      {
        onSuccess: (data) => {
          setResult(data);
          setCurrentStage('complete');
          onSuccess?.();
        },
        onError: (error) => {
          setResult({
            success: false,
            error: error instanceof Error ? error.message : 'Swap failed',
          });
          setCurrentStage('error');
        },
      }
    );
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setCurrentStage(null);
      setResult(null);
    }, 300);
  };

  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Swap</DialogTitle>
          <DialogDescription>
            Review your swap details before confirming
          </DialogDescription>
        </DialogHeader>

        {/* Initial Confirmation View */}
        {!currentStage && (
          <div className="space-y-4">
            {/* Swap Summary */}
            <Card className="border-border/50 bg-card p-4">
              <div className="space-y-3">
                {/* From → To */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={quote.inputToken.logoURI}
                      alt={quote.inputToken.symbol}
                      className="h-8 w-8 rounded-full"
                    />
                    <div>
                      <p className="font-mono text-sm font-medium text-white">
                        {quote.inputAmount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {quote.inputToken.symbol}
                      </p>
                    </div>
                  </div>

                  <ArrowRight className="h-5 w-5 text-muted-foreground" />

                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={quote.outputToken.logoURI}
                      alt={quote.outputToken.symbol}
                      className="h-8 w-8 rounded-full"
                    />
                    <div>
                      <p className="font-mono text-sm font-medium text-solana-green">
                        {quote.outputAmount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {quote.outputToken.symbol}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Details */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Minimum Received
                    </span>
                    <span className="font-mono text-white">
                      {quote.minimumReceived} {quote.outputToken.symbol}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Slippage</span>
                    <span className="font-mono text-white">
                      {slippageBps / 100}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Network Fee</span>
                    <span className="font-mono text-white">
                      {quote.networkFee.displayAmount} SOL
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Price Impact</span>
                    <Badge
                      variant={
                        parseFloat(quote.priceImpact) > 5
                          ? 'destructive'
                          : parseFloat(quote.priceImpact) > 1
                          ? 'default'
                          : 'secondary'
                      }
                      className={cn(
                        parseFloat(quote.priceImpact) > 1 &&
                          parseFloat(quote.priceImpact) <= 5 &&
                          'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                      )}
                    >
                      {quote.priceImpact}%
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>

            {/* Minimum Received Highlight */}
            <div className="rounded-lg border border-solana-green/20 bg-solana-green/5 p-3">
              <p className="text-center text-sm">
                <span className="text-muted-foreground">
                  You will receive at least{' '}
                </span>
                <span className="font-mono font-semibold text-solana-green">
                  {quote.minimumReceived} {quote.outputToken.symbol}
                </span>
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isPending}
                className="flex-1 bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  'Confirm Swap'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Progress View */}
        {currentStage && !isComplete && !hasError && (
          <div className="space-y-4">
            <Card className="border-solana-purple/20 bg-solana-purple/5 p-6">
              <div className="space-y-4">
                {/* Stages */}
                <div className="space-y-3">
                  {STAGE_ORDER.map((stage) => {
                    const isCurrentStage = currentStage === stage;
                    let currentIndex = -1;
                    if (currentStage) {
                      const idx = STAGE_ORDER.indexOf(currentStage as typeof STAGE_ORDER[number]);
                      currentIndex = idx !== -1 ? idx : STAGE_ORDER.length;
                    }
                    const stageIndex = STAGE_ORDER.indexOf(stage);
                    const isPastStage = currentIndex > stageIndex && currentIndex !== -1;
                    const isDone = isPastStage;

                    return (
                      <div key={stage} className="flex items-center gap-3">
                        {isDone ? (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-solana-green">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        ) : isCurrentStage ? (
                          <Loader2 className="h-6 w-6 animate-spin text-solana-purple" />
                        ) : (
                          <div className="h-6 w-6 rounded-full border-2 border-muted" />
                        )}
                        <span
                          className={cn(
                            'text-sm',
                            isDone && 'text-solana-green',
                            isCurrentStage && 'font-medium text-white',
                            !isDone && !isCurrentStage && 'text-muted-foreground'
                          )}
                        >
                          {STAGE_LABELS[stage]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Success View */}
        {isComplete && result?.success && (
          <div className="space-y-4">
            <Card className="border-solana-green/20 bg-solana-green/5 p-6">
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-solana-green" />
                <div className="flex-1">
                  <h3 className="font-medium text-solana-green">
                    Swap Complete!
                  </h3>
                  <p className="mt-1 text-sm text-solana-green/80">
                    Your swap has been successfully executed.
                  </p>
                </div>
              </div>
            </Card>

            {/* Transaction Link */}
            {result.transactionSignature && (
              <Card className="p-4">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Transaction Signature
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                      {result.transactionSignature}
                    </code>
                    {result.explorerUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a
                          href={result.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Close
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  // Navigate to portfolio would go here
                  handleClose();
                }}
                className="flex-1"
              >
                View Portfolio
              </Button>
            </div>
          </div>
        )}

        {/* Error View */}
        {hasError && (
          <div className="space-y-4">
            <Card className="border-destructive/50 bg-destructive/10 p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div className="flex-1">
                  <h3 className="font-medium text-destructive">Swap Failed</h3>
                  <p className="mt-1 text-sm text-destructive/80">
                    {result?.error || 'An error occurred during the swap'}
                  </p>
                </div>
              </div>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Close
              </Button>
              <Button
                onClick={() => {
                  setCurrentStage(null);
                  setResult(null);
                }}
                className="flex-1"
              >
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
