/**
 * Mastra Configuration
 * Core agent framework setup with Claude via Vercel AI SDK
 */

import { Mastra } from '@mastra/core';
import { anthropic } from '@ai-sdk/anthropic';

/**
 * Model configuration for Mastra agents
 */
const PRIMARY_MODEL = anthropic('claude-sonnet-4-20250514');
const FALLBACK_MODEL = anthropic('claude-3-haiku-20240307');

/**
 * Initialize Mastra instance with Claude provider
 * This is the core agent orchestration framework
 */
export const mastra = new Mastra({
  agents: {},
});

/**
 * Get the primary Claude model for content generation
 */
export const getPrimaryModel = () => PRIMARY_MODEL;

/**
 * Get the fallback Claude model for rate-limited scenarios
 */
export const getFallbackModel = () => FALLBACK_MODEL;

/**
 * Get a Mastra agent instance by ID
 * This will be used once agents are defined in Sprint 2.2
 */
export const getAgent = (agentId: string) => {
  return mastra.getAgent(agentId);
};
