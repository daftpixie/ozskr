import { task } from '@trigger.dev/sdk/v3';
import { publishToSocial } from '@/lib/jobs/publish-social';

export interface PublishSocialPayload {
  contentGenerationId: string;
  socialAccountIds: string[];
}

/**
 * Triggered task: publishes approved content to one or more social accounts.
 * Invoked from the social API route when a user requests immediate publishing.
 */
export const publishSocialTask = task({
  id: 'publish-social',
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 2000,
    factor: 2,
  },
  run: async (payload: PublishSocialPayload) => {
    return publishToSocial(payload.contentGenerationId, payload.socialAccountIds);
  },
});
