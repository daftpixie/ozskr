'use client';

/**
 * Waitlist Form
 * Email signup with optional wallet address auto-inclusion
 * Shows remaining spots out of 500
 */

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Check, AlertCircle } from 'lucide-react';

type FormState = 'idle' | 'submitting' | 'success' | 'duplicate' | 'full' | 'error';

interface WaitlistCount {
  count: number;
  total: number;
  remaining: number;
}

interface WaitlistFormProps {
  source?: string;
}

export function WaitlistForm({ source }: WaitlistFormProps) {
  const { publicKey } = useWallet();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [waitlistData, setWaitlistData] = useState<WaitlistCount | null>(null);

  useEffect(() => {
    fetch('/api/waitlist/count')
      .then((r) => r.json())
      .then((data: WaitlistCount) => setWaitlistData(data))
      .catch(() => {/* ignore */});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const walletAddress = publicKey?.toBase58();

    if (!email && !walletAddress) return;

    setState('submitting');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(email && { email }),
          ...(walletAddress && { walletAddress }),
          ...(source && { source }),
        }),
      });

      const data: { message?: string; error?: string; remaining?: number } = await res.json();

      if (res.status === 201) {
        setState('success');
        setWaitlistData((prev) =>
          prev ? { ...prev, count: prev.count + 1, remaining: prev.remaining - 1 } : prev
        );
      } else if (res.ok && data.message === 'Already on the waitlist') {
        setState('duplicate');
      } else if (res.ok && data.message === 'Waitlist is full') {
        setState('full');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  };

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-solana-green/20">
          <Check className="h-6 w-6 text-solana-green" />
        </div>
        <p className="text-lg font-medium text-white">You&apos;re on the road!</p>
        <p className="text-sm text-muted-foreground">
          We&apos;ll let you know when the Emerald City opens its gates.
        </p>
      </div>
    );
  }

  if (state === 'duplicate') {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brick-gold/20">
          <Check className="h-6 w-6 text-brick-gold" />
        </div>
        <p className="text-lg font-medium text-white">You&apos;re already on the road!</p>
        <p className="text-sm text-muted-foreground">
          You&apos;re already on the waitlist. We&apos;ll be in touch.
        </p>
      </div>
    );
  }

  if (state === 'full') {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
          <AlertCircle className="h-6 w-6 text-red-400" />
        </div>
        <p className="text-lg font-medium text-white">Waitlist is full</p>
        <p className="text-sm text-muted-foreground">
          All 500 spots have been claimed. Follow us for future openings.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-md gap-2">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 border-border/50 bg-white/5 pl-10 text-white placeholder:text-muted-foreground"
            required={!publicKey}
          />
        </div>
        <Button
          type="submit"
          disabled={state === 'submitting' || (!email && !publicKey)}
          className="h-11 bg-gradient-to-r from-solana-purple to-solana-green px-6 hover:opacity-90"
        >
          {state === 'submitting' ? 'Joining...' : 'Claim Your Spot'}
        </Button>
      </div>

      {publicKey && (
        <p className="text-xs text-muted-foreground">
          Wallet {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)} will be included automatically
        </p>
      )}

      {state === 'error' && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />
          Something went wrong. Please try again.
        </div>
      )}

      {waitlistData && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-white">{waitlistData.remaining.toLocaleString()}</span>{' '}
          of {waitlistData.total.toLocaleString()} spots remaining
          {waitlistData.count > 0 && (
            <span>
              {' '}&middot;{' '}
              <span className="font-medium text-white">{waitlistData.count.toLocaleString()}</span>{' '}
              {waitlistData.count === 1 ? 'person has' : 'people have'} joined
            </span>
          )}
        </p>
      )}
    </form>
  );
}
