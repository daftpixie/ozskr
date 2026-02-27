'use client';

/**
 * App Providers
 * Wraps the application with all required context providers
 */

import { useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
  WalletContext,
  useWallet,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

/**
 * Deduplicates the wallet list by adapter name before the modal renders it.
 * MetaMask (and occasionally other wallets) can register twice via both the
 * legacy window.navigator.wallets path and the Wallet Standard event, producing
 * two objects with the same name and causing React key warnings.
 */
function WalletDeduplicator({ children }: { children: React.ReactNode }) {
  const ctx = useWallet();
  const dedupedCtx = useMemo(() => {
    const seen = new Set<string>();
    const uniqueWallets = ctx.wallets.filter((w) => {
      if (seen.has(w.adapter.name)) return false;
      seen.add(w.adapter.name);
      return true;
    });
    return { ...ctx, wallets: uniqueWallets };
  }, [ctx]);

  return (
    <WalletContext.Provider value={dedupedCtx}>
      {children}
    </WalletContext.Provider>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  // Get RPC endpoint from environment (fallback based on network)
  const endpoint = useMemo(() => {
    if (process.env.NEXT_PUBLIC_HELIUS_RPC_URL) {
      return process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
    }
    return process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta'
      ? 'https://api.mainnet-beta.solana.com'
      : 'https://api.devnet.solana.com';
  }, []);

  // Explicit adapters for wallets that support SPL token delegation and mobile
  // deep-link / universal-link flows. Wallet Standard auto-discovery still runs
  // for any installed browser extension not in this list.
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
    ],
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletDeduplicator>
            <WalletModalProvider>{children}</WalletModalProvider>
          </WalletDeduplicator>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
