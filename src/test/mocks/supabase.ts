/**
 * Supabase Mock Factories
 * Mock Supabase client for testing database operations
 */

import { vi } from "vitest";

/**
 * Chainable query builder mock
 */
export const createMockQueryBuilder = <T = unknown>(
  data: T | null = null,
  error: unknown = null
) => {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    then: vi.fn((resolve) =>
      resolve({ data, error })
    ) as unknown as Promise<{ data: T | null; error: unknown }>,
  };

  return queryBuilder;
};

/**
 * Mock Supabase client
 */
export const createMockSupabaseClient = <T = unknown>(overrides?: {
  data?: T | null;
  error?: unknown;
}) => {
  const { data = null, error = null } = overrides ?? {};

  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn().mockReturnThis(),
  };

  const client = {
    from: vi.fn(() => createMockQueryBuilder(data, error)),
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  };

  return client;
};

/**
 * Mock Supabase module
 */
export const mockSupabase = <T = unknown>(overrides?: {
  data?: T | null;
  error?: unknown;
}) => {
  const client = createMockSupabaseClient<T>(overrides);

  vi.mock("@supabase/supabase-js", () => ({
    createClient: vi.fn(() => client),
  }));

  return client;
};

/**
 * Mock Supabase utilities from @/lib/api/supabase
 */
export const mockSupabaseUtils = <T = unknown>(overrides?: {
  data?: T | null;
  error?: unknown;
}) => {
  const client = createMockSupabaseClient<T>(overrides);

  vi.mock("@/lib/api/supabase", () => ({
    createSupabaseClient: vi.fn(() => client),
    createSupabaseServerClient: vi.fn(() => client),
    createAuthenticatedClient: vi.fn(() => client),
  }));

  return client;
};
