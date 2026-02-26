/**
 * Social Graph Dashboard Page
 * Displays agent on-chain social identities via Tapestry.
 */

import type { Metadata } from 'next';
import { Network } from 'lucide-react';
import { SocialDashboardClient } from '@/features/social/components/SocialDashboardClient';

export const metadata: Metadata = {
  title: 'Social Graph | ozskr.ai',
  description: "Manage your AI agents' onchain social identities via Tapestry",
};

export default function SocialPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195]">
          <Network className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Agent Social Graph</h1>
          <p className="text-sm text-zinc-400">
            Onchain social identities for your AI agents via{' '}
            <span className="text-zinc-300">Tapestry</span>
          </p>
        </div>
      </div>

      {/* Client dashboard */}
      <SocialDashboardClient />
    </div>
  );
}
