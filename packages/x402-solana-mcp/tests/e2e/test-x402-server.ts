import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { encodePaymentRequiredHeader } from '@x402/core/http';

// ---------------------------------------------------------------------------
// Test x402 HTTP Server
// ---------------------------------------------------------------------------

/**
 * Minimal HTTP server that simulates an x402-enabled endpoint.
 * Returns 402 with X-Payment-Required header for unauthenticated requests.
 * Returns 200 with content when X-Payment-Signature header is present.
 */

const V2_PAYMENT_REQUIRED = {
  x402Version: 2,
  error: 'Payment Required',
  resource: { url: 'http://localhost/data' },
  accepts: [
    {
      scheme: 'exact',
      network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
      amount: '1000000',
      asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      payTo: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      maxTimeoutSeconds: 30,
    },
  ],
};

function parseHeaders(req: IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') {
      headers[key.toLowerCase()] = value;
    } else if (Array.isArray(value)) {
      headers[key.toLowerCase()] = value[0];
    }
  }
  return headers;
}

function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = req.url ?? '/';
  const headers = parseHeaders(req);

  // Free endpoint - no payment required
  if (url === '/free') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Free content - no payment required');
    return;
  }

  // Paid endpoint - require x402 payment
  if (url === '/data') {
    const hasPaymentProof = 'x-payment-signature' in headers;

    if (hasPaymentProof) {
      // Return success with content when payment signature is present
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'X-Payment-Response': Buffer.from(
          JSON.stringify({
            success: true,
            transaction: 'test-tx-sig-' + Date.now(),
            network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
            payer: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          }),
        ).toString('base64'),
      });
      res.end(JSON.stringify({ data: 'Premium content - paid access' }));
    } else {
      // Return 402 with payment requirements
      const encodedHeader = encodePaymentRequiredHeader(
        V2_PAYMENT_REQUIRED as Parameters<typeof encodePaymentRequiredHeader>[0],
      );

      res.writeHead(402, {
        'Content-Type': 'application/json',
        'X-Payment-Required': encodedHeader,
      });
      res.end(JSON.stringify({ error: 'Payment Required' }));
    }
    return;
  }

  // 404 for unknown paths
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

// ---------------------------------------------------------------------------
// Server Lifecycle
// ---------------------------------------------------------------------------

export interface TestServerHandle {
  port: number;
  url: string;
  close: () => Promise<void>;
}

/**
 * Starts the test x402 server on a random available port.
 * Returns a handle with the port and a close function for cleanup.
 */
export function startServer(): Promise<TestServerHandle> {
  return new Promise((resolve, reject) => {
    const server = createServer(handleRequest);

    server.on('error', reject);

    // Listen on port 0 to get a random available port
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to get server address'));
        return;
      }

      const port = address.port;
      const url = `http://localhost:${port}`;

      resolve({
        port,
        url,
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            server.close((err) => {
              if (err) rejectClose(err);
              else resolveClose();
            });
          }),
      });
    });
  });
}
