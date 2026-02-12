'use client';

/**
 * Dashboard Sidebar Navigation
 * Main navigation for authenticated dashboard routes
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Bot,
  Plus,
  BarChart3,
  Settings,
  ArrowLeftRight,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navigationItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'My Agents', href: '/agents', icon: Bot },
  { label: 'Create Agent', href: '/agents/create', icon: Plus },
  { label: 'Trade', href: '/dashboard/trade', icon: ArrowLeftRight },
  { label: 'Portfolio', href: '/dashboard/portfolio', icon: Wallet },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
];

const settingsItems: NavItem[] = [
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card">
      {/* Brand */}
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-solana-purple to-solana-green" />
          <span className="bg-gradient-to-r from-solana-purple to-solana-green bg-clip-text text-xl font-bold text-transparent">
            ozskr.ai
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                isActive
                  ? 'border-l-2 border-solana-purple bg-solana-purple/10 text-solana-purple'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}

        <Separator className="my-4" />

        {settingsItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                isActive
                  ? 'border-l-2 border-solana-purple bg-solana-purple/10 text-solana-purple'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <p className="text-xs text-muted-foreground">
          Phase 1: Foundation
        </p>
      </div>
    </aside>
  );
}
