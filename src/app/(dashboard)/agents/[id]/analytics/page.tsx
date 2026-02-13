'use client';

/**
 * Agent Analytics Page
 * Time-series analytics and performance metrics for a specific character
 */

import { use, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, Calendar, Image, Video, FileText } from 'lucide-react';
import { useAnalyticsSummary, useAnalyticsHistory } from '@/hooks/use-analytics';
import { useCharacter } from '@/hooks/use-characters';

// Lazy load heavy recharts components
const GenerationsChart = dynamic(
  () => import('./analytics-charts').then(mod => ({ default: mod.GenerationsChart })),
  { ssr: false }
);
const EngagementChart = dynamic(
  () => import('./analytics-charts').then(mod => ({ default: mod.EngagementChart })),
  { ssr: false }
);
const QualityScoreChart = dynamic(
  () => import('./analytics-charts').then(mod => ({ default: mod.QualityScoreChart })),
  { ssr: false }
);
const ContentTypeChart = dynamic(
  () => import('./analytics-charts').then(mod => ({ default: mod.ContentTypeChart })),
  { ssr: false }
);

interface AgentAnalyticsPageProps {
  params: Promise<{ id: string }>;
}

const COLORS = {
  primary: '#9945FF',
  secondary: '#14F195',
  accent: '#F59E0B',
  grid: '#27272A',
};

export default function AgentAnalyticsPage({ params }: AgentAnalyticsPageProps) {
  const { id } = use(params);
  const { data: character, isLoading: characterLoading } = useCharacter(id);
  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary(id);
  const { data: history, isLoading: historyLoading } = useAnalyticsHistory(id, {
    granularity: 'day',
  });

  // Prepare time-series data
  const generationsChartData = useMemo(() => {
    if (!history?.history) return [];
    return history.history.map(snapshot => ({
      date: new Date(snapshot.snapshotDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      generations: snapshot.totalGenerations,
    }));
  }, [history]);

  const engagementChartData = useMemo(() => {
    if (!history?.history) return [];
    return history.history.map(snapshot => {
      const engagement = snapshot.totalEngagement as Record<string, number>;
      return {
        date: new Date(snapshot.snapshotDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        likes: engagement.likes || 0,
        comments: engagement.comments || 0,
        shares: engagement.shares || 0,
      };
    });
  }, [history]);

  const qualityScoreChartData = useMemo(() => {
    if (!history?.history) return [];
    return history.history
      .filter(snapshot => snapshot.avgQualityScore !== null)
      .map(snapshot => ({
        date: new Date(snapshot.snapshotDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        score: snapshot.avgQualityScore ? (snapshot.avgQualityScore * 100).toFixed(1) : 0,
      }));
  }, [history]);

  // Content type breakdown (mock data - would come from API)
  const contentTypeData = [
    { name: 'Text', value: summary?.totalPosts ? Math.floor(summary.totalPosts * 0.6) : 0, color: COLORS.primary },
    { name: 'Image', value: summary?.totalPosts ? Math.floor(summary.totalPosts * 0.3) : 0, color: COLORS.secondary },
    { name: 'Video', value: summary?.totalPosts ? Math.floor(summary.totalPosts * 0.1) : 0, color: COLORS.accent },
  ];

  // Loading state
  if (characterLoading || summaryLoading || historyLoading) {
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

  if (!character) {
    return (
      <Card className="border-destructive/50 bg-destructive/10">
        <CardContent className="py-6">
          <p className="text-sm text-destructive">Character not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href={`/agents/${id}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="font-display text-3xl font-bold text-white">Analytics</h1>
          </div>
          <p className="mt-2 text-muted-foreground">
            Performance metrics for {character.name}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Generations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {summary?.totalGenerations || 0}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary?.period.startDate} to {summary?.period.endDate}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Posts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-solana-green">
              {summary?.totalPosts || 0}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Published content</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Quality Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-solana-purple">
              {summary?.avgQualityScore
                ? (summary.avgQualityScore * 100).toFixed(1)
                : '—'}
              {summary?.avgQualityScore && '%'}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Content quality</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-brick-gold">
              {summary?.totalEngagement
                ? Object.values(summary.totalEngagement).reduce<number>(
                    (sum, val) => sum + (typeof val === 'number' ? val : 0),
                    0
                  )
                : 0}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Likes, comments, shares</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Generations Per Day */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-solana-purple" />
              Generations Per Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GenerationsChart data={generationsChartData} />
          </CardContent>
        </Card>

        {/* Engagement Overview */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-solana-green" />
              Engagement Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EngagementChart data={engagementChartData} />
          </CardContent>
        </Card>

        {/* Quality Score Trend */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-solana-purple" />
              Quality Score Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <QualityScoreChart data={qualityScoreChartData} />
          </CardContent>
        </Card>

        {/* Content Type Breakdown */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-brick-gold" />
              Content Type Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ContentTypeChart data={contentTypeData} />
            <div className="mt-4 flex justify-center gap-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" style={{ color: COLORS.primary }} />
                <span className="text-xs text-muted-foreground">Text</span>
              </div>
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image className="h-4 w-4" style={{ color: COLORS.secondary }} />
                <span className="text-xs text-muted-foreground">Image</span>
              </div>
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4" style={{ color: COLORS.accent }} />
                <span className="text-xs text-muted-foreground">Video</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Content */}
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle>Top Performing Content</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <TrendingUp className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Top performing content tracking coming soon
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
