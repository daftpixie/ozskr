'use client';

/**
 * TabNavigation
 * Horizontal tab bar that replaces the sidebar as primary nav.
 * Active tab indicated by gold bottom border (design system Brick Gold).
 * Tabs scroll horizontally on small screens.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useWalletAuth } from '@/features/wallet/hooks/use-wallet-auth';

interface NavTab {
  label: string;
  href: string;
}

const TABS: NavTab[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Calendar', href: '/calendar' },
  { label: 'Content', href: '/content' },
  { label: 'Social', href: '/social' },
  { label: 'Trading', href: '/trading' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Settings', href: '/settings' },
];

export function TabNavigation() {
  const pathname = usePathname();
  const { isAdmin } = useWalletAuth();

  function isActive(href: string): boolean {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  }

  return (
    <nav
      className="overflow-x-auto"
      style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
      aria-label="Main navigation"
    >
      <div className="flex px-6 min-w-max">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'relative px-4 py-3 text-sm font-medium transition-colors duration-150 whitespace-nowrap',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9945FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0B]',
                active
                  ? 'text-white'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              )}
              aria-current={active ? 'page' : undefined}
            >
              {tab.label}
              {active && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: '#F59E0B' }}
                />
              )}
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              'relative px-4 py-3 text-sm font-medium transition-colors duration-150 whitespace-nowrap ml-2',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9945FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0B]',
              pathname.startsWith('/admin')
                ? 'text-[#F59E0B]'
                : 'text-[#F59E0B]/50 hover:text-[#F59E0B]/80'
            )}
            aria-current={pathname.startsWith('/admin') ? 'page' : undefined}
          >
            Admin
            {pathname.startsWith('/admin') && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ background: '#F59E0B' }}
              />
            )}
          </Link>
        )}
      </div>
    </nav>
  );
}
