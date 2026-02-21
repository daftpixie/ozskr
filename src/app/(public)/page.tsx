'use client';

/**
 * Landing Page
 * Public marketing page with hero, features, how it works, and waitlist
 * Header and footer are provided by the (public) layout
 */

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useWalletAuth } from '@/features/wallet/hooks/use-wallet-auth';
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
  Shield,
  AlertTriangle,
  FileDown,
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
    description: 'Watch your imagination come to life with AI-powered tweets, threads, and visual content.',
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
    description: 'Collect $HOPE tokens as your agents grow and your community flourishes.',
    color: 'text-solana-green',
    bg: 'bg-solana-green/10',
  },
  {
    icon: Code,
    title: 'Own Your Story',
    description: 'Open source, transparent, yours. We\'re not hiding the AI behind a curtain.',
    color: 'text-brick-gold',
    bg: 'bg-brick-gold/10',
  },
] as const;

const STEPS = [
  { icon: Wallet, label: 'Connect', description: 'Link your Solana wallet' },
  { icon: Bot, label: 'Create', description: 'Design your AI agent' },
  { icon: Rocket, label: 'Publish', description: 'Share your magic with the world' },
] as const;

const TECH_STACK = ['Claude AI', 'Solana', 'Next.js', 'TypeScript', 'Supabase'] as const;

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

  const accessRestricted = searchParams.get('access') === 'restricted';

  // Handle redirect after auth
  useEffect(() => {
    if (isAuthenticated) {
      const redirect = searchParams.get('redirect');
      if (redirect && redirect.startsWith('/')) {
        router.push(redirect);
      }
    }
  }, [isAuthenticated, searchParams, router]);

  const scrollToWaitlist = () => {
    document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative">
      {/* Access restricted banner */}
      {accessRestricted && (
        <div className="fixed left-0 right-0 top-16 z-40 border-b border-brick-gold/20 bg-brick-gold/10 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-brick-gold" />
            <p className="text-sm text-brick-gold">
              Access is currently limited to approved testers. Join the waitlist below and we&apos;ll notify you when spots open.
            </p>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-16 text-center pattern-bricks">
        <div className="mx-auto max-w-4xl space-y-8">
          <h1 className="font-display bg-gradient-to-r from-solana-purple via-solana-green to-brick-gold bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-7xl animate-fade-in-up">
            ozskr.ai
          </h1>
          <p className="mx-auto max-w-2xl text-xl font-medium text-white sm:text-2xl animate-fade-in-up stagger-1">
            Your AI agents. Your rules. On-chain.
          </p>
          <p className="mx-auto max-w-xl text-base text-muted-foreground animate-fade-in-up stagger-2">
            Create AI-powered digital influencers. Built on Solana. Powered by imagination.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center animate-fade-in-up stagger-3">
            {isAuthenticated ? (
              <Button
                size="lg"
                className="bg-gradient-to-r from-solana-purple to-solana-green px-8 text-base hover:opacity-90"
                onClick={() => router.push('/dashboard')}
              >
                Enter the Emerald City
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  variant="ghost"
                  className="border border-white/10 px-8 text-base text-muted-foreground hover:text-white"
                  onClick={scrollToWaitlist}
                >
                  Join Waitlist
                </Button>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-solana-purple to-solana-green px-8 text-base hover:opacity-90"
                  onClick={() => setVisible(true)}
                >
                  {connected ? 'Sign In' : 'Connect Wallet'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="font-display mb-4 text-center text-3xl font-bold sm:text-4xl">
          Your arsenal of magic
        </h2>
        <p className="mx-auto mb-16 max-w-2xl text-center text-muted-foreground">
          Everything you need to bring your digital influencers to life on Solana.
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Card
              key={feature.title}
              className="border-white/5 bg-white/[0.02] transition-all duration-200 hover:scale-[1.02] hover:glow-emerald animate-in fade-in"
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

      {/* On-Chain Proof */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-lg border border-solana-purple/20 bg-solana-purple/5 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-solana-purple/10">
            <Shield className="h-6 w-6 text-solana-purple" />
          </div>
          <h2 className="font-display mb-2 text-2xl font-bold">On-Chain Proof</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Agent delegation is enforced on-chain. TEE-signed transactions are verifiable by anyone.
          </p>
          <a
            href="https://explorer.solana.com/?cluster=devnet"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-solana-purple transition-colors hover:text-solana-green"
          >
            View on Solana Explorer (devnet)
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </section>

      {/* Whitepaper Download */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-lg border border-brick-gold/20 bg-brick-gold/5 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brick-gold/10">
            <FileDown className="h-6 w-6 text-brick-gold" />
          </div>
          <h2 className="font-display mb-2 text-2xl font-bold">Whitepaper</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            The full technical specification. Architecture, market analysis, and the road ahead.
          </p>
          <a
            href="/ozskr-whitepaper-v1.pdf"
            download
            className="inline-flex items-center gap-2 rounded-lg border border-brick-gold/30 bg-brick-gold/10 px-6 py-2.5 text-sm font-medium text-brick-gold transition-all hover:bg-brick-gold/20 hover:border-brick-gold/50"
          >
            <FileDown className="h-4 w-4" />
            Download PDF
          </a>
        </div>
      </section>

      {/* How It Works */}
      <section className="mx-auto max-w-4xl px-6 py-24">
        <h2 className="font-display mb-4 text-center text-3xl font-bold sm:text-4xl">
          Follow the road
        </h2>
        <p className="mx-auto mb-16 max-w-xl text-center text-muted-foreground">
          Your journey from Kansas to the Emerald City.
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
      <section id="waitlist" className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h2 className="font-display mb-4 text-3xl font-bold sm:text-4xl">
          Claim your spot on the road
        </h2>
        <p className="mb-8 text-muted-foreground">
          Be among the first to enter the Emerald City.
        </p>
        <WaitlistForm source="landing" />
      </section>
    </div>
  );
}
