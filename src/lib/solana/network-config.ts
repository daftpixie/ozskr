/**
 * Solana Network Configuration
 * Reads NEXT_PUBLIC_SOLANA_NETWORK once, provides typed accessors
 */

export interface NetworkConfig {
  network: 'devnet' | 'mainnet-beta';
  hopeMint: string;
  usdcMint: string;
  solMint: string;
  explorerBaseUrl: string;
  defaultRpcFallback: string;
}

let _config: NetworkConfig | null = null;

/**
 * Get network configuration based on NEXT_PUBLIC_SOLANA_NETWORK
 * Defaults to devnet if not set
 */
export function getNetworkConfig(): NetworkConfig {
  if (!_config) {
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta'
      ? 'mainnet-beta' as const
      : 'devnet' as const;

    const hopeMint = process.env.NEXT_PUBLIC_HOPE_MINT || 'HoPExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

    _config = network === 'mainnet-beta'
      ? {
          network,
          hopeMint,
          usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          solMint: 'So11111111111111111111111111111111111111112',
          explorerBaseUrl: 'https://solscan.io/tx',
          defaultRpcFallback: 'https://api.mainnet-beta.solana.com',
        }
      : {
          network,
          hopeMint,
          usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
          solMint: 'So11111111111111111111111111111111111111112',
          explorerBaseUrl: 'https://solscan.io/tx',
          defaultRpcFallback: 'https://api.devnet.solana.com',
        };
  }
  return _config;
}

export function isMainnet(): boolean {
  return getNetworkConfig().network === 'mainnet-beta';
}

export function isDevnet(): boolean {
  return getNetworkConfig().network === 'devnet';
}

/**
 * Get explorer URL for a transaction signature
 * Adds ?cluster=devnet on devnet
 */
export function getExplorerUrl(signature: string): string {
  const config = getNetworkConfig();
  const clusterParam = config.network === 'devnet' ? '?cluster=devnet' : '';
  return `${config.explorerBaseUrl}/${signature}${clusterParam}`;
}
