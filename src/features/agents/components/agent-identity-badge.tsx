'use client';

/**
 * AgentIdentityBadge
 *
 * Compact inline badge shown on agent cards and the agent detail hero section
 * when the character has a minted NFT (nftMintAddress is non-null).
 *
 * Renders:
 *  - A green "On-chain ID" badge that links to Solana Explorer
 *  - An optional reputation score badge when reputationScore > 0
 */

import { Badge } from '@/components/ui/badge';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentIdentityBadgeProps {
  nftMintAddress: string;
  registryAgentId?: string | null;
  reputationScore?: string | null;
  className?: string;
}

export function AgentIdentityBadge({
  nftMintAddress,
  registryAgentId: _registryAgentId,
  reputationScore,
  className,
}: AgentIdentityBadgeProps) {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  const clusterParam = network !== 'mainnet-beta' ? '?cluster=devnet' : '';
  const explorerUrl = `https://explorer.solana.com/address/${nftMintAddress}${clusterParam}`;

  const parsedScore = reputationScore !== null && reputationScore !== undefined
    ? parseFloat(reputationScore)
    : null;
  const hasReputation = parsedScore !== null && !isNaN(parsedScore) && parsedScore > 0;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center"
        aria-label={`View NFT mint address ${nftMintAddress} on Solana Explorer`}
      >
        <Badge
          variant="outline"
          className="gap-1 border-[#14F195]/30 bg-[#14F195]/10 text-[#14F195] text-xs transition-colors hover:bg-[#14F195]/20"
        >
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          On-chain ID
          <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
        </Badge>
      </a>

      {hasReputation && (
        <Badge variant="secondary" className="text-xs tabular-nums">
          {parsedScore!.toFixed(2)} ★
        </Badge>
      )}
    </div>
  );
}
