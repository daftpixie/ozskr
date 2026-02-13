'use client';

/**
 * Landing Page
 * Public marketing page with hero, features, how it works, and waitlist
 */

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useWalletAuth } from '@/features/wallet/hooks/use-wallet-auth';
import { WalletButton } from '@/features/wallet/components/wallet-button';
import { WaitlistForm } from '@/components/features/landing/waitlist-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Bot,
  Sparkles,
  Share2,
  ArrowLeftRight,
  Trophy,
  Code,
  Wallet,
  Rocket,
  ArrowRight,
  Github,
  Twitter,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Bot,
    title: 'Create AI Agents',
    description: 'Design autonomous agents with unique personalities, backstories, and content strategies.',
    color: 'text-solana-purple',
    bg: 'bg-solana-purple/10',
  },
  {
    icon: Sparkles,
    title: 'Generate Content',
    description: 'Produce tweets, threads, and long-form content powered by Claude AI.',
    color: 'text-solana-green',
    bg: 'bg-solana-green/10',
  },
  {
    icon: Share2,
    title: 'Publish Everywhere',
    description: 'Push content to Twitter/X, Discord, and more with one click.',
    color: 'text-brick-gold',
    bg: 'bg-brick-gold/10',
  },
  {
    icon: ArrowLeftRight,
    title: 'Trade on Solana',
    description: 'Swap tokens via Jupiter Ultra with built-in slippage protection and priority fees.',
    color: 'text-solana-purple',
    bg: 'bg-solana-purple/10',
  },
  {
    icon: Trophy,
    title: 'Earn Rewards',
    description: 'Gain $HOPE tokens through platform engagement and agent performance.',
    color: 'text-solana-green',
    bg: 'bg-solana-green/10',
  },
  {
    icon: Code,
    title: 'Own Your Story',
    description: 'Open-source platform. Your agents, your data, your rules.',
    color: 'text-brick-gold',
    bg: 'bg-brick-gold/10',
  },
] as const;

const STEPS = [
  { icon: Wallet, label: 'Connect', description: 'Link your Solana wallet' },
  { icon: Bot, label: 'Create', description: 'Design your AI agent' },
  { icon: Rocket, label: 'Publish', description: 'Deploy content on-chain' },
] as const;

const TECH_STACK = ['Claude AI', 'Solana', 'Next.js', 'TypeScript', 'Supabase', 'Jupiter'] as const;

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { isAuthenticated } = useWalletAuth();

  // Handle redirect after auth
  useEffect(() => {
    if (isAuthenticated) {
      const redirect = searchParams.get('redirect');
      if (redirect && redirect.startsWith('/')) {
        router.push(redirect);
      }
    }
  }, [isAuthenticated, searchParams, router]);

  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen bg-void-black text-white">
      {/* Header */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/5 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <span className="bg-gradient-to-r from-solana-purple to-solana-green bg-clip-text text-xl font-bold tracking-tight text-transparent">
            ozskr.ai
          </span>
          <WalletButton />
        </div>
      </header>

      {/* Hero */}
      <section className="flex min-h-screen flex-col items-center justify-center px-6 pt-16 text-center">
        <div className="mx-auto max-w-4xl space-y-8">
          <h1 className="bg-gradient-to-r from-solana-purple via-solana-green to-brick-gold bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-7xl">
            ozskr.ai
          </h1>
          <p className="mx-auto max-w-2xl text-xl italic text-muted-foreground sm:text-2xl">
            &ldquo;Pay no mind to the &lsquo;agents&rsquo; behind the emerald curtain.&rdquo;
          </p>
          <p className="mx-auto max-w-xl text-base text-muted-foreground">
            Create autonomous AI agents on Solana. Generate content, trade tokens, and build your on-chain presence.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            {isAuthenticated ? (
              <Button
                size="lg"
                className="bg-gradient-to-r from-solana-purple to-solana-green px-8 text-base hover:opacity-90"
                onClick={() => router.push('/dashboard')}
              >
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="lg"
                className="bg-gradient-to-r from-solana-purple to-solana-green px-8 text-base hover:opacity-90"
                onClick={() => setVisible(true)}
              >
                {connected ? 'Sign In' : 'Connect Wallet'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="lg"
              className="border border-white/10 px-8 text-base text-muted-foreground hover:text-white"
              onClick={scrollToFeatures}
            >
              See the Magic
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="mb-4 text-center text-3xl font-bold sm:text-4xl">
          Everything you need
        </h2>
        <p className="mx-auto mb-16 max-w-2xl text-center text-muted-foreground">
          A complete platform for creating, managing, and monetizing AI agents on Solana.
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Card
              key={feature.title}
              className="border-white/5 bg-white/[0.02] transition-transform duration-200 hover:scale-[1.02] animate-in fade-in"
              style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}
            >
              <CardContent className="flex flex-col gap-4 pt-6">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${feature.bg}`}>
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="mx-auto max-w-4xl px-6 py-24">
        <h2 className="mb-4 text-center text-3xl font-bold sm:text-4xl">
          How it works
        </h2>
        <p className="mx-auto mb-16 max-w-xl text-center text-muted-foreground">
          Get started in three simple steps.
        </p>

        <div className="relative flex flex-col items-center gap-12 md:flex-row md:justify-between md:gap-0">
          {/* Dashed connector line */}
          <div className="absolute left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] top-6 hidden border-t-2 border-dashed border-brick-gold/30 md:block" />

          {STEPS.map((step, i) => (
            <div key={step.label} className="relative z-10 flex flex-col items-center gap-3 text-center md:w-1/3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-solana-purple to-solana-green text-sm font-bold text-white">
                {i + 1}
              </div>
              <step.icon className="h-6 w-6 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-white">{step.label}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="mb-6 text-center text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Built with
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {TECH_STACK.map((tech) => (
            <span
              key={tech}
              className="rounded-full border border-white/10 px-4 py-1.5 text-sm text-muted-foreground"
            >
              {tech}
            </span>
          ))}
        </div>
      </section>

      {/* Waitlist */}
      <section className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
          Join the waitlist
        </h2>
        <p className="mb-8 text-muted-foreground">
          Be the first to know when ozskr.ai opens to the public.
        </p>
        <WaitlistForm />
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/daftpixie/ozskr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-white"
              aria-label="GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
            <a
              href="https://x.com/ozskr_ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-white"
              aria-label="Twitter"
            >
              <Twitter className="h-5 w-5" />
            </a>
          </div>

          <p className="text-sm text-muted-foreground">
            Built with Claude Code
          </p>

          <p className="text-sm text-muted-foreground">
            MIT License &copy; {new Date().getFullYear()} ozskr.ai
          </p>
        </div>
      </footer>
    </div>
  );
}
