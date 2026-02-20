'use client';

/**
 * Auth Guard Component
 * Protects dashboard routes by requiring wallet authentication + whitelist
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletAuth } from '@/features/wallet/hooks/use-wallet-auth';
import { WalletButton } from '@/features/wallet/components/wallet-button';
import { Button } from '@/components/ui/button';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isWhitelisted, isLoading } = useWalletAuth();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  // Handle client-side mounting
  // This is a legitimate use case for setState in effect (mounting detection)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  // Redirect to home if not authenticated after loading
  useEffect(() => {
    if (!isLoading && !isAuthenticated && isMounted) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, isMounted, router]);

  // Show loading skeleton while checking auth
  if (!isMounted || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-void-black">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-solana-purple border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show connect prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-void-black">
        <div className="flex flex-col items-center gap-6 text-center">
          <h2 className="text-2xl font-bold text-white">
            Connect Your Wallet
          </h2>
          <p className="max-w-md text-muted-foreground">
            You need to connect and authenticate your wallet to access the
            dashboard.
          </p>
          <WalletButton />
        </div>
      </div>
    );
  }

  // Show access limited if authenticated but not whitelisted
  if (!isWhitelisted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-void-black">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brick-gold/10">
            <span className="text-3xl">&#128274;</span>
          </div>
          <h2 className="text-2xl font-bold text-white">
            Access Limited
          </h2>
          <p className="max-w-md text-muted-foreground">
            Your wallet is not yet on the whitelist. Join the waitlist and
            we&apos;ll notify you when spots open.
          </p>
          <Button
            variant="outline"
            onClick={() => router.push('/')}
            className="border-white/10 text-white hover:bg-white/5"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  // Render protected content
  return <>{children}</>;
}
