/**
 * React Query hooks for Character API
 * Handles fetching, creating, and updating AI characters
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/wallet/store';
import {
  CharacterCreate,
  CharacterUpdate,
  paginatedResponse,
  CharacterResponseSchema,
  CharacterWithStatsSchema,
} from '@/types/schemas';

const API_BASE = '/api/ai/characters';

interface PaginationParams {
  page?: number;
  limit?: number;
}

const PaginatedCharactersSchema = paginatedResponse(CharacterResponseSchema);

/**
 * Get list of user's characters with pagination
 */
export function useCharacters(params?: PaginationParams) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['characters', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());

      const url = `${API_BASE}?${searchParams.toString()}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch characters');
      }

      const data: unknown = await response.json();
      return PaginatedCharactersSchema.parse(data);
    },
    enabled: !!token,
  });
}

/**
 * Get single character with generation stats
 */
export function useCharacter(id: string | undefined) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['character', id],
    queryFn: async () => {
      if (!id) throw new Error('Character ID is required');

      const response = await fetch(`${API_BASE}/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch character');
      }

      const data: unknown = await response.json();
      return CharacterWithStatsSchema.parse(data);
    },
    enabled: !!token && !!id,
  });
}

/**
 * Create new character
 */
export function useCreateCharacter() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CharacterCreate) => {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create character');
      }

      const result: unknown = await response.json();
      return CharacterResponseSchema.parse(result);
    },
    onSuccess: () => {
      // Invalidate characters list to refetch
      queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
  });
}

/**
 * Update existing character
 */
export function useUpdateCharacter(id: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CharacterUpdate) => {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update character');
      }

      const result: unknown = await response.json();
      return CharacterResponseSchema.parse(result);
    },
    onSuccess: () => {
      // Invalidate both character detail and list
      queryClient.invalidateQueries({ queryKey: ['character', id] });
      queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
  });
}
