/**
 * Tapestry Social Graph Client
 * Singleton SocialFi client for the Tapestry API.
 */

import { SocialFi } from 'socialfi';

export const TAPESTRY_API_KEY = process.env.TAPESTRY_API_KEY ?? '';
export const TAPESTRY_NAMESPACE = process.env.TAPESTRY_NAMESPACE ?? 'ozskr';

let _client: SocialFi<string> | null = null;

/**
 * Returns the singleton SocialFi client.
 * Lazily instantiated on first call.
 */
export function getTapestryClient(): SocialFi<string> {
  if (!_client) {
    _client = new SocialFi<string>({
      securityWorker: (apiKey: string | null) =>
        apiKey ? { headers: { 'x-api-key': apiKey } } : {},
    });
    _client.setSecurityData(TAPESTRY_API_KEY);
  }
  return _client;
}

/**
 * Returns true when a non-empty TAPESTRY_API_KEY is present.
 * All service methods check this before making SDK calls.
 */
export function isTapestryConfigured(): boolean {
  return TAPESTRY_API_KEY.length > 0;
}
