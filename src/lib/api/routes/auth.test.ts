/**
 * Auth Routes Tests
 * Tests for SIWS verification, session management, and logout
 *
 * NOTE: These tests focus on input validation and error handling.
 * Happy path tests that require complex Supabase mocking are documented
 * but should be implemented as integration tests with a real test database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { MOCK_WALLET_ADDRESS } from "@/test/mocks/solana";

// Mock @solana/kit
vi.mock("@solana/kit", () => ({
  address: vi.fn((addr: string) => addr),
}));

// Import after mocks
import { auth } from "./auth";

describe("Auth Routes - Input Validation", () => {
  let app: Hono;

  beforeEach(() => {
    // Set environment variables
    process.env.JWT_SECRET = "test-jwt-secret-key-minimum-32-characters-long";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";

    app = new Hono();
    app.route("/auth", auth);
  });

  describe("POST /auth/verify", () => {
    it("should return 400 for missing message", async () => {
      const res = await app.request("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: "valid-signature-base58",
          publicKey: MOCK_WALLET_ADDRESS,
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 for missing signature", async () => {
      const res = await app.request("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Sign in to ozskr.ai",
          publicKey: MOCK_WALLET_ADDRESS,
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid publicKey format", async () => {
      const res = await app.request("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Sign in to ozskr.ai",
          signature: "valid-signature-base58",
          publicKey: "invalid",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 for empty message", async () => {
      const res = await app.request("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "",
          signature: "valid-signature-base58",
          publicKey: MOCK_WALLET_ADDRESS,
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 for empty signature", async () => {
      const res = await app.request("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Sign in to ozskr.ai",
          signature: "",
          publicKey: MOCK_WALLET_ADDRESS,
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/logout", () => {
    it("should return 401 for missing Authorization header", async () => {
      const res = await app.request("/auth/logout", {
        method: "POST",
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 for malformed Authorization header", async () => {
      const res = await app.request("/auth/logout", {
        method: "POST",
        headers: {
          Authorization: "InvalidFormat",
        },
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /auth/session", () => {
    it("should return 401 for missing Authorization header", async () => {
      const res = await app.request("/auth/session", {
        method: "GET",
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 for malformed Authorization header", async () => {
      const res = await app.request("/auth/session", {
        method: "GET",
        headers: {
          Authorization: "InvalidFormat",
        },
      });

      expect(res.status).toBe(401);
    });
  });
});
