'use client';

/**
 * Achievement Toast Component
 * Celebration toast that appears when user unlocks an achievement
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface AchievementToastData {
  id: string;
  icon: string;
  name: string;
  pointsReward: number;
}

interface AchievementToastContextValue {
  showAchievement: (data: AchievementToastData) => void;
}

const AchievementToastContext = createContext<AchievementToastContextValue | null>(null);

export function useAchievementToast() {
  const context = useContext(AchievementToastContext);
  if (!context) {
    throw new Error('useAchievementToast must be used within AchievementToastProvider');
  }
  return context;
}

interface ToastState {
  data: AchievementToastData;
  visible: boolean;
}

export function AchievementToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const router = useRouter();

  const showAchievement = useCallback((data: AchievementToastData) => {
    setToast({ data, visible: true });

    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, visible: false } : null));
      // Clear completely after animation
      setTimeout(() => setToast(null), 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleClick = () => {
    router.push('/dashboard/achievements');
    setToast((prev) => (prev ? { ...prev, visible: false } : null));
    setTimeout(() => setToast(null), 300);
  };

  return (
    <AchievementToastContext.Provider value={{ showAchievement }}>
      {children}

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 transition-all duration-300',
            toast.visible
              ? 'translate-y-0 opacity-100'
              : 'translate-y-2 opacity-0'
          )}
        >
          <button
            onClick={handleClick}
            className={cn(
              'flex items-center gap-4 rounded-lg border-2 border-brick-gold bg-card p-4',
              'shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)]',
              'transition-all duration-200 hover:scale-105',
              'cursor-pointer focus:outline-none focus:ring-2 focus:ring-brick-gold focus:ring-offset-2'
            )}
          >
            {/* Icon */}
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brick-gold/20 text-3xl">
              {toast.data.icon}
            </div>

            {/* Content */}
            <div className="flex flex-col items-start">
              <p className="text-xs font-semibold uppercase tracking-wider text-brick-gold">
                Achievement Unlocked!
              </p>
              <p className="mt-1 text-sm font-bold text-white">
                {toast.data.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                +{toast.data.pointsReward} points
              </p>
            </div>
          </button>
        </div>
      )}
    </AchievementToastContext.Provider>
  );
}
