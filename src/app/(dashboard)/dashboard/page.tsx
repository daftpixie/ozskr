'use client';

/**
 * Dashboard Home Page
 * Main dashboard overview with live wallet stats and quick actions
 */

import { useMemo } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import { useWalletAuth } from '@/features/wallet/hooks/use-wallet-auth';
import { useSolBalance } from '@/hooks/use-sol-balance';
import { useCharacters } from '@/hooks/use-characters';
import { useAnalyticsOverview } from '@/hooks/use-analytics';
import { useContentSchedules } from '@/hooks/use-schedules';
import { timeAgo } from '@/lib/utils/time';

export default function DashboardPage() {
  const { user } = useWalletAuth();
  const { balance, isLoading: balanceLoading } = useSolBalance();
  const { data: charactersData, isLoading: charactersLoading } = useCharacters();
  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview();
  const { data: schedulesData } = useContentSchedules();

  const truncatedAddress = user?.walletAddress
    ? `${user.walletAddress.slice(0, 4)}...${user.walletAddress.slice(-4)}`
    : '';

  const characters = useMemo(() => charactersData?.data || [], [charactersData]);
  const schedules = useMemo(() => schedulesData?.data || [], [schedulesData]);

  // Find next scheduled run
  const nextScheduledRun = useMemo(() => {
    if (!schedules.length) return null;
    const activeSchedules = schedules.filter(s => s.isActive);
    if (!activeSchedules.length) return null;

    return activeSchedules.reduce((earliest, current) => {
      const currentTime = new Date(current.nextRunAt).getTime();
      const earliestTime = new Date(earliest.nextRunAt).getTime();
      return currentTime < earliestTime ? current : earliest;
    });
  }, [schedules]);

  // Calculate time until next run (memoized with explicit dependencies)
  const timeUntilNextRun = useMemo(() => {
    if (!nextScheduledRun) return null;

    // Only called inside useMemo, so it's pure with respect to React rendering
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const nextRunTime = new Date(nextScheduledRun.nextRunAt).getTime();
    const diff = nextRunTime - now;

    if (diff < 0) return 'Overdue';
    if (diff < 60000) return 'Less than a minute';

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }, [nextScheduledRun]);

  // Recent activity - combine characters and their last generation time
  const recentActivity = useMemo(() => {
    return characters
      .filter(c => c.lastGeneratedAt)
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
        <h1 className="text-3xl font-bold text-white">
          Welcome{truncatedAddress ? `, ${truncatedAddress}` : ''}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Your AI agent command center
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
                <span className="text-solana-green">
                  {balance.toFixed(4)}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {balance !== null ? 'SOL on devnet' : 'Connect wallet to view'}
            </p>
          </CardContent>
        </Card>

        {/* Your Agents Card */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Agents</CardTitle>
            <Bot className="h-4 w-4 text-solana-purple" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {charactersLoading ? (
                <span className="inline-block h-7 w-12 animate-pulse rounded bg-muted" />
              ) : (
                characters.length
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {characters.length === 1 ? 'agent created' : 'agents created'}
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
                overview?.totalGenerations || 0
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
                overview?.totalPosts || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">Posts live</p>
          </CardContent>
        </Card>
      </div>

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
                      {characters.find(c => c.id === nextScheduledRun.characterId)?.name || 'Unknown Agent'}
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
                  No scheduled runs yet
                </p>
                <Link href="/dashboard/calendar">
                  <Button variant="outline" size="sm" className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Schedule
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
                {recentActivity.map((character) => (
                  <div
                    key={character.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-solana-purple/10">
                        <Bot className="h-4 w-4 text-solana-purple" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {character.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Generated content
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(character.lastGeneratedAt!)}
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
                  No activity yet
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Getting Started Section (only show if no agents) */}
      {characters.length === 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium text-white">
                Create Your First AI Agent
              </h3>
              <p className="text-sm text-muted-foreground">
                Get started by creating your first autonomous AI agent. Define its
                personality, goals, and let it generate content on Solana.
              </p>
              <Link href="/agents/create">
                <Button
                  variant="outline"
                  className="mt-2 border-solana-purple/30 hover:border-solana-purple"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Agent
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions (show if has agents) */}
      {characters.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/agents/create">
            <Card className="cursor-pointer border-border bg-card transition-colors hover:border-solana-purple hover:bg-card/80">
              <CardContent className="flex items-center gap-3 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-solana-purple/10">
                  <Plus className="h-5 w-5 text-solana-purple" />
                </div>
                <div>
                  <p className="font-medium text-white">Create Agent</p>
                  <p className="text-xs text-muted-foreground">New AI character</p>
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
                  <p className="text-xs text-muted-foreground">Scheduled content</p>
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
                  <p className="text-xs text-muted-foreground">Performance data</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}
    </div>
  );
}
