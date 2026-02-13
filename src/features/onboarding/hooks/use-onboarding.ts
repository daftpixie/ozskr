'use client';

/**
 * Onboarding Hook
 * Manages onboarding completion state using localStorage
 */

import { useCallback, useEffect, useState } from 'react';

const ONBOARDING_STORAGE_KEY = 'ozskr_onboarding_completed';

export function useOnboarding() {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load onboarding state from localStorage on mount
  // This is a legitimate use case for setState in effect (initial mount)
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOnboardingComplete(stored === 'true');
    setIsLoading(false);
  }, []);

  // Mark onboarding as complete
  const completeOnboarding = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    setIsOnboardingComplete(true);
  }, []);

  return {
    isOnboardingComplete,
    completeOnboarding,
    isLoading,
  };
}
