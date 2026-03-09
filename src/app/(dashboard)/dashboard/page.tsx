'use client';

/**
 * Dashboard Home Page
 * Shows onboarding view for new users, active dashboard for existing agents.
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useMintAgentNFT } from '@/hooks/use-agent-nft';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  TrendingUp,
  Activity,
  Plus,
  Wallet,
  CheckCircle,
  Sparkles,
  Clock,
  Calendar,
  ExternalLink,
  Copy,
  Receipt,
} from 'lucide-react';
import { useWalletAuth } from '@/features/wallet/hooks/use-wallet-auth';
import { useSolBalance } from '@/hooks/use-sol-balance';
import { useCharacters } from '@/hooks/use-characters';
import { useAnalyticsOverview } from '@/hooks/use-analytics';
import { useContentSchedules } from '@/hooks/use-schedules';
import { useAgentTransactions } from '@/hooks/use-agent-transactions';
import { timeAgo } from '@/lib/utils/time';
import { StatsBar } from '@/features/gamification/components/stats-bar';
import { DelegationCard } from '@/features/agents/components/delegation-card';
import { createSupabaseClient } from '@/lib/api/supabase';
import { useAuthStore } from '@/features/wallet/store';
import { getExplorerUrl } from '@/lib/solana/network-config';
import { cn } from '@/lib/utils';
import type { CharacterResponse } from '@/types/schemas';
import type { GenerationType, ModerationStatus } from '@/types/database';

// =============================================================================
// Recent Generations hook
// =============================================================================

interface RecentGeneration {
  id: string;
  generation_type: GenerationType;
  output_text: string | null;
  output_url: string | null;
  moderation_status: ModerationStatus;
  created_at: string;
}

function useRecentGenerations(characterId: string | undefined) {
  return useQuery({
    queryKey: ['recent-generations', characterId],
    queryFn: async () => {
      if (!characterId) return [];
      const supabase = createSupabaseClient();
      const { data, error } = await supabase
        .from('content_generations')
        .select('id, generation_type, output_text, output_url, moderation_status, created_at')
        .eq('character_id', characterId)
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return (data ?? []) as RecentGeneration[];
    },
    enabled: !!characterId,
  });
}

// =============================================================================
// Dashboard Skeleton
// =============================================================================

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-[#27272A]" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-[#27272A]" />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Onboarding View
// =============================================================================

function OnboardingView() {
  const steps = [
    { label: 'STEP 1', title: 'Name & Persona', desc: 'Define your agent identity and voice.' },
    { label: 'STEP 2', title: 'Connect Social', desc: 'Link Twitter, Instagram, and more.' },
    { label: 'STEP 3', title: 'Fund & Go', desc: 'Add SOL and start generating content.' },
  ];

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-lg rounded-xl border border-[#27272A] bg-[#18181B] p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-white">
          Welcome to the Emerald City
        </h1>
        <p className="mt-3 text-sm text-[#71717A]">
          You&apos;ve always had the power — let&apos;s build your AI agent and start creating.
        </p>

        <Link href="/agents/create" className="mt-6 block">
          <Button
            className={cn(
              'h-12 w-full rounded-lg px-8 font-semibold text-[#0A0A0B]',
              'bg-gradient-to-r from-[#9945FF] to-[#14F195]',
              'hover:opacity-90',
            )}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Your Agent
          </Button>
        </Link>

        <div className="mt-8 space-y-4 text-left">
          {steps.map((step) => (
            <div key={step.label} className="flex gap-4">
              <div className="w-20 shrink-0 text-xs font-semibold text-[#F59E0B]">
                {step.label}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{step.title}</p>
                <p className="mt-0.5 text-xs text-[#71717A]">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Agent Status Card (Fix 6 Part A)
// =============================================================================

interface AgentStatusCardProps {
  character: CharacterResponse;
}

function AgentStatusCard({ character }: AgentStatusCardProps) {
  const { mutate: mintNFT, isPending: isMinting, error: mintMutationError } = useMintAgentNFT(character.id);
  const mintError = mintMutationError?.message ?? null;
  const [copied, setCopied] = useState(false);

  const handleCopyMint = useCallback(async () => {
    if (!character.nftMintAddress) return;
    try {
      await navigator.clipboard.writeText(character.nftMintAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  }, [character.nftMintAddress]);

  const statusColors: Record<string, string> = {
    active: 'bg-[#14F195]/10 text-[#14F195] border-[#14F195]/20',
    paused: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20',
    draft: 'bg-[#71717A]/10 text-[#71717A] border-[#71717A]/20',
    archived: 'bg-[#F87171]/10 text-[#F87171] border-[#F87171]/20',
  };

  return (
    <Card className="border-[#27272A] bg-[#18181B]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-white">Agent Status</CardTitle>
        <Bot className="h-4 w-4 text-[#9945FF]" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <span className="truncate text-lg font-bold text-white">{character.name}</span>
          <Badge
            className={cn(
              'shrink-0 border text-xs',
              statusColors[character.status] ?? statusColors['draft'],
            )}
          >
            {character.status.charAt(0).toUpperCase() + character.status.slice(1)}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-[#71717A]">
          ATOM Score:{' '}
          {character.reputationScore ? (
            <span className="text-[#F59E0B]">{character.reputationScore}</span>
          ) : (
            <span className="text-[#3F3F46]">Not rated</span>
          )}
        </p>

        {/* NFT identity section */}
        <div className="mt-3 border-t border-[#27272A] pt-3">
          {character.nftMintAddress ? (
            <>
              <p className="text-xs text-[#71717A]">
                On-Chain Identity:{' '}
                <span className="text-[#14F195]">Registered</span>
              </p>
              <div className="mt-1 flex items-center gap-1">
                <span className="font-mono text-xs text-[#71717A]">
                  {character.nftMintAddress.slice(0, 4)}...{character.nftMintAddress.slice(-4)}
                </span>
                <button
                  type="button"
                  onClick={handleCopyMint}
                  aria-label="Copy mint address"
                  className="text-[#71717A] hover:text-white transition-colors"
                >
                  <Copy className="h-3 w-3" />
                </button>
                {copied && <span className="text-xs text-[#14F195]">Copied</span>}
              </div>
              <a
                href={`https://explorer.solana.com/address/${character.nftMintAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-center gap-1 text-xs text-[#71717A] hover:text-white transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                View on Solana Explorer
              </a>
              <a
                href={`https://8004market.io/agent/${character.nftMintAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-center gap-1 text-xs text-[#71717A] hover:text-white transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                View on 8004market.io
              </a>
            </>
          ) : (
            <>
              <p className="text-xs text-[#71717A]">
                On-Chain Identity:{' '}
                <span className="text-[#3F3F46]">Not registered</span>
              </p>
              {mintError && (
                <p className="mt-1 text-xs text-[#F87171]">{mintError}</p>
              )}
              <button
                type="button"
                onClick={() => mintNFT()}
                disabled={isMinting}
                className={cn(
                  'mt-2 w-full flex items-center justify-center gap-2 rounded-md',
                  'bg-[#F59E0B] px-3 py-2 text-sm font-medium text-[#0A0A0B]',
                  'hover:bg-[#FBBF24] disabled:opacity-50 transition-colors',
                )}
              >
                {isMinting ? 'Registering...' : 'Register in Agent Registry'}
              </button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Recent Creations Section (Fix 4)
// =============================================================================

function StatusBadge({ status }: { status: ModerationStatus }) {
  const map: Record<string, { label: string; className: string }> = {
    approved: { label: 'Approved', className: 'bg-[#14F195]/10 text-[#14F195] border-[#14F195]/20' },
    pending: { label: 'Pending', className: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20' },
    processing: { label: 'Processing', className: 'bg-[#9945FF]/10 text-[#9945FF] border-[#9945FF]/20' },
    rejected: { label: 'Rejected', className: 'bg-[#F87171]/10 text-[#F87171] border-[#F87171]/20' },
    flagged: { label: 'Flagged', className: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20' },
  };
  const config = map[status] ?? { label: status, className: 'bg-[#27272A] text-[#71717A]' };
  return (
    <Badge className={cn('border text-xs', config.className)}>{config.label}</Badge>
  );
}

function RecentCreationsSection({ characterId }: { characterId: string }) {
  const { data: generations, isLoading } = useRecentGenerations(characterId);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Recent Creations</h2>
        <Link href="/content" className="text-xs text-[#71717A] hover:text-white transition-colors">
          View All
        </Link>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-lg bg-[#27272A]" />
            ))
          : !generations || generations.length === 0
          ? (
            <div className="col-span-3 flex flex-col items-center justify-center rounded-lg border border-[#27272A] py-8 text-center">
              <Sparkles className="h-8 w-8 text-[#3F3F46]" />
              <p className="mt-2 text-sm text-[#71717A]">No content yet</p>
              <Link href="/content">
                <Button variant="outline" size="sm" className="mt-3">
                  Generate Content
                </Button>
              </Link>
            </div>
          )
          : generations.map((gen) => (
              <div
                key={gen.id}
                className="rounded-lg border border-[#27272A] bg-[#18181B] p-4"
              >
                {gen.output_url && gen.generation_type === 'image' ? (
                  <img
                    src={gen.output_url}
                    alt="Generated content"
                    className="mb-3 h-24 w-full rounded object-cover"
                  />
                ) : (
                  <p className="mb-3 line-clamp-3 text-sm text-white">
                    {gen.output_text ?? 'Content generated'}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <StatusBadge status={gen.moderation_status} />
                  <span className="text-xs text-[#71717A]">
                    {timeAgo(gen.created_at)}
                  </span>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}

// =============================================================================
// Transaction History Card
// =============================================================================

/** Human-readable labels for service IDs logged by services.ts */
const SERVICE_LABELS: Record<string, string> = {
  'image-generate': 'Image Generate',
  'image-generate-pro': 'Image Generate (Pro)',
  'image-edit': 'Image Edit',
  'text-generate': 'Text Generate',
};

function ServiceStatusBadge({ success }: { success: boolean }) {
  return success ? (
    <Badge className="border border-[#14F195]/20 bg-[#14F195]/10 text-xs text-[#14F195]">
      Success
    </Badge>
  ) : (
    <Badge className="border border-[#F87171]/20 bg-[#F87171]/10 text-xs text-[#F87171]">
      Failed
    </Badge>
  );
}

function TransactionHistoryCard({ characterId }: { characterId: string }) {
  const { data: transactions = [], isLoading } = useAgentTransactions(characterId);

  return (
    <div className="rounded-xl border border-[#27272A] bg-[#18181B] p-5">
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-[#F59E0B]" />
          <h2 className="text-sm font-semibold text-white">Transaction History</h2>
        </div>
        <a
          href={`https://solscan.io/account/${characterId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[#F59E0B] transition-colors hover:text-[#FBBF24]"
        >
          View All
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Body */}
      <div className="mt-4" aria-live="polite" aria-label="Recent agent transactions">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-[#27272A]" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#71717A]">
            No transactions yet. Once your agent starts generating content, you&apos;ll see the
            payment history here.
          </p>
        ) : (
          <ul className="divide-y divide-[#27272A]">
            {transactions.map((tx) => {
              const label = SERVICE_LABELS[tx.service_id] ?? tx.service_id;
              const explorerUrl = getExplorerUrl(tx.id);

              return (
                <li key={tx.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  {/* Left: service name + timestamp */}
                  <div className="min-w-0">
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm font-medium text-white transition-colors hover:text-[#9945FF]"
                    >
                      <span className="truncate">{label}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-[#71717A]" />
                    </a>
                    <p className="mt-0.5 text-xs text-[#71717A]">{timeAgo(tx.created_at)}</p>
                  </div>

                  {/* Right: amount + status */}
                  <div className="ml-4 flex shrink-0 flex-col items-end gap-1">
                    <span className="font-mono text-sm font-semibold text-[#F87171]">
                      -{tx.price_usdc.toFixed(4)} USDC
                    </span>
                    <ServiceStatusBadge success={tx.success} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Active Dashboard View
// =============================================================================

interface ActiveDashboardViewProps {
  character: CharacterResponse;
}

function ActiveDashboardView({ character }: ActiveDashboardViewProps) {
  const { user } = useWalletAuth();
  const { balance, isLoading: balanceLoading } = useSolBalance();
  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview();
  const { data: schedulesData } = useContentSchedules();
  const { data: charactersData } = useCharacters();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const truncatedAddress = user?.walletAddress
    ? `${user.walletAddress.slice(0, 4)}...${user.walletAddress.slice(-4)}`
    : '';

  const characters = useMemo(() => charactersData?.data ?? [], [charactersData]);
  const schedules = useMemo(() => schedulesData?.data ?? [], [schedulesData]);

  const nextScheduledRun = useMemo(() => {
    const active = schedules.filter((s) => s.isActive);
    if (!active.length) return null;
    return active.reduce((earliest, current) =>
      new Date(current.nextRunAt).getTime() < new Date(earliest.nextRunAt).getTime()
        ? current
        : earliest,
    );
  }, [schedules]);

  const timeUntilNextRun = useMemo(() => {
    if (!nextScheduledRun) return null;
    const diff = new Date(nextScheduledRun.nextRunAt).getTime() - now;
    if (diff < 0) return 'Overdue';
    if (diff < 60000) return 'Less than a minute';
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }, [nextScheduledRun, now]);

  const recentActivity = useMemo(() => {
    return characters
      .filter((c) => c.lastGeneratedAt)
      .sort((a, b) => {
        const timeA = new Date(a.lastGeneratedAt!).getTime();
        const timeB = new Date(b.lastGeneratedAt!).getTime();
        return timeB - timeA;
      })
      .slice(0, 5);
  }, [characters]);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-white">
          Welcome{truncatedAddress ? `, ${truncatedAddress}` : ''}
        </h1>
        <p className="mt-2 text-muted-foreground">The Emerald City is yours to explore</p>
      </div>

      {/* Gamification Stats Bar */}
      <StatsBar />

      {/* Stats Grid — Agent Status replaces "Your Agents" count */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Agent Status Card */}
        <AgentStatusCard character={character} />

        {/* SOL Balance Card */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SOL Balance</CardTitle>
            <Wallet className="h-4 w-4 text-solana-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {balanceLoading ? (
                <span className="inline-block h-7 w-20 animate-pulse rounded bg-muted" />
              ) : balance !== null ? (
                <span className="text-solana-green">{balance.toFixed(4)}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {balance !== null ? 'SOL' : 'Connect wallet to view'}
            </p>
          </CardContent>
        </Card>

        {/* Total Generations Card */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Generations</CardTitle>
            <Sparkles className="h-4 w-4 text-solana-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {overviewLoading ? (
                <span className="inline-block h-7 w-12 animate-pulse rounded bg-muted" />
              ) : (
                overview?.totalGenerations ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">Content created</p>
          </CardContent>
        </Card>

        {/* Total Published Card */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Published</CardTitle>
            <CheckCircle className="h-4 w-4 text-brick-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {overviewLoading ? (
                <span className="inline-block h-7 w-12 animate-pulse rounded bg-muted" />
              ) : (
                overview?.totalPosts ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">Posts live</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Delegation */}
      <DelegationCard characterId={character.id} characterName={character.name} />

      {/* Recent Creations (Fix 4) */}
      <RecentCreationsSection characterId={character.id} />

      {/* Transaction History */}
      <TransactionHistoryCard characterId={character.id} />

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Next Scheduled Run */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-solana-purple" />
              Next Scheduled Run
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextScheduledRun ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">
                      {characters.find((c) => c.id === nextScheduledRun.characterId)?.name ??
                        'Unknown Agent'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {nextScheduledRun.contentType} generation
                    </p>
                  </div>
                  <Badge className="bg-solana-purple/20 text-solana-purple">
                    {timeUntilNextRun}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(nextScheduledRun.nextRunAt).toLocaleString()}
                </div>
                <Link href="/dashboard/calendar">
                  <Button variant="outline" size="sm" className="w-full">
                    View Calendar
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <Clock className="h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-center text-sm text-muted-foreground">
                  The road ahead is clear
                </p>
                <Link href="/dashboard/calendar">
                  <Button variant="outline" size="sm" className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Set the Pace
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-solana-green" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((char) => (
                  <div
                    key={char.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-solana-purple/10">
                        <Bot className="h-4 w-4 text-solana-purple" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{char.name}</p>
                        <p className="text-xs text-muted-foreground">Generated content</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(char.lastGeneratedAt!)}
                    </span>
                  </div>
                ))}
                <Link href="/analytics">
                  <Button variant="outline" size="sm" className="w-full">
                    View Analytics
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <Activity className="h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-center text-sm text-muted-foreground">
                  Your story is just beginning
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/agents/create">
          <Card className="cursor-pointer border-border bg-card transition-colors hover:border-solana-purple hover:bg-card/80">
            <CardContent className="flex items-center gap-3 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-solana-purple/10">
                <Plus className="h-5 w-5 text-solana-purple" />
              </div>
              <div>
                <p className="font-medium text-white">Create Agent</p>
                <p className="text-xs text-muted-foreground">Bring a new character to life</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/calendar">
          <Card className="cursor-pointer border-border bg-card transition-colors hover:border-solana-green hover:bg-card/80">
            <CardContent className="flex items-center gap-3 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-solana-green/10">
                <Calendar className="h-5 w-5 text-solana-green" />
              </div>
              <div>
                <p className="font-medium text-white">View Calendar</p>
                <p className="text-xs text-muted-foreground">Plan your journey ahead</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/analytics">
          <Card className="cursor-pointer border-border bg-card transition-colors hover:border-brick-gold hover:bg-card/80">
            <CardContent className="flex items-center gap-3 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brick-gold/10">
                <TrendingUp className="h-5 w-5 text-brick-gold" />
              </div>
              <div>
                <p className="font-medium text-white">View Analytics</p>
                <p className="text-xs text-muted-foreground">See how your agents perform</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page
// =============================================================================

export default function DashboardPage() {
  const { data: charactersData, isLoading: charactersLoading } = useCharacters();
  const characters = useMemo(() => charactersData?.data ?? [], [charactersData]);
  const hasAgent = characters.length > 0;
  const character = characters[0] ?? null;

  if (charactersLoading) return <DashboardSkeleton />;
  if (!hasAgent) return <OnboardingView />;
  return <ActiveDashboardView character={character} />;
}
