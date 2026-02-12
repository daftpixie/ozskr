'use client';

/**
 * Wallet Button Component
 * Handles wallet connection, authentication, and user menu
 */

import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useWalletAuth } from '../hooks/use-wallet-auth';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function WalletButton() {
  const { connected, connecting, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { isAuthenticated, isLoading, user, signIn, signOut } =
    useWalletAuth();
  const [showMenu, setShowMenu] = useState(false);

  /**
   * State 1: Disconnected - Show "Connect Wallet" button
   */
  if (!connected) {
    return (
      <button
        onClick={() => setVisible(true)}
        disabled={connecting}
        className={cn(
          'relative px-6 py-2.5 rounded-lg font-medium',
          'bg-gradient-to-r from-[#9945FF] to-[#14F195]',
          'text-white transition-all duration-200',
          'hover:shadow-lg hover:shadow-[#9945FF]/20',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-[#9945FF] focus:ring-offset-2 focus:ring-offset-[#0A0A0B]'
        )}
      >
        {connecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
    );
  }

  /**
   * State 2: Connecting - Show loading spinner
   */
  if (connecting) {
    return (
      <button
        disabled
        className={cn(
          'relative px-6 py-2.5 rounded-lg font-medium',
          'bg-[#0A0A0B] border border-[#9945FF]/30 text-white',
          'opacity-70 cursor-not-allowed',
          'flex items-center gap-2'
        )}
      >
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#9945FF] border-t-transparent" />
        <span>Connecting...</span>
      </button>
    );
  }

  /**
   * State 3: Connected but not authenticated - Show "Sign In" button
   */
  if (connected && !isAuthenticated) {
    return (
      <button
        onClick={signIn}
        disabled={isLoading}
        className={cn(
          'relative px-6 py-2.5 rounded-lg font-medium',
          'bg-gradient-to-r from-[#9945FF] to-[#14F195]',
          'text-white transition-all duration-200',
          'hover:shadow-lg hover:shadow-[#9945FF]/20',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-[#9945FF] focus:ring-offset-2 focus:ring-offset-[#0A0A0B]',
          'flex items-center gap-2'
        )}
      >
        {isLoading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        )}
        <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
      </button>
    );
  }

  /**
   * State 4: Authenticated - Show wallet address with dropdown menu
   */
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const walletAddress = user?.walletAddress || publicKey?.toBase58() || '';

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={cn(
          'relative px-6 py-2.5 rounded-lg font-medium',
          'bg-[#0A0A0B] border border-[#9945FF]/30',
          'text-white transition-all duration-200',
          'hover:border-[#9945FF] hover:shadow-lg hover:shadow-[#9945FF]/10',
          'focus:outline-none focus:ring-2 focus:ring-[#9945FF] focus:ring-offset-2 focus:ring-offset-[#0A0A0B]',
          'flex items-center gap-2'
        )}
      >
        {/* Wallet avatar (placeholder) */}
        <div className="h-5 w-5 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195]" />
        <span className="font-mono">{truncateAddress(walletAddress)}</span>
        {/* Chevron icon */}
        <svg
          className={cn(
            'h-4 w-4 transition-transform duration-200',
            showMenu && 'rotate-180'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <>
          {/* Backdrop to close menu when clicking outside */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu content */}
          <div className="absolute right-0 mt-2 w-56 z-20 rounded-lg bg-[#0A0A0B] border border-[#9945FF]/30 shadow-xl">
            <div className="p-3 border-b border-[#9945FF]/20">
              <div className="text-xs text-gray-400">Wallet</div>
              <div className="font-mono text-sm text-white mt-1">
                {truncateAddress(walletAddress)}
              </div>
            </div>

            <div className="p-1">
              {/* Copy address */}
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(walletAddress);
                  setShowMenu(false);
                }}
                className={cn(
                  'w-full px-3 py-2 rounded-md text-left text-sm',
                  'text-white hover:bg-[#9945FF]/10',
                  'transition-colors duration-150',
                  'flex items-center gap-2'
                )}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Copy Address
              </button>

              {/* Sign out */}
              <button
                onClick={async () => {
                  await signOut();
                  setShowMenu(false);
                }}
                disabled={isLoading}
                className={cn(
                  'w-full px-3 py-2 rounded-md text-left text-sm',
                  'text-red-400 hover:bg-red-500/10',
                  'transition-colors duration-150',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'flex items-center gap-2'
                )}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                {isLoading ? 'Signing Out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
