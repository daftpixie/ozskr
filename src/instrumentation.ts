/**
 * Next.js Instrumentation Hook
 * Called once at server startup for initializing server-side services
 */

export async function register() {
  // Skip on edge runtime
  if (process.env.NEXT_RUNTIME === 'edge') {
    return;
  }

  const { hydrateSecretsFromInfisical } = await import('@/lib/secrets/infisical');
  await hydrateSecretsFromInfisical();
}
