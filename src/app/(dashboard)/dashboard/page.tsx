/**
 * Dashboard Home Page
 * Main dashboard overview with stats and quick actions
 */

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, TrendingUp, Activity, Plus } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Your AI agent command center
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Your Agents Card */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">agents created</p>
            <Link href="/agents/create">
              <Button
                size="sm"
                className="mt-4 w-full bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Agent
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Quick Stats Card */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quick Stats</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Runs</span>
                <span className="text-sm font-medium">0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Content</span>
                <span className="text-sm font-medium">0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Points</span>
                <span className="text-sm font-medium text-brick-gold">0</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Card */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Recent Activity
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex h-20 items-center justify-center">
              <p className="text-sm text-muted-foreground">No activity yet</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Getting Started Section */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium text-white">Create Your First AI Agent</h3>
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
    </div>
  );
}
