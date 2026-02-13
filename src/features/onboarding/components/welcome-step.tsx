'use client';

/**
 * Welcome Step Component
 * First step in the onboarding wizard
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="animate-fade-in-up">
      <Card className="mx-auto max-w-2xl border-mid-gray bg-deep-gray">
        <CardHeader className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-solana-purple to-solana-green">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="font-display text-4xl text-white">
            Welcome to ozskr.ai
          </CardTitle>
          <CardDescription className="mt-4 text-lg text-light-gray">
            Create AI-powered digital influencers. Generate content. Publish everywhere.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          <div className="w-full max-w-md space-y-4 text-center">
            <p className="text-sm text-soft-gray">
              Your AI agents will help you create engaging content across multiple platforms,
              powered by cutting-edge AI models and blockchain technology.
            </p>
          </div>
          <Button
            onClick={onNext}
            size="lg"
            className="bg-gradient-to-r from-solana-purple to-solana-green text-white hover:opacity-90"
          >
            Let&apos;s Get You Set Up
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
