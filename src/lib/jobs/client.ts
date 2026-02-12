/**
 * Trigger.dev Client Configuration
 * Background job orchestration for scheduled content generation and social publishing
 *
 * NOTE: This is a minimal stub for testing. In production, Trigger.dev jobs are
 * registered at deployment time and invoked via the Trigger.dev platform.
 * The key requirement is that jobs are directly invocable as async functions.
 */

/**
 * Minimal Trigger.dev client interface for testing
 * Jobs are directly invocable as plain async functions
 */
export interface TriggerClientConfig {
  id: string;
  apiKey?: string;
  apiUrl?: string;
}

export class TriggerClient {
  constructor(public config: TriggerClientConfig) {}

  /**
   * Register a job (no-op for testing, registration happens at deployment)
   */
  defineJob<T>(_options: {
    id: string;
    name: string;
    run: (payload: T) => Promise<unknown>;
  }): void {
    // No-op - jobs are registered at deployment time
  }
}

export const triggerClient = new TriggerClient({
  id: 'ozskr-ai',
  apiKey: process.env.TRIGGER_DEV_API_KEY,
  apiUrl: process.env.TRIGGER_DEV_API_URL,
});
