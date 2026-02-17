import { Turnkey } from '@turnkey/sdk-server';

export interface CreateTurnkeyWalletOptions {
  organizationId: string;
  apiPublicKey: string;
  apiPrivateKey: string;
  baseUrl?: string;
  walletName: string;
}

export interface TurnkeyWalletResult {
  walletId: string;
  publicKey: string;
}

/**
 * Create a new Solana wallet via Turnkey TEE.
 * Returns the wallet ID and Solana public key (base58).
 */
export async function createTurnkeyWallet(
  options: CreateTurnkeyWalletOptions,
): Promise<TurnkeyWalletResult> {
  const turnkey = new Turnkey({
    apiBaseUrl: options.baseUrl || 'https://api.turnkey.com',
    apiPublicKey: options.apiPublicKey,
    apiPrivateKey: options.apiPrivateKey,
    defaultOrganizationId: options.organizationId,
  });

  const wallet = await turnkey.apiClient().createWallet({
    walletName: options.walletName,
    accounts: [{
      curve: 'CURVE_ED25519',
      pathFormat: 'PATH_FORMAT_BIP32',
      path: "m/44'/501'/0'/0'",
      addressFormat: 'ADDRESS_FORMAT_SOLANA',
    }],
  });

  const publicKey = wallet.addresses[0];
  if (!publicKey) {
    throw new Error('Turnkey createWallet returned no addresses');
  }

  return {
    walletId: wallet.walletId,
    publicKey,
  };
}
