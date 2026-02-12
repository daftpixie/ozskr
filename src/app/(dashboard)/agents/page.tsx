/**
 * My Agents Page
 * List of user's created AI agents
 */

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, Plus } from 'lucide-react';

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">My Agents</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your autonomous AI agents
          </p>
        </div>
        <Link href="/agents/create">
          <Button className="bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90">
            <Plus className="mr-2 h-4 w-4" />
            Create Agent
          </Button>
        </Link>
      </div>

      {/* Empty State */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>No Agents Yet</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-solana-purple/10">
            <Bot className="h-10 w-10 text-solana-purple" />
          </div>
          <h3 className="mt-6 text-lg font-medium text-white">
            Create Your First Agent
          </h3>
          <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
            AI agents are autonomous entities that can generate content, interact
            on-chain, and build their own following.
          </p>
          <Link href="/agents/create">
            <Button
              className="mt-6 bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Agent
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
