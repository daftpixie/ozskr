'use client';

/**
 * Content Generate Modal
 *
 * The primary content creation interface. Orchestrates:
 *   - ContentCategoryPicker (5 categories)
 *   - ModelSelector (filtered by category)
 *   - VideoOptions (for video / video-text)
 *   - Prompt textarea
 *   - PriceSummary (live quote + agent balance)
 *   - x402 payment flow (reusing useX402Generate)
 *   - Result display (image preview, text output)
 *
 * Video and text-only categories are "coming soon" in this iteration —
 * they render with a badge and disabled generate button while the expanded
 * multi-category generate endpoint is being built (WS2C).
 *
 * Only image and image-text categories are fully wired to
 * POST /api/services/image-generate.
 */

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Loader2,
  Check,
  AlertCircle,
  RefreshCw,
  Coins,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useX402Generate } from '@/hooks/use-x402-generate';
import { usePricing } from '../hooks/use-pricing';
import { useAgentBalance } from '../hooks/use-agent-balance';
import { ContentCategoryPicker } from './content-category-picker';
import { ModelSelector } from './model-selector';
import { VideoOptions } from './video-options';
import { PriceSummary } from './price-summary';
import type { ContentCategory } from '@/lib/pricing/model-registry';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Categories that are fully wired to live API endpoints.
 * All others show a "Coming soon" badge and disable the generate button.
 */
const LIVE_CATEGORIES: ContentCategory[] = ['image', 'image-text'];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ContentGenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterId: string;
  characterName: string;
}

// ---------------------------------------------------------------------------
// Payment confirmation overlay (same pattern as generate-modal.tsx)
// ---------------------------------------------------------------------------

