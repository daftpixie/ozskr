'use client';

/**
 * First Agent Step Component
 * Final step showing agent creation teaser
 */

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bot, Sparkles, TrendingUp } from 'lucide-react';
import { useOnboarding } from '../hooks/use-onboarding';

interface FirstAgentStepProps {
  onBack: () => void;
}

export function FirstAgentStep({ onBack }: FirstAgentStepProps) {
  const router = useRouter();
  const { completeOnboarding } = useOnboarding();

  const handleCreateAgent = () => {
    completeOnboarding();
    router.push('/dashboard/agents/create');
  };

  const handleExploreDashboard = () => {
    completeOnboarding();
    router.push('/dashboard');
  };

  return (
    <div className="animate-fade-in-up">
      <Card className="mx-auto max-w-2xl border-mid-gray bg-deep-gray">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-solana-purple to-solana-green">
            <Bot className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="font-display text-2xl text-white">
            Ready to create your first agent?
          </CardTitle>
          <CardDescription className="mt-2 text-light-gray">
            AI agents are your digital content creators. Give them a personality, and they&apos;ll
            generate engaging content for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Agent Preview Card */}
          <div className="rounded-lg border border-mid-gray bg-void-black p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-solana-purple to-solana-green">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-lg text-white">Your AI Agent</h3>
                  <p className="text-sm text-soft-gray">
                    Powered by Claude AI and advanced image generation
                  </p>
                </div>
              </div>
              <div className="grid gap-3 pt-2">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-4 w-4 text-solana-green" />
                  <span className="text-sm text-light-gray">
                    Generate unique content on-demand
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-4 w-4 text-solana-green" />
                  <span className="text-sm text-light-gray">
                    Schedule posts across platforms
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Bot className="h-4 w-4 text-solana-green" />
                  <span className="text-sm text-light-gray">
                    Evolve with community feedback
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleCreateAgent}
              size="lg"
              className="w-full bg-gradient-to-r from-solana-purple to-solana-green text-white hover:opacity-90"
            >
              Create Your First Agent
            </Button>
            <Button
              onClick={handleExploreDashboard}
              variant="outline"
              size="lg"
              className="w-full"
            >
              Explore First
            </Button>
            <Button onClick={onBack} variant="ghost" size="sm" className="text-soft-gray">
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
