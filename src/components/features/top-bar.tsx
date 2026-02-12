'use client';

/**
 * Top Navigation Bar
 * Contains logo, command bar trigger, and wallet button
 */

import { Search } from 'lucide-react';
import { WalletButton } from '@/features/wallet/components/wallet-button';
import { Button } from '@/components/ui/button';

interface TopBarProps {
  onCommandBarOpen: () => void;
}

export function TopBar({ onCommandBarOpen }: TopBarProps) {
  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="bg-gradient-to-r from-solana-purple to-solana-green bg-clip-text text-xl font-bold text-transparent">
          ozskr.ai
        </span>
      </div>

      {/* Command Bar Trigger */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={onCommandBarOpen}
          className="relative flex items-center gap-2 border-border/50 px-4 hover:border-solana-purple/50"
        >
          <Search className="h-4 w-4" />
          <span className="hidden md:inline text-muted-foreground">
            Search...
          </span>
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 md:inline-flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>

        {/* Wallet Button */}
        <WalletButton />
      </div>
    </header>
  );
}