interface PaymentConfirmOverlayProps {
  amountUsdc: string;
  payTo: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function PaymentConfirmOverlay({
  amountUsdc,
  payTo,
  onConfirm,
  onCancel,
}: PaymentConfirmOverlayProps) {
  const shortAddress = `${payTo.slice(0, 6)}...${payTo.slice(-4)}`;

  return (
    <Card className="border-[#F59E0B]/30 bg-[#F59E0B]/5 p-6">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Coins className="mt-0.5 h-5 w-5 shrink-0 text-[#F59E0B]" />
          <div className="flex-1 space-y-1">
            <p className="font-medium text-foreground">Confirm USDC Payment</p>
            <p className="text-sm text-muted-foreground">
              Your wallet will be prompted to sign a USDC transfer. No SOL is
              spent beyond the transaction fee.
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-[#18181B] p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium text-[#F59E0B]">{amountUsdc} USDC</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Recipient</span>
            <span className="font-mono text-xs text-foreground">{shortAddress}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-[#F59E0B] text-black hover:bg-[#F59E0B]/90"
            onClick={onConfirm}
          >
            <Check className="mr-2 h-4 w-4" />
            Confirm &amp; Sign
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export function ContentGenerateModal({
  open,
  onOpenChange,
  characterId,
  characterName,
}: ContentGenerateModalProps) {
  // -------------------------------------------------------------------------
  // Form state
  // -------------------------------------------------------------------------
  const [category, setCategory] = useState<ContentCategory>('image');
  const [prompt, setPrompt] = useState('');
  const [imageModel, setImageModel] = useState('fal-ai/nano-banana-2');
  const [videoModel, setVideoModel] = useState('fal-ai/veo3/fast');
  const [textModel, setTextModel] = useState('claude-sonnet-4-6');
  const [videoDuration, setVideoDuration] = useState(5);
  const [videoResolution, setVideoResolution] = useState<'720p' | '1080p' | '4K'>('720p');
  const [videoAudio, setVideoAudio] = useState(true);

  // -------------------------------------------------------------------------
  // Result state
  // -------------------------------------------------------------------------
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [outputText, setOutputText] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Payment confirmation state
  // -------------------------------------------------------------------------
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    amountUsdc: string;
    payTo: string;
  } | null>(null);
  const confirmResolverRef = useRef<(() => void) | null>(null);
  const confirmRejecterRef = useRef<((reason?: unknown) => void) | null>(null);

  // -------------------------------------------------------------------------
  // Data hooks
  // -------------------------------------------------------------------------
  const isLiveCategory = LIVE_CATEGORIES.includes(category);

  const pricingParams = isLiveCategory
    ? {
        category,
        imageModel,
        videoModel,
        textModel,
        videoDuration,
        videoResolution,
        videoAudio,
      }
    : null;

  const { data: quote, isLoading: isLoadingQuote } = usePricing(pricingParams);
  const { remainingUsdc: agentBalance } = useAgentBalance(characterId);

  // -------------------------------------------------------------------------
  // Generation hook
  // -------------------------------------------------------------------------
  const queryClient = useQueryClient();

  const { mutate: generate, isPending, reset } = useX402Generate({
    onConfirm: async ({ amountUsdc, payTo }) => {
      return new Promise<void>((resolve, reject) => {
        confirmResolverRef.current = resolve;
        confirmRejecterRef.current = reject;
        setPendingConfirmation({ amountUsdc, payTo });
      });
    },
  });

  // -------------------------------------------------------------------------
  // Derived flags
  // -------------------------------------------------------------------------
  const isGenerating = isPending && !pendingConfirmation;
  const hasResult = imageUrl !== null || outputText !== null;

  const isInsufficient =
    agentBalance !== null &&
    quote !== undefined &&
    agentBalance < quote.platformCostUsd;

  const canGenerate =
    isLiveCategory &&
    prompt.trim().length > 0 &&
    !isPending &&
    !isInsufficient;

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleSubmit = () => {
    if (!canGenerate) return;
    setImageUrl(null);
    setOutputText(null);
    setGenError(null);

    // For image and image-text categories: map to the image-generate endpoint.
    // The imageModel selection maps to standard vs pro tier.
    const generationType =
      imageModel === 'fal-ai/nano-banana-pro' ? 'image-pro' : 'image';

    generate(
      { characterId, prompt: prompt.trim(), type: generationType },
      {
        onSuccess: (result) => {
          setImageUrl(result.imageUrl);
          void queryClient.invalidateQueries({
            queryKey: ['character-generations', characterId],
          });
        },
        onError: (err) => {
          setGenError(err instanceof Error ? err.message : 'Generation failed');
        },
      }
    );
  };

  const handleGenerateAgain = () => {
    setImageUrl(null);
    setOutputText(null);
    setGenError(null);
    setPrompt('');
    reset();
  };

  const handleConfirmPayment = () => {
    setPendingConfirmation(null);
    confirmResolverRef.current?.();
    confirmResolverRef.current = null;
    confirmRejecterRef.current = null;
  };

  const handleCancelPayment = () => {
    setPendingConfirmation(null);
    confirmRejecterRef.current?.(new Error('User cancelled payment'));
    confirmResolverRef.current = null;
    confirmRejecterRef.current = null;
    setGenError('Payment cancelled');
    reset();
  };

  const handleClose = () => {
    onOpenChange(false);
    // Delay state reset until after the dialog close animation
    setTimeout(() => {
      setPrompt('');
      setImageUrl(null);
      setOutputText(null);
      setGenError(null);
      setPendingConfirmation(null);
      confirmRejecterRef.current?.(new Error('Modal closed'));
      confirmResolverRef.current = null;
      confirmRejecterRef.current = null;
      reset();
    }, 300);
  };

  const handleCategoryChange = (cat: ContentCategory) => {
    setCategory(cat);
    // Reset result when switching categories
    setImageUrl(null);
    setOutputText(null);
    setGenError(null);
  };

  // -------------------------------------------------------------------------
  // Generate button label
  // -------------------------------------------------------------------------
  function generateButtonLabel(): string {
    if (!isLiveCategory) return 'Coming Soon';
    if (isInsufficient) return 'Insufficient Balance';
    if (!prompt.trim()) return 'Enter a prompt to generate';
    if (isGenerating) return 'Generating...';
    const cost = quote ? `$${quote.platformCostUsd.toFixed(4)} USDC` : '';
    return cost ? `Generate & Pay ${cost}` : 'Generate';
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Content</DialogTitle>
          <DialogDescription>
            Create content with {characterName}
          </DialogDescription>
        </DialogHeader>

        {/* ==================================================================
            Form — shown unless generating / showing result
            ================================================================== */}
        {!hasResult && !isGenerating && !pendingConfirmation && !genError && (
          <div className="space-y-5">
            {/* Category picker */}
            <div className="space-y-2">
              <Label>Content Type</Label>
              <ContentCategoryPicker value={category} onChange={handleCategoryChange} />
              {!isLiveCategory && (
                <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
                  <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    <Badge className="mr-1.5 text-[10px]">Coming Soon</Badge>
                    This content type is in development. Try Image or Image + Text today.
                  </p>
                </div>
              )}
            </div>

            {/* Model selector */}
            <div className="space-y-2">
              <Label>Model</Label>
              <ModelSelector
                category={category}
                imageModel={imageModel}
                videoModel={videoModel}
                textModel={textModel}
                onImageModelChange={setImageModel}
                onVideoModelChange={setVideoModel}
                onTextModelChange={setTextModel}
                quote={quote}
                isLoadingQuote={isLoadingQuote}
              />
            </div>

            {/* Video options — only for video categories */}
            {(category === 'video' || category === 'video-text') && (
              <VideoOptions
                duration={videoDuration}
                resolution={videoResolution}
                generateAudio={videoAudio}
                onDurationChange={setVideoDuration}
                onResolutionChange={setVideoResolution}
                onAudioChange={setVideoAudio}
              />
            )}

            {/* Prompt */}
            <div className="space-y-2">
              <Label htmlFor="content-prompt">Prompt</Label>
              <Textarea
                id="content-prompt"
                placeholder="Describe what you want to create..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                maxLength={2000}
                disabled={!isLiveCategory}
              />
              <p className="text-xs text-muted-foreground">
                {prompt.length}/2000 characters
              </p>
            </div>

            {/* Price summary */}
            <PriceSummary
              quote={quote}
              isLoading={isLoadingQuote && isLiveCategory}
              agentBalance={agentBalance}
              characterId={characterId}
            />

            {/* Generate button */}
            <Button
              onClick={handleSubmit}
              disabled={!canGenerate}
              className={cn(
                'w-full font-semibold',
                isLiveCategory && canGenerate
                  ? 'bg-[#F59E0B] text-black hover:bg-[#F59E0B]/90'
                  : 'cursor-not-allowed opacity-50'
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Coins className="mr-2 h-4 w-4" />
                  {generateButtonLabel()}
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Payment is processed on-chain via your connected wallet. No funds
              are held by ozskr.ai.
            </p>
          </div>
        )}

        {/* ==================================================================
            Payment confirmation overlay
            ================================================================== */}
        {pendingConfirmation && (
          <PaymentConfirmOverlay
            amountUsdc={pendingConfirmation.amountUsdc}
            payTo={pendingConfirmation.payTo}
            onConfirm={handleConfirmPayment}
            onCancel={handleCancelPayment}
          />
        )}

        {/* ==================================================================
            Generating spinner
            ================================================================== */}
        {isGenerating && (
          <Card className="border-[#F59E0B]/20 bg-[#F59E0B]/5 p-6">
            <div className="flex flex-col items-center gap-3 py-4" aria-live="polite">
              <Loader2 className="h-8 w-8 animate-spin text-[#F59E0B]" />
              <p className="text-sm font-medium">Generating content...</p>
              <p className="text-xs text-muted-foreground">
                Submitting payment and running model
              </p>
            </div>
          </Card>
        )}

        {/* ==================================================================
            Error state
            ================================================================== */}
        {genError && !isPending && (
          <div className="space-y-4">
            <Card className="border-destructive/50 bg-destructive/10 p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div className="flex-1">
                  <h3 className="font-medium text-destructive">Generation Failed</h3>
                  <p className="mt-1 text-sm text-destructive/80">{genError}</p>
                </div>
              </div>
            </Card>
            <Button onClick={handleGenerateAgain} variant="outline" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        )}

        {/* ==================================================================
            Result display
            ================================================================== */}
        {hasResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-[#F59E0B]/20 bg-[#F59E0B]/5 px-4 py-3">
              <Check className="h-4 w-4 shrink-0 text-[#F59E0B]" />
              <p className="text-sm font-medium text-[#F59E0B]">
                Content generated and paid via USDC
              </p>
            </div>

            {/* Image result */}
            {imageUrl && (
              <div className="relative w-full overflow-hidden rounded-xl">
                <Image
                  src={imageUrl}
                  alt="Generated content"
                  width={600}
                  height={600}
                  className="w-full object-contain"
                  priority
                />
              </div>
            )}

            {/* Text result */}
            {outputText && (
              <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {outputText}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleGenerateAgain} variant="outline" className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Create More
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleClose}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
