'use client';

/**
 * Feedback Widget
 * Floating button that opens a feedback dialog on dashboard pages
 */

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare, Star, Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';

type WidgetState = 'idle' | 'submitting' | 'success' | 'error';

export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<WidgetState>('idle');

  const resetForm = () => {
    setRating(0);
    setHovered(0);
    setMessage('');
    setState('idle');
  };

  const handleSubmit = async () => {
    if (rating === 0) return;

    setState('submitting');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          ...(message.trim() && { message: message.trim() }),
          pageUrl: pathname,
        }),
      });

      if (res.ok) {
        setState('success');
        setTimeout(() => {
          setOpen(false);
          resetForm();
        }, 1500);
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full bg-gradient-to-r from-solana-purple to-solana-green shadow-lg hover:opacity-90"
          aria-label="Send feedback"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Help us improve ozskr.ai. Your feedback is anonymous.
          </DialogDescription>
        </DialogHeader>

        {state === 'success' ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-solana-green/20">
              <Check className="h-6 w-6 text-solana-green" />
            </div>
            <p className="text-sm text-muted-foreground">Thank you for your feedback!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pt-2">
            {/* Star Rating */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">How&apos;s your experience?</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHovered(star)}
                    onMouseLeave={() => setHovered(0)}
                    className="rounded p-1 transition-colors hover:bg-white/5"
                    aria-label={`Rate ${star} stars`}
                  >
                    <Star
                      className={`h-6 w-6 transition-colors ${
                        star <= (hovered || rating)
                          ? 'fill-brick-gold text-brick-gold'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                Anything else? <span className="text-muted-foreground">(optional)</span>
              </p>
              <Textarea
                placeholder="Tell us what you think..."
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                rows={3}
                className="resize-none"
              />
              <p className="text-right text-xs text-muted-foreground">
                {message.length}/500
              </p>
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={rating === 0 || state === 'submitting'}
              className="w-full bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90"
            >
              {state === 'submitting' ? (
                'Sending...'
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Feedback
                </>
              )}
            </Button>

            {state === 'error' && (
              <p className="text-center text-sm text-red-400">
                Something went wrong. Please try again.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
