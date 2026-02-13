'use client';

/**
 * My Agents Page
 * List of user's created AI agents with filtering
 */

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, Plus } from 'lucide-react';
import { useCharacters } from '@/hooks/use-characters';
import { AgentCard } from '@/features/agents/components/agent-card';
import { CharacterStatus } from '@/types/database';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | CharacterStatus;

export default function AgentsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { data, isLoading, error } = useCharacters();

  // Filter characters by status
  const filteredCharacters =
    statusFilter === 'all'
      ? data?.data
      : data?.data.filter((char) => char.status === statusFilter);

  // Skeleton loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">My Agents</h1>
            <p className="mt-2 text-muted-foreground">
              Your gallery of AI characters
            </p>
          </div>
          <Link href="/agents/create">
            <Button className="bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90">
              <Plus className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          </Link>
        </div>

        {/* Skeleton Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-48 animate-pulse bg-card" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">My Agents</h1>
            <p className="mt-2 text-muted-foreground">
              Your gallery of AI characters
            </p>
          </div>
        </div>
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="py-6">
            <p className="text-sm text-destructive">
              Failed to load agents: {error.message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty state
  if (!data?.data.length) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">My Agents</h1>
            <p className="mt-2 text-muted-foreground">
              Your gallery of AI characters
            </p>
          </div>
          <Link href="/agents/create">
            <Button className="bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90">
              <Plus className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          </Link>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Your Gallery Awaits</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-solana-purple/10">
              <Bot className="h-10 w-10 text-solana-purple" />
            </div>
            <h3 className="mt-6 text-lg font-medium text-white">
              Bring Your First Character to Life
            </h3>
            <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
              Your gallery is waiting for its first masterpiece. Create a character and bring them to life.
            </p>
            <Link href="/agents/create">
              <Button className="mt-6 bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90">
                <Plus className="mr-2 h-4 w-4" />
                Start Creating
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main list view with filters
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

      {/* Filter Bar */}
      <div className="flex items-center gap-2">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('all')}
          className={cn(
            statusFilter === 'all' &&
              'bg-gradient-to-r from-solana-purple to-solana-green'
          )}
        >
          All
        </Button>
        <Button
          variant={statusFilter === CharacterStatus.ACTIVE ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter(CharacterStatus.ACTIVE)}
          className={cn(
            statusFilter === CharacterStatus.ACTIVE &&
              'bg-solana-green hover:bg-solana-green/90'
          )}
        >
          Active
        </Button>
        <Button
          variant={statusFilter === CharacterStatus.PAUSED ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter(CharacterStatus.PAUSED)}
        >
          Paused
        </Button>
        <Button
          variant={statusFilter === CharacterStatus.ARCHIVED ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter(CharacterStatus.ARCHIVED)}
        >
          Archived
        </Button>
      </div>

      {/* Agent Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredCharacters?.map((character) => (
          <AgentCard key={character.id} character={character} />
        ))}
      </div>

      {/* No results for filter */}
      {filteredCharacters?.length === 0 && statusFilter !== 'all' && (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No {statusFilter} agents found
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
