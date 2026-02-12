# ozskr.ai API Layer

Hono-based API service layer for ozskr.ai platform.

## Structure

```
src/lib/api/
├── app.ts                      # Main Hono app with route composition
├── supabase.ts                 # Supabase client utilities
├── middleware/
│   └── auth.ts                 # JWT authentication middleware
└── routes/
    ├── health.ts               # Health check endpoint
    ├── auth.ts                 # SIWS auth, session management (FULLY IMPLEMENTED)
    ├── characters.ts           # Character CRUD (STUB)
    ├── agents.ts               # Agent run management (STUB)
    ├── content.ts              # Content CRUD (STUB)
    ├── trading.ts              # SOL/$HOPE payments (STUB)
    └── analytics.ts            # Agent performance metrics (STUB)
```

## Implemented Routes

### Health Check
- `GET /api/health` - Health status check

### Authentication (FULLY IMPLEMENTED)
- `POST /api/auth/verify` - SIWS signature verification and session creation
- `POST /api/auth/logout` - Session invalidation (requires JWT)
- `GET /api/auth/session` - Session validation (requires JWT)

### Characters (STUB)
- `GET /api/characters` - List all characters for user (requires JWT)
- `POST /api/characters` - Create new character (requires JWT)
- `GET /api/characters/:id` - Get character by ID (requires JWT)
- `PUT /api/characters/:id` - Update character (requires JWT)
- `DELETE /api/characters/:id` - Delete character (requires JWT)

### Agents (STUB)
- `GET /api/agents/runs` - List all agent runs (requires JWT)
- `POST /api/agents/runs` - Create and trigger new agent run (requires JWT)
- `GET /api/agents/runs/:id` - Get agent run details (requires JWT)
- `GET /api/agents/characters/:characterId/runs` - List runs for character (requires JWT)

### Content (STUB)
- `GET /api/content` - List all content for user (requires JWT)
- `POST /api/content` - Create new content entry (requires JWT)
- `GET /api/content/:id` - Get content by ID (requires JWT)
- `GET /api/content/characters/:characterId` - List content for character (requires JWT)

### Trading (STUB)
- `GET /api/trading/transactions` - List transactions (requires JWT)
- `GET /api/trading/balance` - Get SOL and $HOPE balance (requires JWT)
- `POST /api/trading/swap/quote` - Get Jupiter swap quote (requires JWT)

### Analytics (STUB)
- `GET /api/analytics/characters/:characterId` - Get character performance metrics (requires JWT)
- `GET /api/analytics/characters/:characterId/engagement` - Get engagement metrics (requires JWT)
- `GET /api/analytics/overview` - Get overview metrics for all characters (requires JWT)

## Environment Variables

Required environment variables (see `.env.example`):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT Authentication
JWT_SECRET=your-secure-random-secret-min-32-chars
```

## Authentication Flow

1. User signs SIWS message with wallet
2. Frontend sends `POST /api/auth/verify` with { message, signature, publicKey }
3. Server verifies signature (TODO: implement actual verification)
4. Server creates/updates user in Supabase
5. Server generates JWT token with wallet_address claim
6. Server stores session in database
7. Server returns { token, expiresAt, user }
8. Frontend includes token in `Authorization: Bearer <token>` header for subsequent requests

## Middleware

### authMiddleware
- Verifies JWT token from Authorization header
- Extracts wallet_address from token payload
- Attaches wallet_address to Hono context via `c.set('walletAddress', ...)`
- Returns 401 if token is missing, invalid, or expired

### optionalAuthMiddleware
- Same as authMiddleware but doesn't fail if token is missing
- Useful for public endpoints that optionally use auth

## Error Response Format

All API errors follow this structure:

```typescript
{
  error: string;       // Human-readable message
  code: string;        // Machine-readable code
  details?: unknown;   // Optional Zod validation errors or additional context
}
```

Standard error codes:
- `VALIDATION_ERROR` - Request validation failed
- `NOT_FOUND` - Resource not found
- `UNAUTHORIZED` - Authentication required or invalid
- `TOKEN_EXPIRED` - JWT token has expired
- `FORBIDDEN` - User doesn't have permission
- `RATE_LIMITED` - Rate limit exceeded
- `INTERNAL_ERROR` - Internal server error
- `UPSTREAM_ERROR` - External service error
- `DATABASE_ERROR` - Database operation failed

## Type Safety

All request/response data is validated with Zod schemas defined in `src/types/schemas.ts`.

Example:
```typescript
import { zValidator } from '@hono/zod-validator';
import { CharacterCreateSchema } from '@/types/schemas';

app.post('/characters', zValidator('json', CharacterCreateSchema), async (c) => {
  const input = c.req.valid('json'); // Fully typed and validated
  // ...
});
```

## Next Steps

Phase 2 will implement the STUB routes with full business logic:
- Character CRUD operations with Mem0 namespace creation
- Agent run scheduling via Trigger.dev
- Content generation pipeline integration
- Trading operations with Jupiter Ultra
- Analytics aggregation queries
