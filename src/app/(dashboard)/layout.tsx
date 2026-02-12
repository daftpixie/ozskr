'use client';

/**
 * Dashboard Layout
 * Authenticated layout with sidebar navigation and top bar
 */

import { useState } from 'react';
import { AuthGuard } from '@/components/features/auth-guard';
import { Sidebar } from '@/components/features/sidebar';
import { TopBar } from '@/components/features/top-bar';
import { CommandBar } from '@/components/features/command-bar';
import { AchievementToastProvider } from '@/features/gamification/components/achievement-toast';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [commandBarOpen, setCommandBarOpen] = useState(false);

  return (
    <AuthGuard>
      <AchievementToastProvider>
        <div className="flex h-screen overflow-hidden bg-void-black">
          {/* Sidebar */}
          <Sidebar />

          {/* Main Content Area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Top Bar */}
            <TopBar onCommandBarOpen={() => setCommandBarOpen(true)} />

            {/* Page Content */}
            <main className="flex-1 overflow-y-auto">
              <div className="container mx-auto p-6">{children}</div>
            </main>
          </div>

          {/* Command Bar */}
          <CommandBar open={commandBarOpen} onOpenChange={setCommandBarOpen} />
        </div>
      </AchievementToastProvider>
    </AuthGuard>
  );
}
