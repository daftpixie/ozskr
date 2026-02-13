'use client';

/**
 * Waitlist Form
 * Email signup with optional wallet address auto-inclusion
 */

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Check, AlertCircle } from 'lucide-react';

type FormState = 'idle' | 'submitting' | 'success' | 'duplicate' | 'error';

export function WaitlistForm() {
  const { publicKey } = useWallet();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/waitlist/count')
      .then((r) => r.json())
      .then((data: { count: number }) => setCount(data.count))
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
        }),
      });

      const data: { message?: string; error?: string } = await res.json();

      if (res.status === 201) {
        setState('success');
        setCount((prev) => (prev !== null ? prev + 1 : prev));
      } else if (res.ok && data.message === 'Already on the waitlist') {
        setState('duplicate');
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
        <p className="text-lg font-medium text-white">You&apos;re on the list!</p>
        <p className="text-sm text-muted-foreground">
          We&apos;ll notify you when ozskr.ai launches.
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
        <p className="text-lg font-medium text-white">Already signed up!</p>
        <p className="text-sm text-muted-foreground">
          You&apos;re already on the waitlist. We&apos;ll be in touch.
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
          {state === 'submitting' ? 'Joining...' : 'Join Waitlist'}
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

      {count !== null && count > 0 && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-white">{count.toLocaleString()}</span>{' '}
          {count === 1 ? 'person has' : 'people have'} joined
        </p>
      )}
    </form>
  );
}
