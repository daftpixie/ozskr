/**
 * Infisical Secrets Integration
 * Fetches secrets from Infisical and hydrates process.env
 * Opt-in via INFISICAL_ENABLED=true — disabled = no-op (local dev unchanged)
 */

import { logger } from '@/lib/utils/logger';

/**
 * Hydrate process.env with secrets from Infisical
 * - Disabled by default (INFISICAL_ENABLED must be 'true')
 * - Does NOT overwrite existing process.env values (local .env takes precedence)
 * - Logs secret count hydrated, never values
 * - Errors log warning but never crash the app
 */
export async function hydrateSecretsFromInfisical(): Promise<void> {
  if (process.env.INFISICAL_ENABLED !== 'true') {
    return;
  }

  const clientId = process.env.INFISICAL_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_CLIENT_SECRET;
  const projectId = process.env.INFISICAL_PROJECT_ID;
  const siteUrl = process.env.INFISICAL_SITE_URL || 'https://app.infisical.com';

  if (!clientId || !clientSecret || !projectId) {
    logger.warn('Infisical enabled but missing credentials (INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, INFISICAL_PROJECT_ID)');
    return;
  }

  const environment = mapNodeEnvToInfisical(process.env.NODE_ENV);

  try {
    const { InfisicalSDK } = await import('@infisical/sdk');
    const client = new InfisicalSDK({ siteUrl });

    await client.auth().universalAuth.login({
      clientId,
      clientSecret,
    });

    const result = await client.secrets().listSecrets({
      environment,
      projectId,
      secretPath: '/',
    });

    let hydrated = 0;
    for (const secret of result.secrets) {
      const key = secret.secretKey;
      // Do NOT overwrite existing process.env values
      if (!(key in process.env) || process.env[key] === '') {
        process.env[key] = secret.secretValue;
        hydrated++;
      }
    }

    logger.info('Infisical secrets hydrated', { count: hydrated, environment });
  } catch (err) {
    logger.error('Failed to hydrate secrets from Infisical', {
      error: err instanceof Error ? err.message : 'Unknown error',
      environment,
    });
  }
}

function mapNodeEnvToInfisical(nodeEnv: string | undefined): string {
  switch (nodeEnv) {
    case 'production':
      return 'production';
    case 'test':
      return 'staging';
    default:
      return 'dev';
  }
}
