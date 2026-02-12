/**
 * Model Registry Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getModelConfig,
  getAvailablePurposes,
  isPurposeRegistered,
  MODEL_REGISTRY,
} from './models';

describe('Model Registry', () => {
  it('should return correct config for known purpose', () => {
    const config = getModelConfig('text-generation');

    expect(config.modelId).toBe('claude-sonnet-4-20250514');
    expect(config.provider).toBe('anthropic');
    expect(config.purpose).toContain('Character text');
    expect(config.maxTokens).toBe(4096);
    expect(config.temperature).toBe(0.8);
  });

  it('should throw for unknown purpose', () => {
    expect(() => getModelConfig('unknown-purpose')).toThrow();
  });

  it('should have all required purposes in registry', () => {
    const requiredPurposes = [
      'text-generation',
      'text-enhancement',
      'image-generation',
      'moderation',
      'fallback',
    ];

    for (const purpose of requiredPurposes) {
      expect(MODEL_REGISTRY[purpose]).toBeDefined();
    }
  });

  it('should return all available purposes', () => {
    const purposes = getAvailablePurposes();

    expect(purposes).toContain('text-generation');
    expect(purposes).toContain('image-generation');
    expect(purposes).toContain('moderation');
    expect(purposes.length).toBeGreaterThanOrEqual(5);
  });

  it('should correctly check if purpose is registered', () => {
    expect(isPurposeRegistered('text-generation')).toBe(true);
    expect(isPurposeRegistered('image-generation')).toBe(true);
    expect(isPurposeRegistered('unknown-purpose')).toBe(false);
  });

  it('should have valid model configurations', () => {
    for (const [, config] of Object.entries(MODEL_REGISTRY)) {
      expect(config.modelId).toBeDefined();
      expect(config.provider).toBeDefined();
      expect(config.purpose).toBeDefined();
      expect(['anthropic', 'fal', 'openai']).toContain(config.provider);
    }
  });
});
