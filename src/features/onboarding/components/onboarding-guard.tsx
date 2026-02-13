'use client';

/**
 * Onboarding Guard Component
 * Redirects users to onboarding if not completed
 */

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useOnboarding } from '../hooks/use-onboarding';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { isOnboardingComplete, isLoading } = useOnboarding();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Don't redirect if we're already on the onboarding page
    if (pathname === '/dashboard/onboarding') {
      return;
    }

    // If onboarding is not complete, redirect to onboarding
    if (!isLoading && !isOnboardingComplete) {
      router.push('/dashboard/onboarding');
    }
  }, [isOnboardingComplete, isLoading, router, pathname]);

  // Show loading state while checking
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-void-black">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-solana-purple border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If onboarding is not complete and we're not on the onboarding page, don't render
  if (!isOnboardingComplete && pathname !== '/dashboard/onboarding') {
    return null;
  }

  // Render children if onboarding is complete
  return <>{children}</>;
}
