'use client';

/**
 * MintIdentityCard
 *
 * Shown on the agent detail page when the agent has no NFT mint address.
 * The mint is deliberately optional — this card is informational and non-blocking.
 * It disappears after a successful mint (character query re-fetches).
 */

import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Shield, ArrowLeftRight, Loader2 } from 'lucide-react';
import { useMintAgentNFT } from '@/hooks/use-agent-nft';

interface MintIdentityCardProps {
  characterId: string;
  characterName: string;
}

interface Benefit {
  icon: React.ElementType;
  label: string;
}

const BENEFITS: Benefit[] = [
  { icon: Shield, label: 'Verifiable on-chain identity' },
  { icon: ArrowLeftRight, label: 'Transferable to new owners' },
  { icon: Sparkles, label: 'Reputation and capability registry' },
];

export function MintIdentityCard({ characterId, characterName }: MintIdentityCardProps) {
  const { connected } = useWallet();
  const { mutate: mintNFT, isPending, isSuccess, error } = useMintAgentNFT(characterId);

  // Once minted the character query refreshes — hide the card immediately
  if (isSuccess) return null;

  const handleMint = () => {
    mintNFT();
  };

  const buttonLabel = isPending
    ? null
    : connected
    ? 'Mint Identity — 0.05 SOL'
    : 'Connect wallet to mint';

  return (
    <Card
      className="border border-dashed"
      style={{
        borderColor: 'color-mix(in srgb, #9945FF 30%, transparent)',
        background:
          'linear-gradient(to bottom right, color-mix(in srgb, #9945FF 5%, transparent), color-mix(in srgb, #14F195 5%, transparent))',
      }}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Mint Agent Identity</CardTitle>
          <Badge variant="outline" className="text-xs">
            Optional
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Give {characterName} a permanent on-chain identity. Agents with minted identities are
          verifiable, transferable, and registered in the Solana Agent Registry.
        </p>

        <div className="grid grid-cols-1 gap-2">
          {BENEFITS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <Icon className="h-4 w-4 shrink-0 text-[#9945FF]" />
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error instanceof Error ? error.message : 'Mint failed. Please try again.'}
          </p>
        )}

        <Button
          onClick={handleMint}
          disabled={!connected || isPending}
          className="w-full bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white hover:opacity-90 disabled:opacity-50"
          aria-label={connected ? 'Mint agent NFT identity for 0.05 SOL' : 'Connect wallet to mint agent identity'}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              <span aria-live="polite">Minting...</span>
            </>
          ) : (
            buttonLabel
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Flat price · All features included · No hidden fees
        </p>
      </CardContent>
    </Card>
  );
}
