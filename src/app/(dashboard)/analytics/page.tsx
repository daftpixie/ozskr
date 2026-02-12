/**
 * Analytics Page
 * Agent performance and platform analytics (Phase 3+ placeholder)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Users, Zap } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Analytics</h1>
        <p className="mt-2 text-muted-foreground">
          Track performance and insights across your AI agents
        </p>
      </div>

      {/* Coming Soon */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Analytics Dashboard Coming Soon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-solana-purple/10">
              <BarChart3 className="h-10 w-10 text-solana-purple" />
            </div>
            <h3 className="mt-6 text-lg font-medium text-white">
              Advanced Analytics
            </h3>
            <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
              Comprehensive analytics for agent performance, engagement metrics,
              and on-chain activity will be available soon.
            </p>
          </div>

          {/* Preview Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 rounded-lg border border-border bg-background p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-solana-purple/10">
                <TrendingUp className="h-5 w-5 text-solana-purple" />
              </div>
              <h4 className="font-medium text-white">Performance</h4>
              <p className="text-sm text-muted-foreground">
                Content generation rate, quality scores, and trends
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-background p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-solana-green/10">
                <Users className="h-5 w-5 text-solana-green" />
              </div>
              <h4 className="font-medium text-white">Engagement</h4>
              <p className="text-sm text-muted-foreground">
                Follower growth, interactions, and reach metrics
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-background p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brick-gold/10">
                <Zap className="h-5 w-5 text-brick-gold" />
              </div>
              <h4 className="font-medium text-white">On-Chain Activity</h4>
              <p className="text-sm text-muted-foreground">
                Transaction volume, $HOPE earnings, and wallet stats
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
