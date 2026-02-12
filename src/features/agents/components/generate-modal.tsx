/**
 * Content Generation Modal
 * Handles content generation with SSE streaming progress
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Loader2,
  Check,
  AlertCircle,
  Copy,
  Share2,
  RefreshCw,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';
import { useGenerateContent, useGenerationStream } from '@/hooks/use-generations';
import { GenerationType } from '@/types/database';
import { cn } from '@/lib/utils';
import type { GenerationStage } from '@/hooks/use-generations';

interface GenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterId: string;
  characterName: string;
}

const STAGE_LABELS: Record<GenerationStage, string> = {
  loading_character: 'Loading character DNA...',
  enhancing_prompt: 'Enhancing prompt...',
  generating_content: 'Generating content...',
  quality_check: 'Quality check...',
  moderation: 'Moderation...',
  complete: 'Complete',
  error: 'Error',
};

export function GenerateModal({
  open,
  onOpenChange,
  characterId,
  characterName,
}: GenerateModalProps) {
  const [contentType, setContentType] = useState<GenerationType>(GenerationType.TEXT);
  const [prompt, setPrompt] = useState('');
  const [generationId, setGenerationId] = useState<string | null>(null);

  const { mutate: generateContent, isPending: isSubmitting } = useGenerateContent(characterId);
  const { progress } = useGenerationStream(generationId);

  const isComplete = progress?.stage === 'complete';
  const hasError = progress?.stage === 'error';

  // Submit generation
  const handleSubmit = () => {
    if (!prompt.trim()) return;

    generateContent(
      {
        generationType: contentType,
        inputPrompt: prompt.trim(),
      },
      {
        onSuccess: (response) => {
          setGenerationId(response.generationId);
        },
      }
    );
  };

  // Reset for new generation
  const handleGenerateAgain = () => {
    setGenerationId(null);
    setPrompt('');
  };

  // Close and reset
  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setGenerationId(null);
      setPrompt('');
      setContentType(GenerationType.TEXT);
    }, 300);
  };

  // Copy result
  const handleCopy = () => {
    if (progress?.result?.outputText) {
      navigator.clipboard.writeText(progress.result.outputText);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Content</DialogTitle>
          <DialogDescription>
            Create content with {characterName}
          </DialogDescription>
        </DialogHeader>

        {/* Input Form (shown before generation starts) */}
        {!generationId && (
          <div className="space-y-4">
            {/* Content Type Toggle */}
            <div className="space-y-2">
              <Label>Content Type</Label>
              <div className="flex gap-2">
                <Button
                  variant={contentType === GenerationType.TEXT ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setContentType(GenerationType.TEXT)}
                  className={cn(
                    contentType === GenerationType.TEXT &&
                      'bg-gradient-to-r from-solana-purple to-solana-green'
                  )}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Text
                </Button>
                <Button
                  variant={contentType === GenerationType.IMAGE ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setContentType(GenerationType.IMAGE)}
                  className={cn(
                    contentType === GenerationType.IMAGE &&
                      'bg-gradient-to-r from-solana-purple to-solana-green'
                  )}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Image
                </Button>
              </div>
            </div>

            {/* Prompt Input */}
            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                placeholder={
                  contentType === GenerationType.TEXT
                    ? 'What would you like to write about?'
                    : 'Describe the image you want to generate...'
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                maxLength={5000}
              />
              <p className="text-xs text-muted-foreground">
                {prompt.length}/5000 characters
              </p>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!prompt.trim() || isSubmitting}
              className="w-full bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>Generate</>
              )}
            </Button>
          </div>
        )}

        {/* Progress Display (shown during generation) */}
        {generationId && !isComplete && !hasError && (
          <div className="space-y-4">
            <Card className="border-solana-purple/20 bg-solana-purple/5 p-6">
              <div className="space-y-4">
                {/* Stages */}
                <div className="space-y-3">
                  {(['loading_character', 'enhancing_prompt', 'generating_content', 'quality_check', 'moderation'] as const).map(
                    (stage) => {
                      const isCurrentStage = progress?.stage === stage;
                      const isPastStage = progress?.stage && STAGE_ORDER.indexOf(progress.stage) > STAGE_ORDER.indexOf(stage);
                      const isDone = isPastStage || progress?.stage === 'complete';

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
                    }
                  )}
                </div>

                {/* Current message */}
                {progress?.message && (
                  <p className="text-sm text-muted-foreground">
                    {progress.message}
                  </p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Error State */}
        {hasError && (
          <div className="space-y-4">
            <Card className="border-destructive/50 bg-destructive/10 p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div className="flex-1">
                  <h3 className="font-medium text-destructive">Generation Failed</h3>
                  <p className="mt-1 text-sm text-destructive/80">
                    {progress?.error || 'An error occurred during generation'}
                  </p>
                </div>
              </div>
            </Card>
            <Button
              onClick={handleGenerateAgain}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        )}

        {/* Result Display */}
        {isComplete && progress?.result && (
          <div className="space-y-4">
            <Card className="border-solana-green/20 bg-solana-green/5 p-6">
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-solana-green" />
                <div className="flex-1">
                  <h3 className="font-medium text-solana-green">
                    Generation Complete
                  </h3>
                </div>
              </div>
            </Card>

            {/* Text Output */}
            {progress.result.outputText && (
              <Card className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">Text</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopy}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">
                    {progress.result.outputText}
                  </p>
                </div>
              </Card>
            )}

            {/* Image Output */}
            {progress.result.outputUrl && (
              <Card className="p-6">
                <div className="space-y-3">
                  <Badge variant="secondary">Image</Badge>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={progress.result.outputUrl}
                    alt="Generated content"
                    className="w-full rounded-lg"
                  />
                </div>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleGenerateAgain}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Generate Again
              </Button>
              <Button variant="outline" size="icon">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const STAGE_ORDER: GenerationStage[] = [
  'loading_character',
  'enhancing_prompt',
  'generating_content',
  'quality_check',
  'moderation',
  'complete',
];
