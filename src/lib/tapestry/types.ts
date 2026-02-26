/**
 * Tapestry Social Graph — Domain Types
 */

export interface TapestryProfile {
  id: string;
  namespace: string;
  username: string;
  bio?: string | null;
  image?: string | null;
  created_at: number;
}

export interface TapestryContent {
  id: string;
  namespace: string;
  created_at: number;
}

export interface TapestryFollowerList {
  profiles: TapestryProfile[];
}

export interface TapestryFollowingList {
  profiles: TapestryProfile[];
}

export interface TapestryEngagementStats {
  followers: number;
  following: number;
  contentCount: number;
}

export interface TapestryServiceResult<T> {
  data: T;
  error?: never;
}

export interface TapestryServiceError {
  data?: never;
  error: string;
}

export type TapestryResult<T> = TapestryServiceResult<T> | TapestryServiceError;
