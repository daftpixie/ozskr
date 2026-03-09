'use client';

/**
 * Model Selector
 *
 * Filtered model cards for the selected content category. Groups fal.ai
 * models before Anthropic models. For compound categories (image-text,
 * video-text) it renders two independent selectors side-by-side.
 *
 * Shows a skeleton while the pricing quote is loading.
 */

import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { getModelsForCategory } from '@/lib/pricing/model-registry';
import type { ContentCategory, ModelDefinition } from '@/lib/pricing/model-registry';
import type { PriceQuote } from '@/lib/pricing/pricing-calculator';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ModelSelectorProps {
  category: ContentCategory;
  imageModel: string;
  videoModel: string;
  textModel: string;
  onImageModelChange: (id: string) => void;
  onVideoModelChange: (id: string) => void;
  onTextModelChange: (id: string) => void;
  quote: PriceQuote | undefined;
  isLoadingQuote: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sortModels(models: ModelDefinition[]): ModelDefinition[] {
  // fal.ai models first, then anthropic
  return [...models].sort((a, b) => {
    if (a.provider === b.provider) return 0;
    return a.provider === 'fal.ai' ? -1 : 1;
  });
}

function modelCostFromQuote(
  modelId: string,
  quote: PriceQuote | undefined
): string | null {
  if (!quote) return null;
  const entry = quote.models.find((m) => m.modelId === modelId);
  if (!entry) return null;
  return `$${entry.baseCostUsd.toFixed(4)} / ${entry.unit}`;
}

// ---------------------------------------------------------------------------
// Individual model card
// ---------------------------------------------------------------------------

interface ModelCardProps {
  model: ModelDefinition;
  isSelected: boolean;
  onSelect: () => void;
  costLabel: string | null;
  isLoadingQuote: boolean;
}

function ModelCard({
  model,
  isSelected,
  onSelect,
  costLabel,
  isLoadingQuote,
}: ModelCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9945FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0B]',
        isSelected
          ? 'border-[#9945FF] bg-[#9945FF]/10'
          : 'border-[#27272A] bg-[#18181B] hover:border-[#9945FF]/30'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{model.name}</span>
            {model.tier === 'pro' && (
              <Badge className="border-[#10B981]/40 bg-[#10B981]/10 text-[#10B981]">
                Pro
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{model.provider}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{model.description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isLoadingQuote ? (
            <div className="h-3 w-14 animate-pulse rounded bg-muted" />
          ) : costLabel ? (
            <span className="text-xs font-medium text-[#10B981]">{costLabel}</span>
          ) : null}
          {isSelected && <Check className="h-4 w-4 text-[#9945FF]" />}
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Group selector (image or video or text)
// ---------------------------------------------------------------------------

interface GroupSelectorProps {
  label: string;
  models: ModelDefinition[];
  selectedId: string;
  onSelect: (id: string) => void;
  quote: PriceQuote | undefined;
  isLoadingQuote: boolean;
}

function GroupSelector({
  label,
  models,
  selectedId,
  onSelect,
  quote,
  isLoadingQuote,
}: GroupSelectorProps) {
  const sorted = sortModels(models);

  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="space-y-2">
        {sorted.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            isSelected={selectedId === model.id}
            onSelect={() => onSelect(model.id)}
            costLabel={modelCostFromQuote(model.id, quote)}
            isLoadingQuote={isLoadingQuote}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ModelSelector({
  category,
  imageModel,
  videoModel,
  textModel,
  onImageModelChange,
  onVideoModelChange,
  onTextModelChange,
  quote,
  isLoadingQuote,
}: ModelSelectorProps) {
  const allModels = getModelsForCategory(category);

  // Partition by provider role
  const imageModels = allModels.filter((m) => m.provider === 'fal.ai' && m.categories.some(
    (c) => c === 'image' || c === 'image-text'
  ) && !m.categories.some((c) => c === 'video' || c === 'video-text'));

  const videoModels = allModels.filter((m) => m.provider === 'fal.ai' && m.categories.some(
    (c) => c === 'video' || c === 'video-text'
  ));

  const textModels = allModels.filter((m) => m.provider === 'anthropic');

  return (
    <div className="space-y-4">
      {/* Image model selector */}
      {(category === 'image' || category === 'image-text') && imageModels.length > 0 && (
        <GroupSelector
          label="Image Model"
          models={imageModels}
          selectedId={imageModel}
          onSelect={onImageModelChange}
          quote={quote}
          isLoadingQuote={isLoadingQuote}
        />
      )}

      {/* Video model selector */}
      {(category === 'video' || category === 'video-text') && videoModels.length > 0 && (
        <GroupSelector
          label="Video Model"
          models={videoModels}
          selectedId={videoModel}
          onSelect={onVideoModelChange}
          quote={quote}
          isLoadingQuote={isLoadingQuote}
        />
      )}

      {/* Text model selector (for text-only or compound categories) */}
      {(category === 'text' || category === 'image-text' || category === 'video-text') &&
        textModels.length > 0 && (
          <GroupSelector
            label="Text Model"
            models={textModels}
            selectedId={textModel}
            onSelect={onTextModelChange}
            quote={quote}
            isLoadingQuote={isLoadingQuote}
          />
        )}
    </div>
  );
}
