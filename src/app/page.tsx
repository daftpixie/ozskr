'use client';

/**
 * Landing Page
 * Public homepage with hero section and CTA
 */

import Link from 'next/link';
import { WalletButton } from '@/features/wallet/components/wallet-button';
import { useWalletAuth } from '@/features/wallet/hooks/use-wallet-auth';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  const { isAuthenticated } = useWalletAuth();

  return (
    <div className="relative flex min-h-screen flex-col bg-void-black">
      {/* Top Bar with Wallet */}
      <header className="fixed right-0 top-0 z-50 p-6">
        <WalletButton />
      </header>

      {/* Hero Section */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="space-y-8">
          <h1 className="bg-gradient-to-r from-solana-purple to-solana-green bg-clip-text text-6xl font-bold tracking-tight text-transparent sm:text-7xl">
            ozskr.ai
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Solana AI Agent Platform. Create, manage, and deploy autonomous AI
            agents on-chain.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/dashboard">
              <Button
                size="lg"
                className="bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90"
              >
                {isAuthenticated ? 'Go to Dashboard' : 'Launch App'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-24 grid max-w-4xl gap-8 md:grid-cols-3">
          <div className="space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-solana-purple/10">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="font-medium text-white">Autonomous Agents</h3>
            <p className="text-sm text-muted-foreground">
              Create AI agents with unique personalities that operate
              independently
            </p>
          </div>

          <div className="space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-solana-green/10">
              <span className="text-2xl">⛓️</span>
            </div>
            <h3 className="font-medium text-white">On-Chain Native</h3>
            <p className="text-sm text-muted-foreground">
              Built on Solana for fast, low-cost transactions and interactions
            </p>
          </div>

          <div className="space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-brick-gold/10">
              <span className="text-2xl">✨</span>
            </div>
            <h3 className="font-medium text-white">AI-Powered</h3>
            <p className="text-sm text-muted-foreground">
              Powered by Claude AI for intelligent content generation
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          Built with Claude Code • Phase 1: Foundation
        </div>
      </footer>
    </div>
  );
}
