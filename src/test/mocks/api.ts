/**
 * Hono API Test Helpers
 * Utilities for testing Hono routes in isolation
 */

import { Hono } from "hono";
import { vi } from "vitest";

/**
 * Create a test Hono app instance
 */
export const createTestApp = () => {
  return new Hono();
};

/**
 * Mock authenticated context for Hono routes
 * Simulates authMiddleware attaching walletAddress and jwtToken
 */
export const mockAuthContext = (
  walletAddress: string,
  jwtToken: string = "mock-jwt-token"
) => {
  return {
    walletAddress,
    jwtToken,
  };
};

/**
 * Helper to test GET requests
 */
export const testGet = async (
  app: Hono,
  path: string,
  headers?: Record<string, string>
) => {
  const req = new Request(`http://localhost${path}`, {
    method: "GET",
    headers: headers ?? {},
  });

  return app.fetch(req);
};

/**
 * Helper to test POST requests
 */
export const testPost = async (
  app: Hono,
  path: string,
  body: unknown,
  headers?: Record<string, string>
) => {
  const req = new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  return app.fetch(req);
};

/**
 * Helper to test PUT requests
 */
export const testPut = async (
  app: Hono,
  path: string,
  body: unknown,
  headers?: Record<string, string>
) => {
  const req = new Request(`http://localhost${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  return app.fetch(req);
};

/**
 * Helper to test DELETE requests
 */
export const testDelete = async (
  app: Hono,
  path: string,
  headers?: Record<string, string>
) => {
  const req = new Request(`http://localhost${path}`, {
    method: "DELETE",
    headers: headers ?? {},
  });

  return app.fetch(req);
};

/**
 * Mock jose JWT functions
 */
export const mockJose = (options?: {
  verifySuccess?: boolean;
  walletAddress?: string;
}) => {
  const { verifySuccess = true, walletAddress = "11111111111111111111111111111111" } =
    options ?? {};

  const mockSignJWT = {
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue("mock-jwt-token"),
  };

  vi.mock("jose", () => ({
    SignJWT: vi.fn(() => mockSignJWT),
    jwtVerify: vi.fn(() => {
      if (!verifySuccess) {
        throw new Error("Invalid token");
      }
      return Promise.resolve({
        payload: { wallet_address: walletAddress },
      });
    }),
  }));

  return { mockSignJWT };
};
