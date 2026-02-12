/**
 * Agent Card Component
 * Displays a character card with status, stats, and actions
 */

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/utils/time';
import type { CharacterResponse } from '@/types/schemas';
import { CharacterStatus } from '@/types/database';

interface AgentCardProps {
  character: CharacterResponse;
}

export function AgentCard({ character }: AgentCardProps) {
  const isActive = character.status === CharacterStatus.ACTIVE;

  const statusColors = {
    [CharacterStatus.ACTIVE]: 'bg-solana-green/10 text-solana-green border-solana-green/20',
    [CharacterStatus.PAUSED]: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    [CharacterStatus.ARCHIVED]: 'bg-muted/10 text-muted-foreground border-border',
    [CharacterStatus.DRAFT]: 'bg-muted/10 text-muted-foreground border-border',
  };

  const statusDotColors = {
    [CharacterStatus.ACTIVE]: 'bg-solana-green',
    [CharacterStatus.PAUSED]: 'bg-yellow-500',
    [CharacterStatus.ARCHIVED]: 'bg-muted-foreground',
    [CharacterStatus.DRAFT]: 'bg-muted-foreground',
  };

  return (
    <Link href={`/agents/${character.id}`}>
      <Card
        className={cn(
          'h-full transition-all hover:shadow-lg cursor-pointer',
          isActive &&
            'border-gradient-to-r from-solana-purple/30 to-solana-green/30 hover:from-solana-purple/50 hover:to-solana-green/50'
        )}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg">{character.name}</CardTitle>
            <Badge className={cn('text-xs', statusColors[character.status])}>
              <span
                className={cn(
                  'mr-1.5 inline-block h-1.5 w-1.5 rounded-full',
                  statusDotColors[character.status]
                )}
              />
              {character.status}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Persona Preview */}
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {character.persona}
          </p>

          {/* Stats */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center gap-2 text-sm">
              <Bot className="h-4 w-4 text-solana-purple" />
              <span className="font-medium">{character.generationCount}</span>
              <span className="text-muted-foreground">generations</span>
            </div>

            {character.lastGeneratedAt && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {timeAgo(character.lastGeneratedAt)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
