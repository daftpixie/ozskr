/**
 * Delegation Routes Tests
 * Multi-agent delegation account management endpoints.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';

// ---------------------------------------------------------------------------
// Hoisted mock references
// ---------------------------------------------------------------------------

const { mockFromAuth, mockFromService, mockRpcService } = vi.hoisted(() => ({
  mockFromAuth: vi.fn(),
  mockFromService: vi.fn(),
  mockRpcService: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/supabase', () => ({
  createAuthenticatedClient: vi.fn(() => ({
    from: mockFromAuth,
    rpc: vi.fn().mockResolvedValue({ error: null }),
  })),
  createSupabaseServerClient: vi.fn(() => ({
    from: mockFromService,
    rpc: mockRpcService,
  })),
}));

vi.mock('@/lib/api/middleware/rate-limit', () => ({
  createRateLimiter: vi.fn(
    () => async (_c: unknown, next: () => Promise<unknown>) => next()
  ),
}));

const { mockJwtVerify } = vi.hoisted(() => ({
  mockJwtVerify: vi.fn(),
}));

vi.mock('jose', () => ({
  SignJWT: vi.fn(function () {
    return {
      setProtectedHeader: vi.fn().mockReturnThis(),
      setIssuedAt: vi.fn().mockReturnThis(),
      setExpirationTime: vi.fn().mockReturnThis(),
      sign: vi.fn().mockResolvedValue('mock-jwt-token'),
    };
  }),
  jwtVerify: mockJwtVerify,
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { delegation } from './delegation';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const MOCK_WALLET = 'So11111111111111111111111111111111111111112';
const MOCK_CHARACTER_ID = '550e8400-e29b-41d4-a716-446655440000';
const MOCK_ACCOUNT_ID = '660e8400-e29b-41d4-a716-446655440001';
const MOCK_AGENT_PUBKEY = 'AgentKey1111111111111111111111111111111111';
const MOCK_TOKEN_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const MOCK_TOKEN_ACCOUNT = 'TokenAcct111111111111111111111111111111111';
const MOCK_TX_SIG = 'mock-tx-signature-base58-encoded-123456789012345';

const authHeaders = { Authorization: 'Bearer mock-jwt-token' };

// A full mock delegation account row (snake_case as returned from DB)
function makeDelegationAccountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: MOCK_ACCOUNT_ID,
    character_id: MOCK_CHARACTER_ID,
    wallet_address: MOCK_WALLET,
    token_mint: MOCK_TOKEN_MINT,
    token_account_address: MOCK_TOKEN_ACCOUNT,
    delegate_pubkey: MOCK_AGENT_PUBKEY,
    delegation_status: 'active',
    approved_amount: '1000000',
    remaining_amount: '900000',
    delegation_tx_signature: MOCK_TX_SIG,
    revocation_tx_signature: null,
    close_tx_signature: null,
    version: 1,
    last_reconciled_at: null,
    reconciliation_status: 'ok',
    created_at: '2024-01-15T00:00:00+00:00',
    updated_at: '2024-01-15T00:00:00+00:00',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Supabase chain builder helpers
// ---------------------------------------------------------------------------

function makeChain(opts: {
  selectResult?: { data: unknown; error: unknown };
  singleResult?: { data: unknown; error: unknown };
  insertResult?: { data: unknown; error: unknown };
  updateResult?: { data: unknown; error: unknown };
  maybeSingleResult?: { data: unknown; error: unknown };
  inResult?: { data: unknown; error: unknown };
  orderResult?: { data: unknown; error: unknown };
} = {}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => {
    if (opts.inResult) {
      return Promise.resolve(opts.inResult);
    }
    return chain;
  });
  chain.order = vi.fn(() => {
    if (opts.orderResult) {
      return Promise.resolve(opts.orderResult);
    }
    return chain;
  });
  chain.single = vi.fn(() =>
    Promise.resolve(opts.singleResult ?? { data: null, error: { message: 'Not found' } })
  );
  chain.maybeSingle = vi.fn(() =>
    Promise.resolve(opts.maybeSingleResult ?? { data: null, error: null })
  );
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);

  // Allow terminal awaiting of chain itself (for .from().select().eq().order() patterns)
  if (opts.selectResult) {
    (chain as Record<string, unknown>).then = (
      resolve: (value: unknown) => void,
    ): Promise<unknown> => {
      resolve(opts.selectResult);
      return Promise.resolve(opts.selectResult);
    };
  }

  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Delegation Routes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.INTERNAL_API_SECRET = 'test-internal-secret';

    // Re-apply jwtVerify mock after clearAllMocks
    mockJwtVerify.mockResolvedValue({
      payload: { wallet_address: MOCK_WALLET },
    });

    // Default session mock: auth middleware passes (session found, not expired)
    // This must be the default for mockFromService so auth middleware doesn't block tests.
    // Individual tests override mockFromService for their specific table.
    mockFromService.mockImplementation((table: string) => {
      if (table === 'sessions') {
        // Return a valid non-expired session so auth middleware passes
        const chain = makeChain({
          maybeSingleResult: {
            data: {
              id: 'sess-123',
              expires_at: new Date(Date.now() + 3600_000).toISOString(),
            },
            error: null,
          },
        });
        return chain;
      }
      return makeChain();
    });

    app = new Hono();
    app.route('/delegation', delegation);
  });

  // =========================================================================
  // GET /wallet/all
  // =========================================================================

  describe('GET /delegation/wallet/all', () => {
    it('should return 401 when no Authorization header is provided', async () => {
      const res = await app.request('/delegation/wallet/all', { method: 'GET' });
      expect(res.status).toBe(401);
    });

    it('should return 200 with empty groups when user has no characters', async () => {
      mockFromAuth.mockImplementation((table: string) => {
        if (table === 'characters') {
          const chain = makeChain();
          chain.select = vi.fn(() => chain);
          chain.eq = vi.fn(() => Promise.resolve({ data: [], error: null }));
          return chain;
        }
        return makeChain();
      });

      const res = await app.request('/delegation/wallet/all', {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json() as { groups: unknown[] };
      expect(json.groups).toEqual([]);
    });

    it('should return 200 with grouped accounts by characterId', async () => {
      const characters = [
        { id: MOCK_CHARACTER_ID, name: 'TestAgent' },
      ];
      const accounts = [makeDelegationAccountRow()];

      mockFromAuth.mockImplementation((table: string) => {
        if (table === 'characters') {
          const chain = makeChain();
          chain.select = vi.fn(() => chain);
          chain.eq = vi.fn(() => Promise.resolve({ data: characters, error: null }));
          return chain;
        }
        // agent_delegation_accounts
        const chain = makeChain();
        chain.select = vi.fn(() => chain);
        chain.in = vi.fn(() => chain);
        chain.order = vi.fn(() => Promise.resolve({ data: accounts, error: null }));
        return chain;
      });

      const res = await app.request('/delegation/wallet/all', {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json() as { groups: Array<{ characterId: string; characterName: string; accounts: unknown[] }> };
      expect(json.groups).toHaveLength(1);
      expect(json.groups[0].characterId).toBe(MOCK_CHARACTER_ID);
      expect(json.groups[0].characterName).toBe('TestAgent');
      expect(json.groups[0].accounts).toHaveLength(1);
    });

    it('should return 500 when characters query fails', async () => {
      mockFromAuth.mockImplementation(() => {
        const chain = makeChain();
        chain.select = vi.fn(() => chain);
        chain.eq = vi.fn(() =>
          Promise.resolve({ data: null, error: { message: 'DB error' } })
        );
        return chain;
      });

      const res = await app.request('/delegation/wallet/all', {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // GET /:characterId
  // =========================================================================

  describe('GET /delegation/:characterId', () => {
    it('should return 404 for unknown character', async () => {
      mockFromAuth.mockImplementation(() =>
        makeChain({
          singleResult: { data: null, error: { message: 'Not found' } },
        })
      );

      const res = await app.request(`/delegation/${MOCK_CHARACTER_ID}`, {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(404);
    });

    it('should return 200 with correct shape for owned character', async () => {
      const character = {
        id: MOCK_CHARACTER_ID,
        agent_pubkey: MOCK_AGENT_PUBKEY,
        delegation_status: 'none',
        delegation_amount: null,
        delegation_remaining: null,
        delegation_token_mint: null,
        delegation_token_account: null,
        delegation_tx_signature: null,
      };
      const accounts = [makeDelegationAccountRow()];

      mockFromAuth.mockImplementation((table: string) => {
        if (table === 'characters') {
          return makeChain({ singleResult: { data: character, error: null } });
        }
        // agent_delegation_accounts
        const chain = makeChain();
        chain.select = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.order = vi.fn(() =>
          Promise.resolve({ data: accounts, error: null })
        );
        return chain;
      });

      const res = await app.request(`/delegation/${MOCK_CHARACTER_ID}`, {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json() as {
        characterId: string;
        legacyDelegation: unknown;
        delegationAccounts: unknown[];
      };
      expect(json.characterId).toBe(MOCK_CHARACTER_ID);
      expect(json.legacyDelegation).toBeDefined();
      expect(json.delegationAccounts).toHaveLength(1);
    });

    it('should return 400 for an invalid (non-UUID) characterId', async () => {
      const res = await app.request('/delegation/not-a-uuid', {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(400);
    });

    it('should return 401 without auth', async () => {
      const res = await app.request(`/delegation/${MOCK_CHARACTER_ID}`, { method: 'GET' });
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // POST /:characterId/create
  // =========================================================================

  describe('POST /delegation/:characterId/create', () => {
    const validCreateBody = {
      characterId: MOCK_CHARACTER_ID,
      tokenMint: MOCK_TOKEN_MINT,
      tokenAccountAddress: MOCK_TOKEN_ACCOUNT,
      delegatePubkey: MOCK_AGENT_PUBKEY,
      approvedAmount: '1000000',
      delegationTxSignature: MOCK_TX_SIG,
    };

    it('should return 400 for invalid (non-UUID) characterId in path', async () => {
      const res = await app.request('/delegation/not-a-valid-uuid/create', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(validCreateBody),
      });

      expect(res.status).toBe(400);
    });

    it('should return 403 when delegatePubkey does not match registered agent key', async () => {
      const character = { id: MOCK_CHARACTER_ID, agent_pubkey: 'DifferentKey11111111111111111111111111111' };

      mockFromAuth.mockImplementation((table: string) => {
        if (table === 'characters') {
          return makeChain({ singleResult: { data: character, error: null } });
        }
        // agent_turnkey_mapping
        return makeChain({ maybeSingleResult: { data: null, error: null } });
      });

      const res = await app.request(`/delegation/${MOCK_CHARACTER_ID}/create`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(validCreateBody),
      });

      expect(res.status).toBe(403);
      const json = await res.json() as { code: string };
      expect(json.code).toBe('DELEGATE_MISMATCH');
    });

    it('should return 201 on successful delegation account creation', async () => {
      const character = { id: MOCK_CHARACTER_ID, agent_pubkey: MOCK_AGENT_PUBKEY };
      const newAccount = makeDelegationAccountRow();

      mockFromAuth.mockImplementation((table: string) => {
        if (table === 'characters') {
          return makeChain({ singleResult: { data: character, error: null } });
        }
        if (table === 'agent_turnkey_mapping') {
          return makeChain({ maybeSingleResult: { data: null, error: null } });
        }
        // agent_delegation_accounts insert
        const chain = makeChain();
        chain.select = vi.fn(() => chain);
        chain.insert = vi.fn(() => chain);
        chain.single = vi.fn(() => Promise.resolve({ data: newAccount, error: null }));
        return chain;
      });

      const res = await app.request(`/delegation/${MOCK_CHARACTER_ID}/create`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(validCreateBody),
      });

      expect(res.status).toBe(201);
      const json = await res.json() as { id: string; delegationStatus: string };
      expect(json.id).toBe(MOCK_ACCOUNT_ID);
      expect(json.delegationStatus).toBe('active');
    });

    it('should return 400 when no agent key is registered for character', async () => {
      const character = { id: MOCK_CHARACTER_ID, agent_pubkey: null };

      mockFromAuth.mockImplementation((table: string) => {
        if (table === 'characters') {
          return makeChain({ singleResult: { data: character, error: null } });
        }
        return makeChain({ maybeSingleResult: { data: null, error: null } });
      });

      const res = await app.request(`/delegation/${MOCK_CHARACTER_ID}/create`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(validCreateBody),
      });

      expect(res.status).toBe(400);
      const json = await res.json() as { code: string };
      expect(json.code).toBe('NO_AGENT_KEY');
    });

    it('should return 401 without auth', async () => {
      const res = await app.request(`/delegation/${MOCK_CHARACTER_ID}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validCreateBody),
      });

      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // PATCH /:characterId/update-balance
  // =========================================================================

  describe('PATCH /delegation/:characterId/update-balance', () => {
    const validUpdateBody = {
      delegationAccountId: MOCK_ACCOUNT_ID,
      remainingAmount: '500000',
      txSignature: MOCK_TX_SIG,
      expectedVersion: 1,
    };

    it('should return 409 on version conflict', async () => {
      // Advisory lock
      mockRpcService.mockResolvedValue({ error: null });

      mockFromService.mockImplementation((table: string) => {
        if (table === 'sessions') {
          return makeChain({
            maybeSingleResult: {
              data: { id: 'sess-123', expires_at: new Date(Date.now() + 3600_000).toISOString() },
              error: null,
            },
          });
        }
        const chain = makeChain({
          singleResult: {
            data: {
              id: MOCK_ACCOUNT_ID,
              character_id: MOCK_CHARACTER_ID,
              remaining_amount: '900000',
              delegation_status: 'active',
              version: 2, // current version differs from expectedVersion=1
            },
            error: null,
          },
        });
        return chain;
      });

      const res = await app.request(`/delegation/${MOCK_CHARACTER_ID}/update-balance`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json', 'X-Internal-Secret': 'test-internal-secret' },
        body: JSON.stringify(validUpdateBody),
      });

      expect(res.status).toBe(409);
      const json = await res.json() as { code: string };
      expect(json.code).toBe('VERSION_CONFLICT');
    });

    it('should return 200 on successful balance update', async () => {
      const updatedAccount = makeDelegationAccountRow({
        remaining_amount: '500000',
        version: 2,
      });

      mockRpcService.mockResolvedValue({ error: null });

      let fetchCallCount = 0;
      mockFromService.mockImplementation((table: string) => {
        if (table === 'sessions') {
          return makeChain({
            maybeSingleResult: {
              data: { id: 'sess-123', expires_at: new Date(Date.now() + 3600_000).toISOString() },
              error: null,
            },
          });
        }
        fetchCallCount++;
        if (fetchCallCount === 1) {
          // First call: fetch existing account
          return makeChain({
            singleResult: {
              data: {
                id: MOCK_ACCOUNT_ID,
                character_id: MOCK_CHARACTER_ID,
                remaining_amount: '900000',
                delegation_status: 'active',
                version: 1,
              },
              error: null,
            },
          });
        }
        // Second call: update
        const chain = makeChain();
        chain.update = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn(() =>
          Promise.resolve({ data: updatedAccount, error: null })
        );
        return chain;
      });

      const res = await app.request(`/delegation/${MOCK_CHARACTER_ID}/update-balance`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json', 'X-Internal-Secret': 'test-internal-secret' },
        body: JSON.stringify(validUpdateBody),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as { remainingAmount: string; version: number };
      expect(json.remainingAmount).toBe('500000');
      expect(json.version).toBe(2);
    });

    it('should auto-set delegation_status to depleted when remaining reaches 0', async () => {
      const depletedAccount = makeDelegationAccountRow({
        remaining_amount: '0',
        delegation_status: 'depleted',
        version: 2,
      });

      mockRpcService.mockResolvedValue({ error: null });

      let callCount = 0;
      mockFromService.mockImplementation((table: string) => {
        if (table === 'sessions') {
          return makeChain({
            maybeSingleResult: {
              data: { id: 'sess-123', expires_at: new Date(Date.now() + 3600_000).toISOString() },
              error: null,
            },
          });
        }
        callCount++;
        if (callCount === 1) {
          return makeChain({
            singleResult: {
              data: {
                id: MOCK_ACCOUNT_ID,
                character_id: MOCK_CHARACTER_ID,
                remaining_amount: '100',
                delegation_status: 'active',
                version: 1,
              },
              error: null,
            },
          });
        }
        const chain = makeChain();
        chain.update = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn(() =>
          Promise.resolve({ data: depletedAccount, error: null })
        );
        return chain;
      });

      const res = await app.request(`/delegation/${MOCK_CHARACTER_ID}/update-balance`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json', 'X-Internal-Secret': 'test-internal-secret' },
        body: JSON.stringify({ ...validUpdateBody, remainingAmount: '0' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as { delegationStatus: string };
      expect(json.delegationStatus).toBe('depleted');
    });
  });

  // =========================================================================
  // POST /:characterId/revoke
  // =========================================================================

  describe('POST /delegation/:characterId/revoke', () => {
    const validRevokeBody = {
      delegationAccountId: MOCK_ACCOUNT_ID,
      revocationTxSignature: MOCK_TX_SIG,
    };

    it('should return 400 when account is already revoked', async () => {
      const character = { id: MOCK_CHARACTER_ID };
      const alreadyRevoked = { id: MOCK_ACCOUNT_ID, delegation_status: 'revoked' };

      mockFromAuth.mockImplementation((table: string) => {
        if (table === 'characters') {
          return makeChain({ singleResult: { data: character, error: null } });
        }
        return makeChain({ singleResult: { data: alreadyRevoked, error: null } });
      });

      const res = await app.request(`/delegation/${MOCK_CHARACTER_ID}/revoke`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(validRevokeBody),
      });

      expect(res.status).toBe(400);
      const json = await res.json() as { code: string };
      expect(json.code).toBe('ALREADY_REVOKED');
    });

    it('should return 400 when account is already closed', async () => {
      const character = { id: MOCK_CHARACTER_ID };
      const closed = { id: MOCK_ACCOUNT_ID, delegation_status: 'closed' };

      mockFromAuth.mockImplementation((table: string) => {
        if (table === 'characters') {
          return makeChain({ singleResult: { data: character, error: null } });
        }
        return makeChain({ singleResult: { data: closed, error: null } });
      });

      const res = await app.request(`/delegation/${MOCK_CHARACTER_ID}/revoke`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(validRevokeBody),
      });

      expect(res.status).toBe(400);
    });

    it('should return 200 on successful revocation', async () => {
      const character = { id: MOCK_CHARACTER_ID };
      const activeAccount = { id: MOCK_ACCOUNT_ID, delegation_status: 'active' };
      const revokedAccount = makeDelegationAccountRow({
        delegation_status: 'revoked',
        revocation_tx_signature: MOCK_TX_SIG,
      });

      let callCount = 0;
      mockFromAuth.mockImplementation((table: string) => {
        if (table === 'characters') {
          return makeChain({ singleResult: { data: character, error: null } });
        }
        callCount++;
        if (callCount === 1) {
          return makeChain({ singleResult: { data: activeAccount, error: null } });
        }
        // Update call
        const chain = makeChain();
        chain.update = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn(() =>
          Promise.resolve({ data: revokedAccount, error: null })
        );
        return chain;
      });

      const res = await app.request(`/delegation/${MOCK_CHARACTER_ID}/revoke`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(validRevokeBody),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as { delegationStatus: string };
      expect(json.delegationStatus).toBe('revoked');
    });
  });

  // =========================================================================
  // POST /:characterId/top-up
  // =========================================================================

  describe('POST /delegation/:characterId/top-up', () => {
    const validTopUpBody = {
      delegationAccountId: MOCK_ACCOUNT_ID,
      additionalAmount: '500000',
      newApprovedAmount: '1500000',
      delegationTxSignature: MOCK_TX_SIG,
    };

    it('should return 404 when delegation account is not found', async () => {
      const character = { id: MOCK_CHARACTER_ID };

      mockFromAuth.mockImplementation((table: string) => {
        if (table === 'characters') {
          return makeChain({ singleResult: { data: character, error: null } });
        }
        return makeChain({ singleResult: { data: null, error: { message: 'Not found' } } });
      });

      const res = await app.request(`/delegation/${MOCK_CHARACTER_ID}/top-up`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(validTopUpBody),
      });

      expect(res.status).toBe(404);
    });

    it('should return 200 and update remaining_amount on successful top-up', async () => {
      const character = { id: MOCK_CHARACTER_ID };
      const currentAccount = {
        id: MOCK_ACCOUNT_ID,
        delegation_status: 'active',
        remaining_amount: '100000',
        approved_amount: '1000000',
        version: 1,
      };
      const updatedAccount = makeDelegationAccountRow({
        approved_amount: '1500000',
        remaining_amount: '600000',
        delegation_status: 'active',
        version: 2,
      });

      // Advisory lock mock
      mockRpcService.mockResolvedValue({ error: null });

      let callCount = 0;
      mockFromAuth.mockImplementation((table: string) => {
        if (table === 'characters') {
          return makeChain({ singleResult: { data: character, error: null } });
        }
        callCount++;
        if (callCount === 1) {
          return makeChain({ singleResult: { data: currentAccount, error: null } });
        }
        const chain = makeChain();
        chain.update = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn(() =>
          Promise.resolve({ data: updatedAccount, error: null })
        );
        return chain;
      });

      const res = await app.request(`/delegation/${MOCK_CHARACTER_ID}/top-up`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(validTopUpBody),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as { remainingAmount: string; delegationStatus: string };
      expect(json.remainingAmount).toBe('600000');
      expect(json.delegationStatus).toBe('active');
    });

    it('should return 400 when trying to top up a revoked account', async () => {
      const character = { id: MOCK_CHARACTER_ID };
      const revokedAccount = { id: MOCK_ACCOUNT_ID, delegation_status: 'revoked', remaining_amount: '0', version: 1 };

      mockFromAuth.mockImplementation((table: string) => {
        if (table === 'characters') {
          return makeChain({ singleResult: { data: character, error: null } });
        }
        return makeChain({ singleResult: { data: revokedAccount, error: null } });
      });

      const res = await app.request(`/delegation/${MOCK_CHARACTER_ID}/top-up`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(validTopUpBody),
      });

      expect(res.status).toBe(400);
      const json = await res.json() as { code: string };
      expect(json.code).toBe('DELEGATION_INACTIVE');
    });
  });

  // =========================================================================
  // POST /:characterId/close
  // =========================================================================

  describe('POST /delegation/:characterId/close', () => {
    const validCloseBody = {
      delegationAccountId: MOCK_ACCOUNT_ID,
      closeTxSignature: MOCK_TX_SIG,
    };

    it('should return 400 when account is not in revoked state', async () => {
      const character = { id: MOCK_CHARACTER_ID };
      const activeAccount = { id: MOCK_ACCOUNT_ID, delegation_status: 'active' };

      mockFromAuth.mockImplementation((table: string) => {
        if (table === 'characters') {
          return makeChain({ singleResult: { data: character, error: null } });
        }
        return makeChain({ singleResult: { data: activeAccount, error: null } });
      });

      const res = await app.request(`/delegation/${MOCK_CHARACTER_ID}/close`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(validCloseBody),
      });

      expect(res.status).toBe(400);
      const json = await res.json() as { code: string };
      expect(json.code).toBe('INVALID_STATE');
    });

    it('should return 200 on successful close of a revoked account', async () => {
      const character = { id: MOCK_CHARACTER_ID };
      const revokedAccount = { id: MOCK_ACCOUNT_ID, delegation_status: 'revoked' };
      const closedAccount = makeDelegationAccountRow({
        delegation_status: 'closed',
        close_tx_signature: MOCK_TX_SIG,
      });

      let callCount = 0;
      mockFromAuth.mockImplementation((table: string) => {
        if (table === 'characters') {
          return makeChain({ singleResult: { data: character, error: null } });
        }
        callCount++;
        if (callCount === 1) {
          return makeChain({ singleResult: { data: revokedAccount, error: null } });
        }
        const chain = makeChain();
        chain.update = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn(() =>
          Promise.resolve({ data: closedAccount, error: null })
        );
        return chain;
      });

      const res = await app.request(`/delegation/${MOCK_CHARACTER_ID}/close`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(validCloseBody),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as { delegationStatus: string };
      expect(json.delegationStatus).toBe('closed');
    });

    it('should return 401 without auth', async () => {
      const res = await app.request(`/delegation/${MOCK_CHARACTER_ID}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validCloseBody),
      });

      expect(res.status).toBe(401);
    });
  });
});
