/**
 * Feedback Routes
 * Authenticated endpoint for submitting in-app feedback
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createSupabaseClient } from '../supabase';
import { authMiddleware } from '../middleware/auth';
import { logger } from '@/lib/utils/logger';

const FeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  message: z.string().max(500).optional(),
  pageUrl: z.string().max(200).optional(),
});

const SurveySchema = z.object({
  triggerPoint: z.enum([
    'first_generation',
    'first_publish',
    'third_agent',
    'first_schedule',
    'weekly_checkin',
  ]),
  response: z.string().min(1).max(500),
  rating: z.number().int().min(1).max(5).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const feedback = new Hono();

// All feedback routes require authentication
feedback.use('/*', authMiddleware);

/**
 * POST / — Submit feedback
 */
feedback.post('/', zValidator('json', FeedbackSchema), async (c) => {
  const walletAddress = (c as unknown as { get: (key: string) => unknown }).get('walletAddress') as string;
  const { rating, message, pageUrl } = c.req.valid('json');

  try {
    const supabase = createSupabaseClient();

    const { error } = await supabase.from('feedback').insert({
      wallet_address: walletAddress,
      rating,
      message: message || null,
      page_url: pageUrl || null,
    });

    if (error) {
      logger.error('Feedback insert error', { error: error.message });
      return c.json({ error: 'Failed to submit feedback' }, 500);
    }

    return c.json({ message: 'Feedback submitted' }, 201);
  } catch (err) {
    logger.error('Feedback error', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /survey — Submit a micro-survey response
 */
feedback.post('/survey', zValidator('json', SurveySchema), async (c) => {
  const walletAddress = (c as unknown as { get: (key: string) => unknown }).get('walletAddress') as string;
  const { triggerPoint, response, rating, metadata } = c.req.valid('json');

  try {
    const supabase = createSupabaseClient();

    const { error } = await supabase.from('feedback_surveys').insert({
      wallet_address: walletAddress,
      trigger_point: triggerPoint,
      response,
      rating: rating || null,
      metadata: metadata || {},
    });

    if (error) {
      logger.error('Survey insert error', { error: error.message });
      return c.json({ error: 'Failed to submit survey' }, 500);
    }

    return c.json({ message: 'Survey submitted' }, 201);
  } catch (err) {
    logger.error('Survey error', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export { feedback };
