'use client';

/**
 * Command Bar
 * Perplexity-inspired command palette for quick navigation and actions
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  LayoutDashboard,
  Bot,
  Plus,
  BarChart3,
  Settings,
  LogOut,
  Wallet,
  Sparkles,
  Calendar,
  Share2,
} from 'lucide-react';
import { useWalletAuth } from '@/features/wallet/hooks/use-wallet-auth';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCharacters } from '@/hooks/use-characters';
import { cn } from '@/lib/utils';

interface CommandBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandBar({ open, onOpenChange }: CommandBarProps) {
  const router = useRouter();
  const { isAuthenticated, signOut } = useWalletAuth();
  const { connected } = useWallet();
  const { data: charactersData } = useCharacters({ limit: 5 });
  const [search, setSearch] = useState('');

  // Get first 5 active agents for quick commands
  const quickAgents = charactersData?.data.slice(0, 5) || [];

  // Handle keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const handleNavigate = (href: string) => {
    router.push(href);
    onOpenChange(false);
    setSearch('');
  };

  const handleSignOut = async () => {
    await signOut();
    onOpenChange(false);
    setSearch('');
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-void-black/80 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Command Palette */}
      <div className="fixed left-1/2 top-[20%] z-50 w-full max-w-2xl -translate-x-1/2 px-4">
        <Command
          className="overflow-hidden rounded-lg border border-solana-purple/20 bg-[#0A0A0B] shadow-2xl"
          shouldFilter={true}
        >
          <div className="flex items-center border-b border-border px-3">
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search agents, commands..."
              className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Navigation Group */}
            <Command.Group
              heading="Navigation"
              className="px-2 py-2 text-xs font-medium text-muted-foreground"
            >
              <CommandItem
                icon={LayoutDashboard}
                label="Dashboard"
                shortcut="D"
                onSelect={() => handleNavigate('/dashboard')}
              />
              <CommandItem
                icon={Bot}
                label="My Agents"
                shortcut="A"
                onSelect={() => handleNavigate('/agents')}
              />
              <CommandItem
                icon={Plus}
                label="Create Agent"
                shortcut="C"
                onSelect={() => handleNavigate('/agents/create')}
              />
              <CommandItem
                icon={Calendar}
                label="Content Calendar"
                shortcut="L"
                onSelect={() => handleNavigate('/dashboard/calendar')}
              />
              <CommandItem
                icon={BarChart3}
                label="Analytics"
                shortcut="Y"
                onSelect={() => handleNavigate('/analytics')}
              />
              <CommandItem
                icon={Share2}
                label="Social Accounts"
                onSelect={() => handleNavigate('/dashboard/settings/social')}
              />
              <CommandItem
                icon={Settings}
                label="Settings"
                shortcut="S"
                onSelect={() => handleNavigate('/settings')}
              />
            </Command.Group>

            {/* Quick Agents Group */}
            {quickAgents.length > 0 && (
              <Command.Group
                heading="Quick Generate"
                className="px-2 py-2 text-xs font-medium text-muted-foreground"
              >
                {quickAgents.map((agent) => (
                  <CommandItem
                    key={agent.id}
                    icon={Sparkles}
                    label={`Generate with ${agent.name}`}
                    onSelect={() => handleNavigate(`/agents/${agent.id}`)}
                  />
                ))}
              </Command.Group>
            )}

            {/* Actions Group */}
            <Command.Group
              heading="Actions"
              className="px-2 py-2 text-xs font-medium text-muted-foreground"
            >
              {!connected && (
                <CommandItem
                  icon={Wallet}
                  label="Connect Wallet"
                  onSelect={() => onOpenChange(false)}
                />
              )}
              {isAuthenticated && (
                <CommandItem
                  icon={LogOut}
                  label="Sign Out"
                  onSelect={handleSignOut}
                  destructive
                />
              )}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </>
  );
}

interface CommandItemProps {
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  onSelect: () => void;
  destructive?: boolean;
}

function CommandItem({
  icon: Icon,
  label,
  shortcut,
  onSelect,
  destructive = false,
}: CommandItemProps) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm',
        'transition-colors',
        destructive
          ? 'text-red-400 aria-selected:bg-red-500/10'
          : 'text-foreground aria-selected:bg-solana-purple/10'
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
      {shortcut && (
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:inline-flex">
          {shortcut}
        </kbd>
      )}
    </Command.Item>
  );
}
