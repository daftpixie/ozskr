'use client';

/**
 * Public Header
 * Shared navigation header for public pages (landing, blog, legal, livepaper)
 */

import Link from 'next/link';
import { WalletButton } from '@/features/wallet/components/wallet-button';

export function PublicHeader() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/5 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <span className="logo-brick logo-brick-gradient text-[10px]" />
            <span className="font-display bg-gradient-to-r from-solana-purple to-solana-green bg-clip-text text-transparent">
              ozskr.ai
            </span>
          </Link>
          <nav className="hidden items-center gap-4 sm:flex">
            <Link
              href="/blog"
              className="text-sm text-muted-foreground transition-colors hover:text-white"
            >
              Blog
            </Link>
            <Link
              href="/livepaper"
              className="text-sm text-muted-foreground transition-colors hover:text-white"
            >
              Livepaper
            </Link>
            <a
              href="https://github.com/daftpixie/ozskr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground transition-colors hover:text-white"
            >
              GitHub
            </a>
          </nav>
        </div>
        <WalletButton />
      </div>
    </header>
  );
}
