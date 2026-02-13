'use client';

/**
 * Micro-Survey Component
 * Shows contextual feedback surveys at key moments in the user journey.
 * Auto-appears based on trigger events, dismissable, persisted to avoid repeats.
 */

import { useState } from 'react';
import { X, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSurveyStore, SURVEY_CONFIG, type SurveyTrigger } from './survey-store';

interface MicroSurveyProps {
  trigger: SurveyTrigger;
}

export function MicroSurvey({ trigger }: MicroSurveyProps) {
  const { activeSurvey, dismissSurvey, completeSurvey } = useSurveyStore();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'success'>('idle');

  if (activeSurvey !== trigger) return null;

  const config = SURVEY_CONFIG[trigger];

  const handleSubmit = async () => {
    if (!selectedOption) return;

    setState('submitting');

    try {
      const response = selectedOption === '__freetext__' ? freeText.trim() : selectedOption;

      await fetch('/api/feedback/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerPoint: trigger,
          response,
          metadata: {
            freeText: freeText.trim() || undefined,
          },
        }),
      });

      setState('success');
      setTimeout(() => completeSurvey(trigger), 1200);
    } catch {
      // Still dismiss on error — don't nag the user
      completeSurvey(trigger);
    }
  };

  return (
    <div className="fixed bottom-24 right-6 z-50 w-80 animate-fade-in-up rounded-lg border border-white/10 bg-background/95 p-4 shadow-lg backdrop-blur-sm">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-solana-purple" />
          <span className="text-sm font-medium">Quick question</span>
        </div>
        <button
          onClick={() => dismissSurvey(trigger)}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-white"
          aria-label="Dismiss survey"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {state === 'success' ? (
        <p className="py-4 text-center text-sm text-solana-green">Thanks for the feedback!</p>
      ) : (
        <>
          {/* Question */}
          <p className="mb-3 text-sm text-muted-foreground">{config.question}</p>

          {/* Options */}
          <div className="mb-3 flex flex-wrap gap-2">
            {config.options.map((option) => (
              <button
                key={option}
                onClick={() => setSelectedOption(option)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  selectedOption === option
                    ? 'border-solana-purple bg-solana-purple/20 text-white'
                    : 'border-white/10 text-muted-foreground hover:border-white/20 hover:text-white'
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          {/* Free text (optional) */}
          {config.allowFreeText && selectedOption && (
            <Textarea
              placeholder="Anything else? (optional)"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value.slice(0, 500))}
              rows={2}
              className="mb-3 resize-none text-xs"
            />
          )}

          {/* Submit */}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!selectedOption || state === 'submitting'}
            className="w-full bg-gradient-to-r from-solana-purple to-solana-green text-xs hover:opacity-90"
          >
            {state === 'submitting' ? 'Sending...' : 'Submit'}
          </Button>
        </>
      )}
    </div>
  );
}
