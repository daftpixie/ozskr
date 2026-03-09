/**
 * Dashboard Layout
 * Full-width tab navigation layout with YellowBrick command bar.
 * Replaces sidebar-based layout with horizontal tab navigation.
 */

import { AuthGuard } from '@/components/features/auth-guard';
import { DashboardTopBar } from '@/components/features/dashboard-top-bar';
import { TabNavigation } from '@/components/features/tab-navigation';
import { YellowBrick } from '@/components/features/yellow-brick';
import { AchievementToastProvider } from '@/features/gamification/components/achievement-toast';
import { FeedbackWidget } from '@/features/feedback/feedback-widget';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AchievementToastProvider>
        <div className="min-h-screen bg-[#0A0A0B] flex flex-col">
          <DashboardTopBar />

          <div className="flex-1 flex flex-col">
            {/* YellowBrick — centered, max-w-[672px], full-width on mobile */}
            <div className="flex justify-center px-4 pt-6 pb-4">
              <YellowBrick />
            </div>

            {/* Horizontal tab navigation */}
            <TabNavigation />

            {/* Page content */}
            <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
              {children}
            </main>
          </div>

          <FeedbackWidget />
        </div>
      </AchievementToastProvider>
    </AuthGuard>
  );
}
