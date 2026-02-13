/**
 * Edge Middleware — Auth Gate
 * Redirects unauthenticated users away from protected routes before page load.
 * Real JWT validation still happens in AuthGuard; this is the fast-path cookie check.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/dashboard', '/agents', '/analytics', '/settings'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('ozskr_session');

  if (sessionCookie?.value) {
    return NextResponse.next();
  }

  // Redirect to landing page with return URL
  const url = request.nextUrl.clone();
  url.pathname = '/';
  url.searchParams.set('redirect', pathname);
  return NextResponse.redirect(url);
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
