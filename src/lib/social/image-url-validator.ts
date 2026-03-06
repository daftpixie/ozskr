/**
 * Image URL validation — SSRF protection
 *
 * Validates that a caller-supplied image URL is a publicly-reachable HTTPS URL
 * and cannot be used to probe internal infrastructure (Vercel edge, Supabase,
 * cloud metadata endpoints, private RFC-1918 ranges, etc.).
 *
 * Strategy: parse the URL and reject any hostname that:
 *   - is not HTTPS
 *   - is an IP address (v4 or v6) — eliminates 169.254.169.254, 10.x.x.x, etc.
 *   - matches known-internal patterns (localhost, .local, .internal, .private)
 *
 * Note: DNS-based SSRF (external DNS resolving to internal IP) is addressed at
 * the infrastructure layer (Vercel egress controls). This validator stops the
 * most common attack vectors.
 */

export class ImageUrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageUrlValidationError';
  }
}

/** Patterns that indicate a non-public / internal hostname */
const INTERNAL_HOSTNAME_RE =
  /^(localhost|.*\.local|.*\.internal|.*\.private|.*\.intranet|.*\.corp|.*\.lan)$/i;

/** IPv4 address (optionally port) */
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/;

/** IPv6 address (various bracket forms) */
const IPV6_RE = /^\[[:0-9a-fA-F]+\]/;

/**
 * Validate that a caller-supplied image URL is a safe, public HTTPS URL.
 *
 * Throws ImageUrlValidationError if the URL fails validation.
 */
export function validatePublicImageUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ImageUrlValidationError(`imageUrl is not a valid URL: ${rawUrl}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new ImageUrlValidationError(
      `imageUrl must use HTTPS (got ${parsed.protocol})`,
    );
  }

  const host = parsed.hostname;

  // Reject bare IP addresses — these are the primary SSRF vector.
  // Named hostnames are validated below; DNS-level SSRF is out of scope here.
  if (IPV4_RE.test(host) || IPV6_RE.test(host)) {
    throw new ImageUrlValidationError(
      `imageUrl hostname must be a domain name, not an IP address (got ${host})`,
    );
  }

  // Reject known-internal hostname patterns
  if (INTERNAL_HOSTNAME_RE.test(host)) {
    throw new ImageUrlValidationError(
      `imageUrl hostname refers to an internal address (${host})`,
    );
  }

  return parsed;
}
