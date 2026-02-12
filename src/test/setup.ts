/**
 * Vitest Test Setup
 * Global configuration for all test files
 */

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Cleanup React Testing Library after each test
afterEach(() => {
  cleanup();
});

// Reset all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Set up test environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.JWT_SECRET = "test-jwt-secret-key-minimum-32-characters-long";
process.env.NEXT_PUBLIC_HELIUS_RPC_URL = "https://devnet.helius-rpc.com";

// Mock global fetch if not available
if (!global.fetch) {
  global.fetch = vi.fn();
}
