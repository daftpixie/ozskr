'use client';

/**
 * Access Step Component
 * Checks waitlist status and grants access
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useWalletAuth } from '@/features/wallet/hooks/use-wallet-auth';

interface WaitlistStatus {
  onWaitlist: boolean;
  status?: string;
}

interface AccessStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function AccessStep({ onNext, onBack }: AccessStepProps) {
  const { token } = useWalletAuth();
  const [waitlistStatus, setWaitlistStatus] = useState<WaitlistStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWaitlistStatus = async () => {
      if (!token) {
        setError('No authentication token found');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/waitlist/status', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch waitlist status');
        }

        const data = (await response.json()) as WaitlistStatus;
        setWaitlistStatus(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWaitlistStatus();
  }, [token]);

  if (isLoading) {
    return (
      <div className="animate-fade-in-up">
        <Card className="mx-auto max-w-2xl border-mid-gray bg-deep-gray">
          <CardContent className="flex min-h-[400px] items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-solana-purple" />
              <p className="text-sm text-muted-foreground">Checking your access...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in-up">
        <Card className="mx-auto max-w-2xl border-mid-gray bg-deep-gray">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="font-display text-2xl text-white">
              Something went wrong
            </CardTitle>
            <CardDescription className="mt-2 text-light-gray">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-3">
            <Button onClick={onBack} variant="outline">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Approved state
  if (waitlistStatus?.status === 'approved') {
    return (
      <div className="animate-fade-in-up">
        <Card className="mx-auto max-w-2xl border-mid-gray bg-deep-gray">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-core/20">
              <CheckCircle2 className="h-8 w-8 text-emerald-bright" />
            </div>
            <CardTitle className="font-display text-2xl text-white">
              You&apos;re in! Access granted.
            </CardTitle>
            <CardDescription className="mt-2 text-light-gray">
              Welcome to ozskr.ai beta. Let&apos;s continue setting up your profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-3">
            <Button onClick={onBack} variant="outline">
              Back
            </Button>
            <Button
              onClick={onNext}
              className="bg-gradient-to-r from-solana-purple to-solana-green text-white hover:opacity-90"
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // On waitlist but not approved
  if (waitlistStatus?.onWaitlist) {
    return (
      <div className="animate-fade-in-up">
        <Card className="mx-auto max-w-2xl border-mid-gray bg-deep-gray">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brick-gold/10">
              <Clock className="h-8 w-8 text-brick-gold" />
            </div>
            <CardTitle className="font-display text-2xl text-white">
              You&apos;re on the list!
            </CardTitle>
            <CardDescription className="mt-2 text-light-gray">
              We&apos;ll notify you when your spot opens. Thanks for your patience.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => window.location.href = '/'} variant="outline">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not on waitlist
  return (
    <div className="animate-fade-in-up">
      <Card className="mx-auto max-w-2xl border-mid-gray bg-deep-gray">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brick-gold/10">
            <AlertCircle className="h-8 w-8 text-brick-gold" />
          </div>
          <CardTitle className="font-display text-2xl text-white">
            Join the waitlist first
          </CardTitle>
          <CardDescription className="mt-2 text-light-gray">
            You need to be on the waitlist to access ozskr.ai beta.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={() => window.location.href = '/'} variant="outline">
            Back to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
