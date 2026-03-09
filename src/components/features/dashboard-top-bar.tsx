'use client';

/**
 * DashboardTopBar
 * 56px top bar — ozskr.ai wordmark (left) + wallet button (right).
 * Replaces the old TopBar which included a command bar trigger.
 * The command interaction is now handled by the YellowBrick component.
 */

import { WalletButton } from '@/features/wallet/components/wallet-button';

export function DashboardTopBar() {
  return (
    <header
      className="sticky top-0 z-50 flex h-14 items-center justify-between px-6"
      style={{
        background: '#0A0A0B',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      {/* Wordmark */}
      <div className="flex items-center">
        <span className="font-bold tracking-tight text-white text-lg leading-none">
          <span style={{ color: '#10B981' }}>🧱</span>
          {' ozskr'}
          <span style={{ color: '#10B981' }}>.ai</span>
        </span>
      </div>

      {/* Wallet */}
      <div className="flex items-center">
        <WalletButton />
      </div>
    </header>
  );
}
