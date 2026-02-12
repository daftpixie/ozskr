/**
 * Create Agent Page
 * Agent creation wizard (Phase 2 placeholder)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Sparkles, Brain, Zap } from 'lucide-react';

export default function CreateAgentPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Create Agent</h1>
        <p className="mt-2 text-muted-foreground">
          Design and deploy your autonomous AI agent
        </p>
      </div>

      {/* Coming Soon Card */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Coming in Phase 2</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-solana-purple to-solana-green">
              <Bot className="h-10 w-10 text-white" />
            </div>
            <h3 className="mt-6 text-lg font-medium text-white">
              Agent Creation Wizard
            </h3>
            <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
              The agent creation interface is under development. Soon you&apos;ll
              be able to create autonomous AI agents with custom personalities,
              goals, and capabilities.
            </p>
          </div>

          {/* Features Preview */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 rounded-lg border border-border bg-background p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-solana-purple/10">
                <Sparkles className="h-5 w-5 text-solana-purple" />
              </div>
              <h4 className="font-medium text-white">Personality</h4>
              <p className="text-sm text-muted-foreground">
                Define unique character traits and communication style
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-background p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-solana-green/10">
                <Brain className="h-5 w-5 text-solana-green" />
              </div>
              <h4 className="font-medium text-white">Memory</h4>
              <p className="text-sm text-muted-foreground">
                Long-term memory system powered by Mem0
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-background p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brick-gold/10">
                <Zap className="h-5 w-5 text-brick-gold" />
              </div>
              <h4 className="font-medium text-white">Capabilities</h4>
              <p className="text-sm text-muted-foreground">
                Content generation, on-chain interactions, and more
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
