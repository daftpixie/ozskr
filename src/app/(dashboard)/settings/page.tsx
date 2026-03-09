'use client';

/**
 * Settings Page
 * User preferences, account settings, and on-chain identity management.
 */

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon, User, Bell, Shield, ExternalLink, Copy } from 'lucide-react';
import { useCharacters } from '@/hooks/use-characters';
import { useMintAgentNFT } from '@/hooks/use-agent-nft';
import { cn } from '@/lib/utils';

// =============================================================================
// On-Chain Identity Section (Fix 6 Part C)
// =============================================================================

function OnChainIdentitySection() {
  const { data: charactersData, isLoading } = useCharacters();

  const character = useMemo(
    () => (charactersData?.data ?? [])[0] ?? null,
    [charactersData],
  );

  const characterId = character?.id ?? '';
  const { mutate: mintNFT, isPending: isMinting, error: mintMutationError } = useMintAgentNFT(characterId);
  const mintError = mintMutationError?.message ?? null;
  const [copied, setCopied] = useState(false);

  const handleCopyMint = async () => {
    if (!character?.nftMintAddress) return;
    try {
      await navigator.clipboard.writeText(character.nftMintAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  if (isLoading) {
    return (
      <Card className="border-[#27272A] bg-[#18181B]">
        <CardContent className="py-8">
          <div className="h-32 animate-pulse rounded bg-[#27272A]" />
        </CardContent>
      </Card>
    );
  }

  if (!character) {
    return (
      <Card className="border-[#27272A] bg-[#18181B]">
        <CardHeader>
          <CardTitle className="text-white">On-Chain Identity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#71717A]">
            Create an agent first to register an on-chain identity.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#27272A] bg-[#18181B]">
      <CardHeader>
        <CardTitle className="text-white">On-Chain Identity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[#A1A1AA]">
          Register your agent in the Solana Agent Registry (ERC-8004) to give it a permanent
          on-chain identity.
        </p>

        <div className="grid gap-2 text-sm">
          <div className="flex gap-2">
            <span className="w-28 shrink-0 text-[#71717A]">Agent</span>
            <span className="font-medium text-white">{character.name}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-28 shrink-0 text-[#71717A]">Cost</span>
            <span className="text-white">~0.05 SOL + rent (~0.0029 SOL)</span>
          </div>
          <div className="flex gap-2">
            <span className="w-28 shrink-0 text-[#71717A]">Network</span>
            <span className="text-white">Solana Mainnet</span>
          </div>
          <div className="flex gap-2">
            <span className="w-28 shrink-0 text-[#71717A]">Standard</span>
            <span className="text-white">ERC-8004 by QuantuLabs</span>
          </div>
        </div>

        {character.nftMintAddress ? (
          <div className="space-y-3 rounded-lg border border-[#27272A] bg-[#0A0A0B] p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-[#14F195]">
              Registered
            </p>

            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-[#A1A1AA]">
                NFT Mint: {character.nftMintAddress.slice(0, 4)}...{character.nftMintAddress.slice(-4)}
              </span>
              <button
                type="button"
                onClick={handleCopyMint}
                aria-label="Copy mint address"
                className="text-[#71717A] hover:text-white transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              {copied && <span className="text-xs text-[#14F195]">Copied</span>}
            </div>

            <div className="flex flex-col gap-1">
              <a
                href={`https://explorer.solana.com/address/${character.nftMintAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-[#71717A] hover:text-white transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View on Solana Explorer
              </a>
              <a
                href={`https://8004market.io/agent/${character.nftMintAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-[#71717A] hover:text-white transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View on 8004market.io
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {mintError && (
              <p className="text-sm text-[#F87171]">{mintError}</p>
            )}
            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => character && mintNFT()}
                disabled={isMinting}
                className={cn(
                  'h-10 rounded-lg font-medium text-[#0A0A0B]',
                  'bg-[#10B981] hover:bg-[#059669] disabled:opacity-50',
                )}
              >
                {isMinting ? 'Registering...' : 'Register Agent'}
              </Button>
              <Button
                type="button"
                variant="outline"
                asChild
                className="h-10 border-[#27272A] text-[#A1A1AA] hover:text-white"
              >
                <a
                  href="https://github.com/QuantuLabs/erc-8004"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Learn More
                </a>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Settings Page
// =============================================================================

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-white">Settings</h1>
        <p className="mt-2 text-muted-foreground">Customize your journey</p>
      </div>

      {/* On-Chain Identity */}
      <OnChainIdentitySection />

      {/* Coming Soon */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Account Settings Coming Soon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-solana-purple/10">
              <SettingsIcon className="h-10 w-10 text-solana-purple" />
            </div>
            <h3 className="mt-6 text-lg font-medium text-white">Account Settings</h3>
            <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
              Customize your profile, notification preferences, and security settings. Full
              settings interface coming soon.
            </p>
          </div>

          {/* Preview Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 rounded-lg border border-border bg-background p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-solana-purple/10">
                <User className="h-5 w-5 text-solana-purple" />
              </div>
              <h4 className="font-medium text-white">Profile</h4>
              <p className="text-sm text-muted-foreground">
                Display name, avatar, and bio customization
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-background p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-solana-green/10">
                <Bell className="h-5 w-5 text-solana-green" />
              </div>
              <h4 className="font-medium text-white">Notifications</h4>
              <p className="text-sm text-muted-foreground">
                Configure alerts for agent activity and updates
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-background p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brick-gold/10">
                <Shield className="h-5 w-5 text-brick-gold" />
              </div>
              <h4 className="font-medium text-white">Security</h4>
              <p className="text-sm text-muted-foreground">
                Wallet management and session settings
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
