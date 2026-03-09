'use client';

/**
 * Agent Detail Page
 * Displays agent DNA, stats, and generation history.
 * Persona, voice tone, visual style, topic affinity and guardrails are editable
 * via the Edit Profile dialog.
 */

import { use, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Bot,
  Calendar,
  Sparkles,
  BarChart3,
  Plus,
  Play,
  Trash2,
  Clock,
  Loader2,
  Pencil,
  X,
} from 'lucide-react';
import { useCharacter, useUpdateCharacter } from '@/hooks/use-characters';
import { GenerateModal } from '@/features/agents/components/generate-modal';
import { ContentGenerateModal } from '@/features/content/components/content-generate-modal';
import { ScheduleModal } from '@/features/agents/components/schedule-modal';
import { DelegationCard } from '@/features/agents/components/delegation-card';
import { ContentLibrary } from '@/features/agents/components/content-library';
import { MintIdentityCard } from '@/features/agents/components/mint-identity-card';
import { AgentIdentityBadge } from '@/features/agents/components/agent-identity-badge';
import { useContentSchedules, useDeleteSchedule, useTriggerSchedule } from '@/hooks/use-schedules';
import { timeAgo, formatDate } from '@/lib/utils/time';
import { CharacterStatus, ScheduleContentType } from '@/types/database';
import { cn } from '@/lib/utils';
import type { CharacterWithStats } from '@/types/schemas';

interface AgentDetailPageProps {
  params: Promise<{ id: string }>;
}

type CharacterWithNFT = CharacterWithStats & {
  nftMintAddress: string | null;
  nftMetadataUri: string | null;
  registryAgentId: string | null;
  isTransferable: boolean;
  reputationScore: string | null;
  capabilities: string[];
  transferCount: number;
};

// ---------------------------------------------------------------------------
// Tag input — manage an array of string tags
// ---------------------------------------------------------------------------
interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  badgeClassName?: string;
}

function TagInput({ tags, onChange, placeholder = 'Add tag…', badgeClassName }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const addTag = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
  }, [tags, onChange]);

  const removeTag = useCallback((tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  }, [tags, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className={cn('gap-1 pr-1', badgeClassName)}>
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-1 rounded-sm opacity-70 hover:opacity-100"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(inputValue);
          }
        }}
        onBlur={() => { if (inputValue) addTag(inputValue); }}
        className="h-8 text-sm"
      />
      <p className="text-xs text-muted-foreground">Press Enter or comma to add</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Profile Dialog
// ---------------------------------------------------------------------------
interface EditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character: CharacterWithNFT;
  characterId: string;
}

