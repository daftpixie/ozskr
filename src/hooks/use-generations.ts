/**
 * React Query hooks for Content Generation API
 * Handles content generation requests and SSE streaming
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/features/wallet/store';
import {
  GenerateContentRequest,
  ContentGenerationResponse,
  ContentGenerationResponseSchema,
  GenerationAcceptedResponseSchema,
} from '@/types/schemas';

const API_BASE = '/api/ai';

/**
 * Generate content for a character
 * Returns generation ID and starts background processing
 */
export function useGenerateContent(characterId: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: GenerateContentRequest) => {
      const response = await fetch(`${API_BASE}/characters/${characterId}/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start generation');
      }

      const result: unknown = await response.json();
      return GenerationAcceptedResponseSchema.parse(result);
    },
    onSuccess: () => {
      // Invalidate character to update generation count
      queryClient.invalidateQueries({ queryKey: ['character', characterId] });
    },
  });
}

/**
 * Get generation result by ID
 */
export function useGeneration(id: string | undefined) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['generation', id],
    queryFn: async () => {
      if (!id) throw new Error('Generation ID is required');

      const response = await fetch(`${API_BASE}/generations/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch generation');
      }

      const data: unknown = await response.json();
      return ContentGenerationResponseSchema.parse(data);
    },
    enabled: !!token && !!id,
  });
}

/**
 * SSE Progress tracking types
 */
export type GenerationStage =
  | 'loading_character'
  | 'enhancing_prompt'
  | 'generating_content'
  | 'quality_check'
  | 'moderation'
  | 'complete'
  | 'error';

export interface GenerationProgress {
  stage: GenerationStage;
  message: string;
  progress?: number;
  error?: string;
  result?: ContentGenerationResponse;
}

/**
 * Subscribe to generation progress via Server-Sent Events
 */
export function useGenerationStream(generationId: string | null) {
  const token = useAuthStore((state) => state.token);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!generationId || !token) return;

    // Create EventSource with token as query param
    const url = `${API_BASE}/generations/${generationId}/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as GenerationProgress;
        setProgress(data);

        // Close connection when complete or error
        if (data.stage === 'complete' || data.stage === 'error') {
          eventSource.close();
          setIsConnected(false);
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setIsConnected(false);
      setProgress({
        stage: 'error',
        message: 'Connection lost',
        error: 'Failed to connect to generation stream',
      });
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
      setProgress(null);
    };
  }, [generationId, token]);

  return { progress, isConnected };
}
