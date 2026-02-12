/**
 * React Query hooks for Social Media API
 * Handles social account management and publishing
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/wallet/store';
import {
  SocialAccountConnect,
  SocialAccountResponse,
  PublishRequest,
  SocialPostResponse,
} from '@/types/social';
import { z } from 'zod';

const API_BASE = '/api/social';

const SocialAccountsResponseSchema = z.object({
  accounts: z.array(z.unknown()),
});

const PaginatedPostsSchema = z.object({
  data: z.array(z.unknown()),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

/**
 * Get list of connected social accounts
 */
export function useSocialAccounts() {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['social-accounts'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/accounts`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch social accounts');
      }

      const data: unknown = await response.json();
      const parsed = SocialAccountsResponseSchema.parse(data);
      return parsed.accounts as SocialAccountResponse[];
    },
    enabled: !!token,
  });
}

/**
 * Connect a social account
 */
export function useConnectSocialAccount() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SocialAccountConnect) => {
      const response = await fetch(`${API_BASE}/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to connect social account');
      }

      const result: unknown = await response.json();
      return result as SocialAccountResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] });
    },
  });
}

/**
 * Disconnect a social account
 */
export function useDisconnectSocialAccount() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      const response = await fetch(`${API_BASE}/accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to disconnect social account');
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] });
    },
  });
}

/**
 * Publish content to social platforms
 */
export function usePublishContent() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PublishRequest) => {
      const response = await fetch(`${API_BASE}/publish`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to publish content');
      }

      const result: unknown = await response.json();
      return result as { success: boolean; message: string; posts: SocialPostResponse[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
    },
  });
}

/**
 * Get list of social posts with pagination
 */
export function useSocialPosts(params?: { page?: number; limit?: number; status?: string }) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['social-posts', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.status) searchParams.set('status', params.status);

      const url = `${API_BASE}/posts?${searchParams.toString()}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch social posts');
      }

      const data: unknown = await response.json();
      return PaginatedPostsSchema.parse(data) as {
        data: SocialPostResponse[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      };
    },
    enabled: !!token,
  });
}
