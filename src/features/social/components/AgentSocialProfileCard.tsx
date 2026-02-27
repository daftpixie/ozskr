'use client';

/**
 * AgentSocialProfileCard
 * Displays a character's Tapestry on-chain social identity — profile header,
 * follower/following/post counts, and wallet address.
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTapestryProfile } from '../hooks/useTapestryProfile';
import { useTapestryStats } from '../hooks/useTapestryStats';
import { useAuthStore } from '@/features/wallet/store';
import { cn } from '@/lib/utils';
import { LinkIcon, Loader2, UserRound } from 'lucide-react';

interface AgentSocialProfileCardProps {
  characterId: string;
  walletAddress?: string;
}

function StatBlock({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      {value === undefined ? (
        <Skeleton className="h-6 w-10 bg-zinc-800" />
      ) : (
        <span className="text-xl font-bold text-zinc-50">{value.toLocaleString()}</span>
      )}
      <span className="text-xs text-zinc-400">{label}</span>
    </div>
  );
}

function InitialsAvatar({ name }: { name: string }) {
  const initials = name
    .split(/[\s_@]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] text-lg font-bold text-white">
      {initials || <UserRound className="h-7 w-7" />}
    </div>
  );
}

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function AgentSocialProfileCard({
  characterId,
  walletAddress,
}: AgentSocialProfileCardProps) {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const [provisioning, setProvisioning] = useState(false);

  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
  } = useTapestryProfile(characterId);

  const {
    data: stats,
    isLoading: statsLoading,
  } = useTapestryStats(characterId);

  const handleProvision = async () => {
    setProvisioning(true);
    try {
      const res = await fetch('/api/tapestry/profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ characterId }),
      });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        const message =
          body !== null &&
          typeof body === 'object' &&
          'error' in body &&
          typeof (body as { error: unknown }).error === 'string'
            ? (body as { error: string }).error
            : 'Failed to provision Tapestry profile';
        throw new Error(message);
      }
      await queryClient.invalidateQueries({
        queryKey: ['tapestry', 'profile', characterId],
      });
    } catch (err) {
      // Structured error surfaced to the user via console in development;
      // a toast integration can replace this when the toast provider is available.
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('[AgentSocialProfileCard] provision error:', err);
      }
    } finally {
      setProvisioning(false);
    }
  };

  // Loading state
  if (profileLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full bg-zinc-800" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32 bg-zinc-800" />
              <Skeleton className="h-4 w-20 bg-zinc-800" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full bg-zinc-800" />
          <Skeleton className="h-4 w-3/4 bg-zinc-800" />
          <div className="flex justify-around pt-2">
            {['Followers', 'Following', 'Posts'].map((label) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <Skeleton className="h-6 w-10 bg-zinc-800" />
                <span className="text-xs text-zinc-400">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (profileError) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="py-6">
          <p className="text-sm text-red-400">Failed to load social profile. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state — no Tapestry profile yet
  if (!profile) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800">
            <UserRound className="h-6 w-6 text-zinc-400" />
          </div>
          <div>
            <p className="font-medium text-zinc-50">Social identity not yet created</p>
            <p className="mt-1 text-sm text-zinc-400">
              Set up a Tapestry profile to give this agent an on-chain social identity.
            </p>
          </div>
          <Button
            size="sm"
            disabled={provisioning}
            onClick={handleProvision}
            className="bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white hover:opacity-90"
          >
            {provisioning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              'Set up Tapestry Profile'
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <InitialsAvatar name={profile.username} />

          {/* Name + username */}
          <div className="flex-1 min-w-0">
            <p className="truncate text-base font-semibold text-zinc-50">
              {profile.username}
            </p>
            <p className="text-sm text-zinc-400">@{profile.username}</p>
            {walletAddress && (
              <p className="mt-1 font-mono text-xs text-zinc-500">
                {truncateAddress(walletAddress)}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Bio */}
        {profile.bio && (
          <p className="line-clamp-2 text-sm text-zinc-300">{profile.bio}</p>
        )}

        {/* Stats row */}
        <div
          className={cn(
            'flex justify-around rounded-lg border border-zinc-800 bg-zinc-950 py-3',
            statsLoading && 'animate-pulse'
          )}
        >
          <StatBlock label="Followers" value={stats?.followers} />
          <div className="w-px bg-zinc-800" />
          <StatBlock label="Following" value={stats?.following} />
          <div className="w-px bg-zinc-800" />
          <StatBlock label="Posts" value={stats?.contentCount} />
        </div>

        {/* On-chain identity badge */}
        <div className="flex items-center gap-1.5 rounded-md bg-zinc-800/60 px-3 py-1.5">
          <LinkIcon className="h-3.5 w-3.5 text-[#14F195]" />
          <span className="text-xs text-zinc-400">
            On-chain identity via{' '}
            <span className="font-medium text-zinc-300">Tapestry</span>
            {' '}• Solana
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
