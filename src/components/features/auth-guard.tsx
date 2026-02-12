'use client';

/**
 * Auth Guard Component
 * Protects dashboard routes by requiring wallet authentication
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletAuth } from '@/features/wallet/hooks/use-wallet-auth';
import { WalletButton } from '@/features/wallet/components/wallet-button';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useWalletAuth();
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

  // Render protected content
  return <>{children}</>;
}
