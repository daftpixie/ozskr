/**
 * Platform Analytics Page
 * Cross-character analytics and platform-wide metrics
 */

'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  TrendingUp,
  Users,
  Zap,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useAnalyticsOverview } from '@/hooks/use-analytics';

// Lazy load heavy recharts components
const PlatformBarChart = dynamic(
  () => import('./analytics-charts').then(mod => ({ default: mod.PlatformBarChart })),
  { ssr: false }
);
const EngagementRateChart = dynamic(
  () => import('./analytics-charts').then(mod => ({ default: mod.EngagementRateChart })),
  { ssr: false }
);

const COLORS = {
  primary: '#9945FF',
  secondary: '#14F195',
  accent: '#F59E0B',
  grid: '#27272A',
};

export default function AnalyticsPage() {
  const { data: overview, isLoading } = useAnalyticsOverview();

  // Platform breakdown data (mock - would need platform-specific API endpoint)
  const platformData = useMemo(() => {
    if (!overview?.totalPosts) return [];
    return [
      { platform: 'Twitter', posts: Math.floor(overview.totalPosts * 0.5), color: COLORS.primary },
      { platform: 'Instagram', posts: Math.floor(overview.totalPosts * 0.3), color: COLORS.secondary },
      { platform: 'TikTok', posts: Math.floor(overview.totalPosts * 0.15), color: COLORS.accent },
      { platform: 'YouTube', posts: Math.floor(overview.totalPosts * 0.05), color: '#FF0000' },
    ];
  }, [overview]);

  // Engagement rate by platform (mock)
  const engagementRateData = useMemo(() => {
    return [
      { platform: 'Twitter', rate: 3.2 },
      { platform: 'Instagram', rate: 4.5 },
      { platform: 'TikTok', rate: 6.8 },
      { platform: 'YouTube', rate: 2.1 },
    ];
  }, []);

  // Calculate approval rate
  const approvalRate = useMemo(() => {
    if (!overview?.totalGenerations || !overview?.totalPosts) return 0;
    return ((overview.totalPosts / overview.totalGenerations) * 100).toFixed(1);
  }, [overview]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-card" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-card" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-lg bg-card" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Platform Analytics</h1>
        <p className="mt-2 text-muted-foreground">
          Performance insights across all your AI agents
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Agents
            </CardTitle>
            <Users className="h-4 w-4 text-solana-purple" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {overview?.totalCharacters || 0}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Active characters</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Generations
            </CardTitle>
            <Zap className="h-4 w-4 text-solana-green" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-solana-green">
              {overview?.totalGenerations || 0}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Content created</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Published
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-brick-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-brick-gold">
              {overview?.totalPosts || 0}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Posts live</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approval Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-solana-purple" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-solana-purple">{approvalRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">Moderation pass</p>
          </CardContent>
        </Card>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Avg Quality Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-solana-green">
              {overview?.avgQualityScore
                ? (overview.avgQualityScore * 100).toFixed(1)
                : '—'}
              {overview?.avgQualityScore && '%'}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Across all agents</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-brick-gold">
              {overview?.totalEngagement
                ? Object.values(overview.totalEngagement).reduce(
                    (sum, val) => sum + (typeof val === 'number' ? val : 0),
                    0
                  )
                : 0}
            </div>
            <div className="mt-2 space-y-1">
              {overview?.totalEngagement &&
                Object.entries(overview.totalEngagement).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground capitalize">{key}</span>
                    <span className="font-medium text-white">{value}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Content Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-solana-green" />
                  <span className="text-sm text-muted-foreground">Approved</span>
                </div>
                <Badge variant="secondary" className="bg-solana-green/20 text-solana-green">
                  {overview?.totalPosts || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-muted-foreground">Rejected</span>
                </div>
                <Badge variant="secondary" className="bg-destructive/20 text-destructive">
                  {overview?.totalGenerations && overview?.totalPosts
                    ? overview.totalGenerations - overview.totalPosts
                    : 0}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Posts by Platform */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-solana-purple" />
              Posts by Platform
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PlatformBarChart data={platformData} />
          </CardContent>
        </Card>

        {/* Engagement Rate by Platform */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-solana-green" />
              Engagement Rate by Platform
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EngagementRateChart data={engagementRateData} />
          </CardContent>
        </Card>
      </div>

      {/* Best Posting Times Placeholder */}
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brick-gold" />
            Best Posting Times
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brick-gold/10">
              <BarChart3 className="h-10 w-10 text-brick-gold" />
            </div>
            <h3 className="mt-6 text-lg font-medium text-white">
              Posting Time Analysis
            </h3>
            <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
              Heatmap showing optimal posting times based on historical engagement
              patterns will be available once sufficient data is collected.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
