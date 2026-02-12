/**
 * Schedule Creation Modal
 * Modal dialog for creating content schedules
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Calendar, Clock, Repeat, FileText, Image as ImageIcon } from 'lucide-react';
import { useCharacters } from '@/hooks/use-characters';
import { useCreateSchedule } from '@/hooks/use-schedules';
import { ScheduleType, ScheduleContentType } from '@/types/database';
import { cn } from '@/lib/utils';

interface ScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterId?: string;
}

export function ScheduleModal({ open, onOpenChange, characterId }: ScheduleModalProps) {
  const [selectedCharacterId, setSelectedCharacterId] = useState(characterId || '');
  const [contentType, setContentType] = useState<ScheduleContentType>(ScheduleContentType.TEXT);
  const [promptTemplate, setPromptTemplate] = useState('');
  const [scheduleType, setScheduleType] = useState<ScheduleType>(ScheduleType.ONE_TIME);
  const [runDate, setRunDate] = useState('');
  const [runTime, setRunTime] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'every-2-days' | 'weekly' | 'custom'>('daily');
  const [customCron, setCustomCron] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoPublish, setAutoPublish] = useState(false);

  const { data: charactersData } = useCharacters();
  const { mutate: createSchedule, isPending } = useCreateSchedule();

  const characters = charactersData?.data || [];

  // Generate cron expression based on frequency
  const getCronExpression = () => {
    if (scheduleType === ScheduleType.ONE_TIME) return null;
    if (frequency === 'custom') return customCron;

    const [hours, minutes] = runTime.split(':');

    switch (frequency) {
      case 'daily':
        return `${minutes} ${hours} * * *`;
      case 'every-2-days':
        return `${minutes} ${hours} */2 * *`;
      case 'weekly':
        return `${minutes} ${hours} * * 0`;
      default:
        return `${minutes} ${hours} * * *`;
    }
  };

  // Calculate next 5 run times
  const nextRunTimes = useMemo(() => {
    if (!runDate || !runTime) return [];

    const [year, month, day] = runDate.split('-').map(Number);
    const [hours, minutes] = runTime.split(':').map(Number);
    const firstRun = new Date(year, month - 1, day, hours, minutes);

    if (scheduleType === ScheduleType.ONE_TIME) {
      return [firstRun];
    }

    const times = [firstRun];
    let current = new Date(firstRun);

    for (let i = 1; i < 5; i++) {
      switch (frequency) {
        case 'daily':
          current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
          break;
        case 'every-2-days':
          current = new Date(current.getTime() + 2 * 24 * 60 * 60 * 1000);
          break;
        case 'weekly':
          current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'custom':
          return times;
      }
      times.push(new Date(current));
    }

    return times;
  }, [runDate, runTime, scheduleType, frequency]);

  const handleSubmit = () => {
    if (!selectedCharacterId || !promptTemplate || !runDate || !runTime) return;

    const [year, month, day] = runDate.split('-').map(Number);
    const [hours, minutes] = runTime.split(':').map(Number);
    const nextRunAt = new Date(year, month - 1, day, hours, minutes).toISOString();

    const cronExpression = getCronExpression();

    createSchedule(
      {
        characterId: selectedCharacterId,
        scheduleType,
        cronExpression: cronExpression || undefined,
        nextRunAt,
        contentType,
        promptTemplate,
        autoPublish,
      },
      {
        onSuccess: () => {
          handleClose();
        },
      }
    );
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setSelectedCharacterId(characterId || '');
      setContentType(ScheduleContentType.TEXT);
      setPromptTemplate('');
      setScheduleType(ScheduleType.ONE_TIME);
      setRunDate('');
      setRunTime('');
      setFrequency('daily');
      setCustomCron('');
      setShowAdvanced(false);
      setAutoPublish(false);
    }, 300);
  };

  const canSubmit = selectedCharacterId && promptTemplate && runDate && runTime;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Content Schedule</DialogTitle>
          <DialogDescription>
            Set up automated content generation for your AI agent
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Character Selection */}
          <div className="space-y-2">
            <Label>Select Character</Label>
            <Select value={selectedCharacterId} onValueChange={setSelectedCharacterId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a character..." />
              </SelectTrigger>
              <SelectContent>
                {characters.map(character => (
                  <SelectItem key={character.id} value={character.id}>
                    {character.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content Type */}
          <div className="space-y-2">
            <Label>Content Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={contentType === ScheduleContentType.TEXT ? 'default' : 'outline'}
                size="sm"
                onClick={() => setContentType(ScheduleContentType.TEXT)}
                className={cn(
                  contentType === ScheduleContentType.TEXT &&
                    'bg-solana-purple hover:bg-solana-purple/90'
                )}
              >
                <FileText className="mr-2 h-4 w-4" />
                Text
              </Button>
              <Button
                type="button"
                variant={contentType === ScheduleContentType.IMAGE ? 'default' : 'outline'}
                size="sm"
                onClick={() => setContentType(ScheduleContentType.IMAGE)}
                className={cn(
                  contentType === ScheduleContentType.IMAGE &&
                    'bg-solana-green hover:bg-solana-green/90'
                )}
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Image
              </Button>
            </div>
          </div>

          {/* Prompt Template */}
          <div className="space-y-2">
            <Label htmlFor="prompt-template">Prompt Template</Label>
            <Textarea
              id="prompt-template"
              placeholder="The base prompt used for each generation..."
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              rows={4}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground">
              {promptTemplate.length}/5000 characters
            </p>
          </div>

          {/* Schedule Type */}
          <div className="space-y-2">
            <Label>Schedule Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={scheduleType === ScheduleType.ONE_TIME ? 'default' : 'outline'}
                size="sm"
                onClick={() => setScheduleType(ScheduleType.ONE_TIME)}
              >
                <Calendar className="mr-2 h-4 w-4" />
                One-time
              </Button>
              <Button
                type="button"
                variant={scheduleType === ScheduleType.RECURRING ? 'default' : 'outline'}
                size="sm"
                onClick={() => setScheduleType(ScheduleType.RECURRING)}
              >
                <Repeat className="mr-2 h-4 w-4" />
                Recurring
              </Button>
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="run-date">Date</Label>
              <Input
                id="run-date"
                type="date"
                value={runDate}
                onChange={(e) => setRunDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="run-time">Time</Label>
              <Input
                id="run-time"
                type="time"
                value={runTime}
                onChange={(e) => setRunTime(e.target.value)}
              />
            </div>
          </div>

          {/* Recurring Options */}
          {scheduleType === ScheduleType.RECURRING && (
            <div className="space-y-2">
              <Label>Frequency</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={frequency === 'daily' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFrequency('daily')}
                >
                  Daily
                </Button>
                <Button
                  type="button"
                  variant={frequency === 'every-2-days' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFrequency('every-2-days')}
                >
                  Every 2 Days
                </Button>
                <Button
                  type="button"
                  variant={frequency === 'weekly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFrequency('weekly')}
                >
                  Weekly
                </Button>
                <Button
                  type="button"
                  variant={frequency === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setFrequency('custom');
                    setShowAdvanced(true);
                  }}
                >
                  Custom
                </Button>
              </div>

              {/* Custom Cron Expression */}
              {frequency === 'custom' && showAdvanced && (
                <div className="space-y-2">
                  <Label htmlFor="custom-cron">Cron Expression</Label>
                  <Input
                    id="custom-cron"
                    placeholder="0 12 * * *"
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: minute hour day month weekday
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Preview Next Run Times */}
          {nextRunTimes.length > 0 && (
            <Card className="border-solana-purple/20 bg-solana-purple/5 p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-solana-purple" />
                  <Label className="text-sm">
                    {scheduleType === ScheduleType.ONE_TIME
                      ? 'Scheduled Run'
                      : 'Next 5 Runs'
                    }
                  </Label>
                </div>
                <div className="space-y-1">
                  {nextRunTimes.map((time, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {index + 1}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {time.toLocaleString([], {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Auto-publish Option */}
          <div className="flex items-center space-x-2 rounded-lg border border-border/50 bg-card p-4">
            <Checkbox
              id="auto-publish"
              checked={autoPublish}
              onCheckedChange={(checked) => setAutoPublish(checked === true)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="auto-publish"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Auto-publish to connected accounts
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically publish approved content to your connected social media accounts
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isPending}
              className="bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Schedule'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