function AgentEditDialog({ open, onOpenChange, character, characterId }: EditDialogProps) {
  const { mutate: updateCharacter, isPending, error } = useUpdateCharacter(characterId);

  const [name, setName] = useState(character.name);
  const [persona, setPersona] = useState(character.persona);
  const [voiceTone, setVoiceTone] = useState(character.voiceTone);
  const [visualStyle, setVisualStyle] = useState(character.visualStyle);
  const [topicAffinity, setTopicAffinity] = useState<string[]>(character.topicAffinity ?? []);
  const [guardrails, setGuardrails] = useState<string[]>(character.guardrails ?? []);

  // Reset local state when dialog opens with fresh character data
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setName(character.name);
      setPersona(character.persona);
      setVoiceTone(character.voiceTone);
      setVisualStyle(character.visualStyle);
      setTopicAffinity(character.topicAffinity ?? []);
      setGuardrails(character.guardrails ?? []);
    }
    onOpenChange(next);
  };

  const handleSave = () => {
    updateCharacter(
      { name, persona, voiceTone, visualStyle, topicAffinity, guardrails },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Agent Profile</DialogTitle>
          <DialogDescription>
            Update your agent&apos;s identity, voice, and content focus.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="Agent name"
            />
          </div>

          {/* Persona */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-persona">Persona</Label>
            <Textarea
              id="edit-persona"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Describe the agent's backstory, personality, and character…"
              className="resize-none"
            />
            <p className="text-right text-xs text-muted-foreground">{persona.length}/2000</p>
          </div>

          {/* Voice Tone */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-voice">Voice &amp; Tone</Label>
            <Textarea
              id="edit-voice"
              value={voiceTone}
              onChange={(e) => setVoiceTone(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="How does this agent write and speak? Tone, cadence, vocabulary…"
              className="resize-none"
            />
            <p className="text-right text-xs text-muted-foreground">{voiceTone.length}/1000</p>
          </div>

          {/* Visual Style */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-visual">Visual Style</Label>
            <Textarea
              id="edit-visual"
              value={visualStyle}
              onChange={(e) => setVisualStyle(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Describe the aesthetic: color palette, mood, artistic style…"
              className="resize-none"
            />
            <p className="text-right text-xs text-muted-foreground">{visualStyle.length}/1000</p>
          </div>

          {/* Topic Affinity */}
          <div className="space-y-1.5">
            <Label>Topic Affinity</Label>
            <TagInput
              tags={topicAffinity}
              onChange={setTopicAffinity}
              placeholder="e.g. DeFi, NFTs, gaming…"
            />
          </div>

          {/* Guardrails */}
          <div className="space-y-1.5">
            <Label>Guardrails</Label>
            <TagInput
              tags={guardrails}
              onChange={setGuardrails}
              placeholder="e.g. No price predictions…"
              badgeClassName="border-destructive/30 text-destructive"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending || name.trim().length === 0 || persona.length < 10 || voiceTone.length < 10 || visualStyle.length < 10}
              className="bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90"
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { id } = use(params);
  const { data: characterRaw, isLoading, error } = useCharacter(id);
  const { mutate: updateCharacter } = useUpdateCharacter(id);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [contentGenerateModalOpen, setContentGenerateModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: schedulesData, isLoading: schedulesLoading } = useContentSchedules({ characterId: id });
  const { mutate: deleteSchedule, isPending: isDeleting } = useDeleteSchedule();
  const { mutate: triggerSchedule, isPending: isTriggering } = useTriggerSchedule();

  const schedules = schedulesData?.data || [];

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

  if (error || !characterRaw) {
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

  const character = characterRaw as CharacterWithNFT;

  const isActive = character.status === CharacterStatus.ACTIVE;
  const isPaused = character.status === CharacterStatus.PAUSED;

  const handleStatusToggle = (newStatus: CharacterStatus) => {
    updateCharacter({ status: newStatus });
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    deleteSchedule(scheduleId);
  };

  const handleRunNow = (scheduleId: string) => {
    if (!confirm('This will trigger the schedule to run immediately. Continue?')) return;
    triggerSchedule(scheduleId);
  };

  const getContentTypeColor = (type: ScheduleContentType) => {
    switch (type) {
      case ScheduleContentType.TEXT:
        return 'bg-solana-purple/20 border-solana-purple text-solana-purple';
      case ScheduleContentType.IMAGE:
        return 'bg-solana-green/20 border-solana-green text-solana-green';
      case ScheduleContentType.VIDEO:
        return 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]';
      default:
        return 'bg-muted border-border text-muted-foreground';
    }
  };

  const statusColors = {
    [CharacterStatus.ACTIVE]: 'bg-solana-green/10 text-solana-green border-solana-green/20',
    [CharacterStatus.PAUSED]: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    [CharacterStatus.ARCHIVED]: 'bg-muted/10 text-muted-foreground border-border',
    [CharacterStatus.DRAFT]: 'bg-muted/10 text-muted-foreground border-border',
  };

  const hasMint = Boolean(character.nftMintAddress);
  const capabilities: string[] = Array.isArray(character.capabilities) ? character.capabilities : [];

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
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle className="text-2xl">{character.name}</CardTitle>
                <Badge className={cn('text-xs', statusColors[character.status])}>
                  {character.status}
                </Badge>
                {hasMint && (
                  <AgentIdentityBadge
                    nftMintAddress={character.nftMintAddress!}
                    registryAgentId={character.registryAgentId}
                    reputationScore={character.reputationScore}
                  />
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Created {formatDate(character.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditDialogOpen(true)}
                className="gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Profile
              </Button>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  onClick={() => handleStatusToggle(CharacterStatus.ACTIVE)}
                  className={cn(isActive && 'bg-solana-green hover:bg-solana-green/90')}
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
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setGenerateModalOpen(true)}
              disabled={!isActive}
              className="bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Create Something New
            </Button>
            <Button
              onClick={() => setContentGenerateModalOpen(true)}
              disabled={!isActive}
              variant="outline"
              className="border-[#9945FF]/40 hover:border-[#9945FF] hover:bg-[#9945FF]/10"
            >
              <Sparkles className="mr-2 h-4 w-4 text-[#9945FF]" />
              Generate Content
            </Button>
          </div>
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
            <CardTitle className="text-sm font-medium">Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/agents/${id}/analytics`}>
              <Button variant="outline" size="sm" className="w-full">
                <BarChart3 className="mr-2 h-4 w-4" />
                View Analytics
              </Button>
            </Link>
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

      {/* Agent Delegation */}
      <DelegationCard characterId={id} characterName={character.name} />

      {/* Mint Identity */}
      {!hasMint && (
        <MintIdentityCard characterId={id} characterName={character.name} />
      )}

      {/* Capabilities */}
      {hasMint && capabilities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Capabilities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {capabilities.map((cap) => (
                <Badge key={cap} variant="secondary" className="text-xs">
                  {cap.replace(/-/g, ' ')}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Library */}
      <ContentLibrary characterId={id} characterName={character.name} />

      {/* Character DNA — read-only summary, editable via Edit Profile dialog */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Agent DNA</CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditDialogOpen(true)}
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Persona */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Persona</p>
              <p className="text-sm leading-relaxed">{character.persona}</p>
            </div>

            {/* Visual Style */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Visual Style</p>
              <p className="text-sm leading-relaxed">{character.visualStyle}</p>
            </div>

            {/* Voice Tone */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Voice &amp; Tone</p>
              <p className="text-sm leading-relaxed">{character.voiceTone}</p>
            </div>

            {/* Topic Affinity */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Topic Affinity</p>
              {character.topicAffinity.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {character.topicAffinity.map((topic) => (
                    <Badge key={topic} variant="secondary" className="text-xs">
                      {topic}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">None set</p>
              )}
            </div>
          </div>

          {/* Guardrails */}
          {character.guardrails.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Guardrails</p>
              <div className="flex flex-wrap gap-1.5">
                {character.guardrails.map((rule) => (
                  <Badge key={rule} variant="outline" className="text-xs border-destructive/30 text-destructive">
                    {rule}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedules Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Content Schedules</CardTitle>
            <Button size="sm" onClick={() => setScheduleModalOpen(true)} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Schedule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {schedulesLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : schedules.length > 0 ? (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-start justify-between rounded-lg border border-border p-4"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={cn('text-xs', getContentTypeColor(schedule.contentType))}>
                        {schedule.contentType}
                      </Badge>
                      <Badge variant={schedule.scheduleType === 'recurring' ? 'default' : 'secondary'} className="text-xs">
                        {schedule.scheduleType}
                      </Badge>
                      <Badge
                        variant={schedule.isActive ? 'default' : 'secondary'}
                        className={cn('text-xs', schedule.isActive && 'bg-solana-green')}
                      >
                        {schedule.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {schedule.promptTemplate}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Next run: {new Date(schedule.nextRunAt).toLocaleString()}
                      </div>
                      {schedule.lastRunAt && (
                        <div>Last run: {timeAgo(schedule.lastRunAt)}</div>
                      )}
                      <div>Runs: {schedule.runCount}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleRunNow(schedule.id)}
                      disabled={isTriggering || !schedule.isActive}
                      title="Run now"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      disabled={isDeleting}
                      className="text-destructive hover:bg-destructive/10"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <Calendar className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                No schedules yet. Set the pace for this agent.
              </p>
              <Button size="sm" variant="outline" className="mt-4" onClick={() => setScheduleModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Schedule
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Profile Dialog */}
      <AgentEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        character={character}
        characterId={id}
      />

      {/* Modals */}
      <GenerateModal
        open={generateModalOpen}
        onOpenChange={setGenerateModalOpen}
        characterId={character.id}
        characterName={character.name}
      />
      <ContentGenerateModal
        open={contentGenerateModalOpen}
        onOpenChange={setContentGenerateModalOpen}
        characterId={character.id}
        characterName={character.name}
      />
      <ScheduleModal
        open={scheduleModalOpen}
        onOpenChange={setScheduleModalOpen}
        characterId={character.id}
      />
    </div>
  );
}
