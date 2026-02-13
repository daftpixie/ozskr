/**
 * Onboarding Tests
 * Tests for onboarding hook and components
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboarding } from './hooks/use-onboarding';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

describe('useOnboarding', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should return false initially when no stored value', async () => {
    const { result } = renderHook(() => useOnboarding());

    // Wait for initial load
    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isOnboardingComplete).toBe(false);
  });

  it('should mark onboarding as complete', async () => {
    const { result } = renderHook(() => useOnboarding());

    // Wait for initial load
    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.completeOnboarding();
    });

    expect(result.current.isOnboardingComplete).toBe(true);
    expect(localStorageMock.getItem('ozskr_onboarding_completed')).toBe('true');
  });

  it('should load onboarding state from localStorage', async () => {
    localStorageMock.setItem('ozskr_onboarding_completed', 'true');

    const { result } = renderHook(() => useOnboarding());

    // Wait for initial load
    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isOnboardingComplete).toBe(true);
  });

  it('should persist onboarding completion', async () => {
    const { result, unmount } = renderHook(() => useOnboarding());

    // Wait for initial load
    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.completeOnboarding();
    });

    unmount();

    // Create a new hook instance
    const { result: newResult } = renderHook(() => useOnboarding());

    // Wait for initial load
    await vi.waitFor(() => {
      expect(newResult.current.isLoading).toBe(false);
    });

    expect(newResult.current.isOnboardingComplete).toBe(true);
  });
});
