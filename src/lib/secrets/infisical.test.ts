/**
 * Infisical Secrets Integration Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockLogin, mockListSecrets, mockLogger } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockListSecrets: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@infisical/sdk', () => ({
  InfisicalSDK: vi.fn(function () {
    return {
      auth: () => ({
        universalAuth: { login: mockLogin },
      }),
      secrets: () => ({
        listSecrets: mockListSecrets,
      }),
    };
  }),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: mockLogger,
}));

async function loadModule() {
  return import('./infisical');
}

describe('hydrateSecretsFromInfisical', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it('is a no-op when INFISICAL_ENABLED is not true', async () => {
    delete process.env.INFISICAL_ENABLED;
    const { hydrateSecretsFromInfisical } = await loadModule();

    await hydrateSecretsFromInfisical();

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('logs warning when credentials are missing', async () => {
    process.env.INFISICAL_ENABLED = 'true';
    delete process.env.INFISICAL_CLIENT_ID;
    delete process.env.INFISICAL_CLIENT_SECRET;
    delete process.env.INFISICAL_PROJECT_ID;

    const { hydrateSecretsFromInfisical } = await loadModule();
    await hydrateSecretsFromInfisical();

    expect(mockLogger.warn).toHaveBeenCalled();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('does not crash on SDK error', async () => {
    process.env.INFISICAL_ENABLED = 'true';
    process.env.INFISICAL_CLIENT_ID = 'test-id';
    process.env.INFISICAL_CLIENT_SECRET = 'test-secret';
    process.env.INFISICAL_PROJECT_ID = 'test-project';

    mockLogin.mockRejectedValueOnce(new Error('Auth failed'));

    const { hydrateSecretsFromInfisical } = await loadModule();
    await expect(hydrateSecretsFromInfisical()).resolves.toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('does not overwrite existing process.env values', async () => {
    process.env.INFISICAL_ENABLED = 'true';
    process.env.INFISICAL_CLIENT_ID = 'test-id';
    process.env.INFISICAL_CLIENT_SECRET = 'test-secret';
    process.env.INFISICAL_PROJECT_ID = 'test-project';
    process.env.EXISTING_VAR = 'original-value';

    mockLogin.mockResolvedValueOnce(undefined);
    mockListSecrets.mockResolvedValueOnce({
      secrets: [
        { secretKey: 'EXISTING_VAR', secretValue: 'new-value' },
        { secretKey: 'NEW_VAR', secretValue: 'fresh-value' },
      ],
    });

    const { hydrateSecretsFromInfisical } = await loadModule();
    await hydrateSecretsFromInfisical();

    expect(process.env.EXISTING_VAR).toBe('original-value');
    expect(process.env.NEW_VAR).toBe('fresh-value');
  });
});
