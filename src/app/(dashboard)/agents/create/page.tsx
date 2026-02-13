'use client';

/**
 * Create Agent Page
 * Multi-step wizard for agent creation
 */

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { useWizardStore } from '@/features/agents/store';
import { useCreateCharacter } from '@/hooks/use-characters';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const STYLE_PRESETS = [
  { id: 'cyberpunk', label: 'Cyberpunk', description: 'Neon-lit futuristic aesthetic' },
  { id: 'anime', label: 'Anime', description: 'Japanese animation style' },
  { id: 'photorealistic', label: 'Photorealistic', description: 'Realistic photography' },
  { id: 'abstract', label: 'Abstract', description: 'Non-representational art' },
  { id: 'minimalist', label: 'Minimalist', description: 'Clean and simple design' },
];

const ASPECT_RATIOS = [
  { id: '1:1', label: 'Square' },
  { id: '16:9', label: 'Landscape' },
  { id: '9:16', label: 'Portrait' },
  { id: '4:3', label: 'Classic' },
];

export default function CreateAgentPage() {
  const router = useRouter();
  const {
    currentStep,
    name,
    persona,
    visualStyle,
    voiceTone,
    guardrails,
    topicAffinity,
    visualStyleParams,
    setField,
    nextStep,
    prevStep,
    reset,
  } = useWizardStore();

  const { mutate: createCharacter, isPending } = useCreateCharacter();
  const [tagInput, setTagInput] = useState('');
  const [guardrailInput, setGuardrailInput] = useState('');

  // Validation helpers
  const step1Valid = name.length > 0 && persona.length >= 10;
  const step2Valid = visualStyle.length >= 10;
  const step3Valid = voiceTone.length >= 10;

  // Add tag to topic affinity
  const handleAddTag = () => {
    if (tagInput.trim() && !topicAffinity.includes(tagInput.trim())) {
      setField('topicAffinity', [...topicAffinity, tagInput.trim()]);
      setTagInput('');
    }
  };

  // Remove tag
  const handleRemoveTag = (tag: string) => {
    setField(
      'topicAffinity',
      topicAffinity.filter((t) => t !== tag)
    );
  };

  // Add guardrail
  const handleAddGuardrail = () => {
    if (guardrailInput.trim() && !guardrails.includes(guardrailInput.trim())) {
      setField('guardrails', [...guardrails, guardrailInput.trim()]);
      setGuardrailInput('');
    }
  };

  // Remove guardrail
  const handleRemoveGuardrail = (rule: string) => {
    setField(
      'guardrails',
      guardrails.filter((r) => r !== rule)
    );
  };

  // Submit handler
  const handleSubmit = () => {
    createCharacter(
      {
        name,
        persona,
        visualStyle,
        voiceTone,
        guardrails,
        topicAffinity,
        visualStyleParams,
      },
      {
        onSuccess: (character) => {
          reset();
          router.push(`/agents/${character.id}`);
        },
      }
    );
  };

  // Jump to step
  const jumpToStep = (step: number) => {
    if (step < currentStep) {
      const diff = currentStep - step;
      for (let i = 0; i < diff; i++) {
        prevStep();
      }
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Create Agent</h1>
        <p className="mt-2 text-muted-foreground">
          Bring a new character to life
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={cn(
              'h-2 flex-1 rounded-full transition-all',
              step <= currentStep
                ? 'bg-gradient-to-r from-solana-purple to-solana-green'
                : 'bg-muted'
            )}
          />
        ))}
      </div>

      {/* Step 1: Identity */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Who Are They?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Character Name *</Label>
              <Input
                id="name"
                placeholder="e.g., SolanaScribe, CryptoOracle, PixelWitch"
                value={name}
                onChange={(e) => setField('name', e.target.value)}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                {name.length}/100 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="persona">Persona *</Label>
              <Textarea
                id="persona"
                placeholder="Give your character a story. Who are they? What drives them?"
                value={persona}
                onChange={(e) => setField('persona', e.target.value)}
                maxLength={2000}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                {persona.length}/2000 characters (min 10)
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={nextStep}
                disabled={!step1Valid}
                className="bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Visual Style */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: How Do They Look?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Style Presets</Label>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setField('visualStyle', preset.description);
                      setField('visualStyleParams', {
                        ...visualStyleParams,
                        style: preset.id,
                      });
                    }}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-all hover:border-solana-purple',
                      visualStyleParams.style === preset.id &&
                        'border-solana-purple bg-solana-purple/10'
                    )}
                  >
                    <p className="font-medium">{preset.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {preset.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visualStyle">Custom Visual Style *</Label>
              <Textarea
                id="visualStyle"
                placeholder="Describe the visual aesthetic for generated content..."
                value={visualStyle}
                onChange={(e) => setField('visualStyle', e.target.value)}
                maxLength={1000}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {visualStyle.length}/1000 characters (min 10)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Aspect Ratio (optional)</Label>
              <div className="flex gap-2">
                {ASPECT_RATIOS.map((ratio) => (
                  <Button
                    key={ratio.id}
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setField('visualStyleParams', {
                        ...visualStyleParams,
                        aspectRatio: ratio.id,
                      })
                    }
                    className={cn(
                      visualStyleParams.aspectRatio === ratio.id &&
                        'border-solana-green bg-solana-green/10 text-solana-green'
                    )}
                  >
                    {ratio.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={prevStep}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={nextStep}
                disabled={!step2Valid}
                className="bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Voice & Behavior */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: How Do They Speak?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="voiceTone">Voice Tone *</Label>
              <Textarea
                id="voiceTone"
                placeholder="Describe how the agent should communicate (e.g., casual, professional, humorous)..."
                value={voiceTone}
                onChange={(e) => setField('voiceTone', e.target.value)}
                maxLength={1000}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {voiceTone.length}/1000 characters (min 10)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="topicAffinity">Topic Affinity (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="topicAffinity"
                  placeholder="Enter a topic and press Enter"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddTag}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {topicAffinity.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1 cursor-pointer hover:bg-destructive/20"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    {tag}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guardrails">Guardrails (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="guardrails"
                  placeholder="Enter a rule and press Enter"
                  value={guardrailInput}
                  onChange={(e) => setGuardrailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddGuardrail();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddGuardrail}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {guardrails.map((rule) => (
                  <Badge
                    key={rule}
                    variant="secondary"
                    className="gap-1 cursor-pointer hover:bg-destructive/20"
                    onClick={() => handleRemoveGuardrail(rule)}
                  >
                    {rule}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={prevStep}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={nextStep}
                disabled={!step3Valid}
                className="bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review & Create */}
      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4: Ready to Bring Them to Life?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Identity Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Identity</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => jumpToStep(1)}
                >
                  Edit
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-background p-4 space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Name:</span> {name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Persona:</span>{' '}
                  <span className="text-muted-foreground">{persona}</span>
                </p>
              </div>
            </div>

            {/* Visual Style Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Visual Style</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => jumpToStep(2)}
                >
                  Edit
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-background p-4 space-y-2">
                <p className="text-sm text-muted-foreground">{visualStyle}</p>
                {visualStyleParams.aspectRatio && (
                  <p className="text-sm">
                    <span className="font-medium">Aspect Ratio:</span>{' '}
                    {visualStyleParams.aspectRatio}
                  </p>
                )}
              </div>
            </div>

            {/* Voice & Behavior Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Voice & Behavior</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => jumpToStep(3)}
                >
                  Edit
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-background p-4 space-y-2">
                <p className="text-sm text-muted-foreground">{voiceTone}</p>
                {topicAffinity.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Topics:</p>
                    <div className="flex flex-wrap gap-1">
                      {topicAffinity.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {guardrails.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Guardrails:</p>
                    <div className="flex flex-wrap gap-1">
                      {guardrails.map((rule) => (
                        <Badge key={rule} variant="secondary">
                          {rule}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={prevStep}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isPending}
                className="bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90"
              >
                {isPending ? (
                  <>The wizard is working...</>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Bring Them to Life
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
