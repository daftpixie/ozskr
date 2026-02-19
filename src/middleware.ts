/**
 * Edge Middleware — Auth + Whitelist Gate
 * Redirects unauthenticated users away from protected routes.
 * Redirects authenticated-but-not-whitelisted users to landing with ?access=restricted.
 * Uses JWT decode (edge-compatible via jose) for whitelist check.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PROTECTED_PREFIXES = ['/dashboard', '/agents', '/analytics', '/settings'];

function redirectToLanding(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/';
  url.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('ozskr_session');

  if (!sessionCookie?.value) {
    return redirectToLanding(request);
  }

  // Decode JWT to check whitelist claim
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    // Fail open if JWT_SECRET not configured (dev safety)
    return NextResponse.next();
  }

  // Get the actual JWT token from the cookie
  // The cookie is either "1" (legacy flag) or the JWT itself
  // If it's just "1", we can't decode it — fall through to AuthGuard
  if (sessionCookie.value === '1') {
    return NextResponse.next();
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(sessionCookie.value, secret);

    if (!payload.is_whitelisted) {
      // Authenticated but not whitelisted — redirect to landing with message
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('access', 'restricted');
      return NextResponse.redirect(url);
    }
  } catch {
    // Invalid JWT — let AuthGuard handle the actual auth validation
    // Don't block here to avoid false positives with the "1" cookie value
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - /api (API routes)
     * - /_next (Next.js internals)
     * - /favicon.ico, static files
     */
    '/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
