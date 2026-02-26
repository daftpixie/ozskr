/**
 * Tapestry Social Graph Service
 *
 * Typed wrapper around the socialfi SDK. All code that interacts with
 * Tapestry must go through this service — never the SDK directly.
 *
 * Every method:
 *  1. Checks isTapestryConfigured() first
 *  2. Uses try/catch — returns { error } on failure, never throws
 *  3. Validates SDK responses with Zod where applicable
 */

import { getTapestryClient, isTapestryConfigured, TAPESTRY_API_KEY } from './client';
import { TapestryProfileSchema, TapestryContentSchema } from './schemas';
import type {
  TapestryProfile,
  TapestryContent,
  TapestryEngagementStats,
  TapestryResult,
} from './types';
import { logger } from '@/lib/utils/logger';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function notConfigured<T>(): TapestryResult<T> {
  return { error: 'Tapestry not configured' };
}

function sdkError<T>(context: string, err: unknown): TapestryResult<T> {
  const message = err instanceof Error ? err.message : String(err);
  logger.warn(`Tapestry service error: ${context}`, { error: message });
  return { error: message };
}

/**
 * Map the raw SDK profile object (which lives at `.profile`) to our
 * TapestryProfile shape. Validates with Zod before returning.
 */
function mapProfileFromSdk(raw: {
  id: string;
  namespace: string;
  created_at: number;
  username: string;
  bio?: string | null;
  image?: string | null;
}): TapestryProfile {
  return TapestryProfileSchema.parse({
    id: raw.id,
    namespace: raw.namespace,
    username: raw.username,
    bio: raw.bio ?? null,
    image: raw.image ?? null,
    created_at: raw.created_at,
  });
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Find an existing Tapestry profile for the given wallet address or create
 * a new one under the platform namespace.
 */
async function createOrFindProfile(
  walletAddress: string,
  username: string,
  bio?: string
): Promise<TapestryResult<TapestryProfile>> {
  if (!isTapestryConfigured()) return notConfigured();

  try {
    const client = getTapestryClient();
    const response = await client.profiles.findOrCreateCreate(
      { apiKey: TAPESTRY_API_KEY },
      {
        username,
        walletAddress,
        blockchain: 'SOLANA',
        ...(bio ? { bio } : {}),
      }
    );
    const profile = mapProfileFromSdk(response.profile);
    return { data: profile };
  } catch (err) {
    return sdkError('createOrFindProfile', err);
  }
}

/**
 * Retrieve a profile by its Tapestry profile ID.
 */
async function getProfile(profileId: string): Promise<TapestryResult<TapestryProfile>> {
  if (!isTapestryConfigured()) return notConfigured();

  try {
    const client = getTapestryClient();
    const response = await client.profiles.profilesDetail({
      apiKey: TAPESTRY_API_KEY,
      id: profileId,
    });
    const profile = mapProfileFromSdk(response.profile);
    return { data: profile };
  } catch (err) {
    return sdkError('getProfile', err);
  }
}

/**
 * Find a profile by Solana wallet address. Returns null if none found.
 */
async function findProfileByWallet(
  walletAddress: string
): Promise<TapestryResult<TapestryProfile | null>> {
  if (!isTapestryConfigured()) return notConfigured();

  try {
    const client = getTapestryClient();
    const response = await client.profiles.profilesList({
      apiKey: TAPESTRY_API_KEY,
      walletAddress,
      pageSize: '1',
    });

    if (!response.profiles || response.profiles.length === 0) {
      return { data: null };
    }

    // The list API returns profile items that contain a nested `profile` object
    const item = response.profiles[0];
    if (!item?.profile) {
      return { data: null };
    }

    const profile = mapProfileFromSdk(item.profile);
    return { data: profile };
  } catch (err) {
    return sdkError('findProfileByWallet', err);
  }
}

/**
 * Register a content node in the Tapestry graph.
 * `contentId` must be a UUID unique to the content item.
 * `properties` are arbitrary key/value metadata attached to the node.
 */
async function createContent(
  contentId: string,
  profileId: string,
  properties?: Record<string, string | number | boolean>
): Promise<TapestryResult<TapestryContent>> {
  if (!isTapestryConfigured()) return notConfigured();

  try {
    const client = getTapestryClient();

    const sdkProperties = properties
      ? Object.entries(properties).map(([key, value]) => ({ key, value }))
      : undefined;

    const response = await client.contents.findOrCreateCreate(
      { apiKey: TAPESTRY_API_KEY },
      {
        id: contentId,
        profileId,
        ...(sdkProperties ? { properties: sdkProperties } : {}),
      }
    );

    const content = TapestryContentSchema.parse({
      id: response.id,
      namespace: response.namespace,
      created_at: response.created_at,
    });

    return { data: content };
  } catch (err) {
    return sdkError('createContent', err);
  }
}

/**
 * Get the content feed (content nodes) for a given profile.
 */
async function getContentFeed(
  profileId: string,
  page = 1,
  pageSize = 20
): Promise<TapestryResult<TapestryContent[]>> {
  if (!isTapestryConfigured()) return notConfigured();

  try {
    const client = getTapestryClient();
    const response = await client.contents.contentsList({
      apiKey: TAPESTRY_API_KEY,
      profileId,
      page: String(page),
      pageSize: String(pageSize),
    });

    const contents = (response.contents ?? []).map((item) => {
      const raw = item.content;
      if (!raw) return null;
      return TapestryContentSchema.parse({
        id: raw.id,
        namespace: raw.namespace,
        created_at: raw.created_at,
      });
    });

    return { data: contents.filter((c): c is TapestryContent => c !== null) };
  } catch (err) {
    return sdkError('getContentFeed', err);
  }
}

/**
 * Create a follow relationship: followerProfileId follows followingProfileId.
 */
async function createFollow(
  followerProfileId: string,
  followingProfileId: string
): Promise<TapestryResult<void>> {
  if (!isTapestryConfigured()) return notConfigured();

  try {
    const client = getTapestryClient();
    await client.followers.postFollowers(
      { apiKey: TAPESTRY_API_KEY },
      { startId: followerProfileId, endId: followingProfileId }
    );
    return { data: undefined };
  } catch (err) {
    return sdkError('createFollow', err);
  }
}

/**
 * Create multiple follow relationships sequentially.
 * Collects errors but does not abort the loop on individual failures.
 */
async function bulkFollow(
  followerProfileId: string,
  followingProfileIds: string[]
): Promise<TapestryResult<void>> {
  if (!isTapestryConfigured()) return notConfigured();

  const errors: string[] = [];

  for (const followingId of followingProfileIds) {
    try {
      const client = getTapestryClient();
      await client.followers.postFollowers(
        { apiKey: TAPESTRY_API_KEY },
        { startId: followerProfileId, endId: followingId }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('Tapestry bulkFollow partial failure', {
        followerProfileId,
        followingId,
        error: message,
      });
      errors.push(`${followingId}: ${message}`);
    }
  }

  // Return success even with partial errors; caller may inspect logs
  if (errors.length > 0) {
    logger.warn('Tapestry bulkFollow completed with errors', {
      total: followingProfileIds.length,
      failed: errors.length,
    });
  }

  return { data: undefined };
}

/**
 * Remove a follow relationship.
 */
async function removeFollow(
  followerProfileId: string,
  followingProfileId: string
): Promise<TapestryResult<void>> {
  if (!isTapestryConfigured()) return notConfigured();

  try {
    const client = getTapestryClient();
    await client.followers.removeCreate(
      { apiKey: TAPESTRY_API_KEY },
      { startId: followerProfileId, endId: followingProfileId }
    );
    return { data: undefined };
  } catch (err) {
    return sdkError('removeFollow', err);
  }
}

/**
 * Get the list of profiles that follow a given profile.
 */
async function getFollowers(
  profileId: string
): Promise<TapestryResult<TapestryProfile[]>> {
  if (!isTapestryConfigured()) return notConfigured();

  try {
    const client = getTapestryClient();
    const response = await client.profiles.followersList({
      apiKey: TAPESTRY_API_KEY,
      id: profileId,
    });

    const profiles = (response.profiles ?? []).map((raw) =>
      mapProfileFromSdk({
        id: raw.id,
        namespace: raw.namespace,
        username: raw.username,
        bio: raw.bio,
        image: raw.image,
        created_at: raw.created_at,
      })
    );

    return { data: profiles };
  } catch (err) {
    return sdkError('getFollowers', err);
  }
}

/**
 * Get the list of profiles that a given profile follows.
 */
async function getFollowing(
  profileId: string
): Promise<TapestryResult<TapestryProfile[]>> {
  if (!isTapestryConfigured()) return notConfigured();

  try {
    const client = getTapestryClient();
    const response = await client.profiles.followingList({
      apiKey: TAPESTRY_API_KEY,
      id: profileId,
    });

    const profiles = (response.profiles ?? []).map((raw) =>
      mapProfileFromSdk({
        id: raw.id,
        namespace: raw.namespace,
        username: raw.username,
        bio: raw.bio,
        image: raw.image,
        created_at: raw.created_at,
      })
    );

    return { data: profiles };
  } catch (err) {
    return sdkError('getFollowing', err);
  }
}

/**
 * Get engagement stats (followers, following, content count) for a profile.
 * Makes three parallel requests to the Tapestry API.
 */
async function getEngagementStats(
  profileId: string
): Promise<TapestryResult<TapestryEngagementStats>> {
  if (!isTapestryConfigured()) return notConfigured();

  try {
    const client = getTapestryClient();

    const [profileResponse, contentResponse] = await Promise.all([
      client.profiles.profilesDetail({ apiKey: TAPESTRY_API_KEY, id: profileId }),
      client.contents.contentsList({
        apiKey: TAPESTRY_API_KEY,
        profileId,
        pageSize: '1',
      }),
    ]);

    const followers = profileResponse.socialCounts?.followers ?? 0;
    const following = profileResponse.socialCounts?.following ?? 0;
    const contentCount = contentResponse.totalCount ?? 0;

    return {
      data: { followers, following, contentCount },
    };
  } catch (err) {
    return sdkError('getEngagementStats', err);
  }
}

// ---------------------------------------------------------------------------
// Exported service object
// ---------------------------------------------------------------------------

export const tapestryService = {
  createOrFindProfile,
  getProfile,
  findProfileByWallet,
  createContent,
  getContentFeed,
  createFollow,
  bulkFollow,
  removeFollow,
  getFollowers,
  getFollowing,
  getEngagementStats,
};
