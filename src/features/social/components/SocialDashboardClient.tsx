'use client';

/**
 * SocialDashboardClient
 * Client-side orchestrator for the social graph dashboard.
 * Handles character selection and renders the Tapestry social panels.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useCharacters } from '@/hooks/use-characters';
import { AgentSocialProfileCard } from './AgentSocialProfileCard';
import { SocialContentFeed } from './SocialContentFeed';
import { SocialGraphDisplay } from './SocialGraphDisplay';
import { Skeleton } from '@/components/ui/skeleton';
import { Bot, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/features/wallet/store';

interface Character {
  id: string;
  name: string;
  walletAddress: string;
}

interface BiоCheckResult {
  compliant: boolean;
  bio: string | null;
  message: string;
}

export function SocialDashboardClient() {
  const { data, isLoading, isError } = useCharacters({ limit: 50 });
  const characters: Character[] = (data?.data ?? []).map((c: { id: string; name: string; walletAddress?: string }) => ({
    id: c.id,
    name: c.name,
    walletAddress: c.walletAddress ?? '',
  }));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const token = useAuthStore((s) => s.token);
  const { data: bioCheck } = useQuery<BiоCheckResult>({
    queryKey: ['twitter-bio-check'],
    queryFn: async () => {
      const res = await fetch('/api/social/oauth/twitter/bio-check', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error('Failed to fetch bio check');
      }
      return res.json() as Promise<BiоCheckResult>;
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Auto-select first character
  const effectiveId = selectedId ?? characters[0]?.id ?? null;
  const selectedChar = characters.find((c) => c.id === effectiveId) ?? null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-lg bg-zinc-800" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-xl bg-zinc-800" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center">
        <p className="text-sm text-red-400">Failed to load agents. Please refresh the page.</p>
      </div>
    );
  }

  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 py-16 text-center">
        <Network className="h-10 w-10 text-zinc-600" />
        <div>
          <p className="font-medium text-zinc-50">No agents yet</p>
          <p className="mt-1 text-sm text-zinc-400">
            Create an AI agent to get started with on-chain social identities.
          </p>
        </div>
        <Link
          href="/agents/create"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#9945FF] to-[#14F195] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Bot className="h-4 w-4" />
          Create Agent
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bio compliance warning */}
      {bioCheck?.compliant === false && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          <strong>X Bio Compliance Warning:</strong> Your connected X account bio must contain
          &ldquo;Automated by ozskr.ai&rdquo; per X platform policy (Feb 2026). Agent posting may be
          restricted without this.{' '}
          <a
            href="https://twitter.com/settings/profile"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-300"
          >
            Update your bio
          </a>
        </div>
      )}

      {/* Character selector chips */}
      {characters.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {characters.map((char) => (
            <button
              key={char.id}
              onClick={() => setSelectedId(char.id)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                effectiveId === char.id
                  ? 'border-transparent bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-zinc-50'
              )}
            >
              {char.name}
            </button>
          ))}
        </div>
      )}

      {/* Social panels */}
      {effectiveId && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Profile card — full width on mobile, 1 col on desktop */}
          <div className="lg:col-span-1">
            <AgentSocialProfileCard
              characterId={effectiveId}
              walletAddress={selectedChar?.walletAddress}
            />
          </div>

          {/* Feed + Graph — 2 cols on desktop */}
          <div className="space-y-6 lg:col-span-2">
            <SocialContentFeed characterId={effectiveId} />
            <SocialGraphDisplay characterId={effectiveId} />
          </div>
        </div>
      )}
    </div>
  );
}
