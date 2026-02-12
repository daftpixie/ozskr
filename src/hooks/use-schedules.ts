/**
 * React Query hooks for Content Schedule API
 * Handles fetching, creating, updating, and deleting schedules
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/wallet/store';
import { QUERY_STALE_TIMES } from '@/lib/query-config';
import {
  ContentScheduleCreate,
  ContentScheduleUpdate,
  ContentScheduleResponse,
  ContentScheduleResponseSchema,
} from '@/types/scheduling';
import { z } from 'zod';

const API_BASE = '/api/ai/schedules';

interface PaginationParams {
  page?: number;
  limit?: number;
  characterId?: string;
}

const PaginatedSchedulesSchema = z.object({
  data: z.array(z.unknown()),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

/**
 * Get list of user's content schedules with pagination
 */
export function useContentSchedules(params?: PaginationParams) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['schedules', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.characterId) searchParams.set('characterId', params.characterId);

      const url = `${API_BASE}?${searchParams.toString()}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch schedules');
      }

      const data: unknown = await response.json();
      return PaginatedSchedulesSchema.parse(data) as {
        data: ContentScheduleResponse[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      };
    },
    enabled: !!token,
    staleTime: QUERY_STALE_TIMES.SCHEDULES,
  });
}

/**
 * Get single schedule
 */
export function useContentSchedule(id: string | undefined) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['schedule', id],
    queryFn: async () => {
      if (!id) throw new Error('Schedule ID is required');

      const response = await fetch(`${API_BASE}/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch schedule');
      }

      const data: unknown = await response.json();
      return ContentScheduleResponseSchema.parse(data);
    },
    enabled: !!token && !!id,
    staleTime: QUERY_STALE_TIMES.SCHEDULES,
  });
}

/**
 * Create new schedule
 */
export function useCreateSchedule() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ContentScheduleCreate) => {
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
        throw new Error(error.error || 'Failed to create schedule');
      }

      const result: unknown = await response.json();
      return ContentScheduleResponseSchema.parse(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

/**
 * Update existing schedule
 */
export function useUpdateSchedule(id: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ContentScheduleUpdate) => {
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
        throw new Error(error.error || 'Failed to update schedule');
      }

      const result: unknown = await response.json();
      return ContentScheduleResponseSchema.parse(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', id] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

/**
 * Delete schedule
 */
export function useDeleteSchedule() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete schedule');
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

/**
 * Trigger schedule to run immediately
 */
export function useTriggerSchedule() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_BASE}/${id}/trigger`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to trigger schedule');
      }

      const result: unknown = await response.json();
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}
