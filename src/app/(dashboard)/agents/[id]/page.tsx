'use client';

/**
 * Agent Detail Page
 * Displays agent DNA, stats, and generation history
 */

import { use, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  Calendar,
  Sparkles,
  BarChart3,
  CheckCircle,
} from 'lucide-react';
import { useCharacter, useUpdateCharacter } from '@/hooks/use-characters';
import { GenerateModal } from '@/features/agents/components/generate-modal';
import { timeAgo, formatDate } from '@/lib/utils/time';
import { CharacterStatus } from '@/types/database';
import { cn } from '@/lib/utils';

interface AgentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { id } = use(params);
  const { data: character, isLoading, error } = useCharacter(id);
  const { mutate: updateCharacter } = useUpdateCharacter(id);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);

  // Skeleton loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 w-full animate-pulse rounded-lg bg-card" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-48 animate-pulse rounded-lg bg-card" />
          <div className="h-48 animate-pulse rounded-lg bg-card" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !character) {
    return (
      <Card className="border-destructive/50 bg-destructive/10">
        <CardContent className="py-6">
          <p className="text-sm text-destructive">
            Failed to load agent: {error?.message || 'Agent not found'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const isActive = character.status === CharacterStatus.ACTIVE;
  const isPaused = character.status === CharacterStatus.PAUSED;

  // Status toggle handler
  const handleStatusToggle = (newStatus: CharacterStatus) => {
    updateCharacter({ status: newStatus });
  };

  const statusColors = {
    [CharacterStatus.ACTIVE]: 'bg-solana-green/10 text-solana-green border-solana-green/20',
    [CharacterStatus.PAUSED]: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    [CharacterStatus.ARCHIVED]: 'bg-muted/10 text-muted-foreground border-border',
    [CharacterStatus.DRAFT]: 'bg-muted/10 text-muted-foreground border-border',
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <Card
        className={cn(
          'border-l-4',
          isActive && 'border-l-solana-green',
          isPaused && 'border-l-yellow-500'
        )}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl">{character.name}</CardTitle>
                <Badge className={cn('text-xs', statusColors[character.status])}>
                  {character.status}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Created {formatDate(character.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Status Toggle Dropdown */}
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  onClick={() => handleStatusToggle(CharacterStatus.ACTIVE)}
                  className={cn(
                    isActive && 'bg-solana-green hover:bg-solana-green/90'
                  )}
                >
                  Active
                </Button>
                <Button
                  size="sm"
                  variant={isPaused ? 'default' : 'outline'}
                  onClick={() => handleStatusToggle(CharacterStatus.PAUSED)}
                >
                  Pause
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusToggle(CharacterStatus.ARCHIVED)}
                >
                  Archive
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => setGenerateModalOpen(true)}
            disabled={!isActive}
            className="bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Content
          </Button>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Generations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-solana-purple" />
              <span className="text-2xl font-bold">{character.generationCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Avg Quality Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-solana-green" />
              <span className="text-2xl font-bold">—</span>
            </div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Last Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">
                {character.lastGeneratedAt ? timeAgo(character.lastGeneratedAt) : '—'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Character DNA */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Persona */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Persona</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{character.persona}</p>
          </CardContent>
        </Card>

        {/* Visual Style */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Visual Style</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{character.visualStyle}</p>
          </CardContent>
        </Card>

        {/* Voice Tone */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Voice Tone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{character.voiceTone}</p>
          </CardContent>
        </Card>

        {/* Topic Affinity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Topic Affinity</CardTitle>
          </CardHeader>
          <CardContent>
            {character.topicAffinity.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {character.topicAffinity.map((topic) => (
                  <Badge key={topic} variant="secondary">
                    {topic}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No topics specified</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Guardrails */}
      {character.guardrails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Guardrails</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {character.guardrails.map((rule) => (
                <Badge key={rule} variant="outline" className="border-destructive/30 text-destructive">
                  {rule}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generation History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Generations</CardTitle>
        </CardHeader>
        <CardContent>
          {character.recentGenerations && character.recentGenerations.length > 0 ? (
            <div className="space-y-2">
              {character.recentGenerations.map((gen, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-solana-green" />
                    <span className="text-sm">Generation #{idx + 1}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Recently</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <Bot className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                No generations yet
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generation Modal */}
      <GenerateModal
        open={generateModalOpen}
        onOpenChange={setGenerateModalOpen}
        characterId={character.id}
        characterName={character.name}
      />
    </div>
  );
}
