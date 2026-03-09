'use client';

/**
 * TabNavigation
 * Horizontal tab bar — primary nav for the dashboard shell.
 * Active tab indicated by emerald bottom border.
 * "Agent DNA" tab links directly to the user's single agent detail page.
 * Tabs scroll horizontally on small screens.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useWalletAuth } from '@/features/wallet/hooks/use-wallet-auth';
import { useCharacters } from '@/hooks/use-characters';

const TABS = [
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

  // One-agent model: resolve Agent DNA link to the user's single agent
  const { data: charactersData } = useCharacters({ limit: 1 });
  const character = charactersData?.data?.[0];
  const agentHref = character ? `/agents/${character.id}` : '/agents/create';
  const agentIsActive = character
    ? pathname.startsWith(`/agents/${character.id}`)
    : pathname === '/agents/create';

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  function renderTab(label: string, href: string, active: boolean) {
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          'relative px-4 py-3 text-sm font-medium transition-colors duration-150 whitespace-nowrap',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9945FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0B]',
          active ? 'text-white' : 'text-[#71717A] hover:text-[#A1A1AA]'
        )}
        aria-current={active ? 'page' : undefined}
      >
        {label}
        {active && (
          <span
            className="absolute bottom-0 left-0 right-0 h-0.5"
            style={{ background: '#10B981' }}
          />
        )}
      </Link>
    );
  }

  return (
    <nav
      className="overflow-x-auto"
      style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
      aria-label="Main navigation"
    >
      <div className="flex px-6 min-w-max">
        {TABS.map((tab) => renderTab(tab.label, tab.href, isActive(tab.href)))}

        {/* Agent DNA — direct link to the user's single agent */}
        <Link
          href={agentHref}
          className={cn(
            'relative px-4 py-3 text-sm font-medium transition-colors duration-150 whitespace-nowrap',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9945FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0B]',
            agentIsActive
              ? 'text-[#10B981]'
              : 'text-[#10B981]/60 hover:text-[#10B981]'
          )}
          aria-current={agentIsActive ? 'page' : undefined}
        >
          Agent DNA
          {agentIsActive && (
            <span
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ background: '#10B981' }}
            />
          )}
        </Link>

        {/* Admin — only visible to admin wallets */}
        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              'relative px-4 py-3 text-sm font-medium transition-colors duration-150 whitespace-nowrap ml-2',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9945FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0B]',
              pathname.startsWith('/admin')
                ? 'text-[#10B981]'
                : 'text-[#10B981]/50 hover:text-[#10B981]/80'
            )}
            aria-current={pathname.startsWith('/admin') ? 'page' : undefined}
          >
            Admin
            {pathname.startsWith('/admin') && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ background: '#10B981' }}
              />
            )}
          </Link>
        )}
      </div>
    </nav>
  );
}
