/**
 * Supabase Client Utilities
 * Browser and server-side client creation with type safety
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Browser-side Supabase client (uses anon key)
 * Safe for client components and API routes
 */
export const createSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required'
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

/**
 * Server-side Supabase client (uses service role key)
 * ONLY for server-side operations that need to bypass RLS
 * WARNING: Never expose this client to the browser
 */
export const createSupabaseServerClient = (serviceRoleKey: string) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!serviceRoleKey) {
    throw new Error('Service role key is required for server-side client');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

/**
 * Helper to create an authenticated client for API route handlers.
 *
 * Uses the service role key to bypass Supabase RLS because the app issues
 * its own JWTs (signed with JWT_SECRET, not the Supabase JWT secret).
 * Supabase PostgREST rejects non-Supabase JWTs, so we cannot rely on
 * RLS for authorization. Instead, authorization is enforced in the
 * application layer: the auth middleware verifies the JWT and extracts
 * wallet_address, and every query filters by wallet_address explicitly.
 *
 * The jwtToken parameter is accepted for signature compatibility but is
 * not forwarded to Supabase.
 */
export const createAuthenticatedClient = (_jwtToken: string) => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }
  return createSupabaseServerClient(serviceRoleKey);
};
