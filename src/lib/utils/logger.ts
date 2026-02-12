/**
 * Structured Logger
 * Lightweight structured logging for production code.
 * Outputs JSON in production, pretty-prints in development.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  walletAddress?: string;
  route?: string;
  durationMs?: number;
  [key: string]: unknown;
}

const formatEntry = (entry: LogEntry): string => {
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify(entry);
  }
  const { level, message, timestamp: _ts, ...rest } = entry;
  const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
  return `[${level.toUpperCase()}] ${message}${extra}`;
};

/** Keys that should be redacted from log output */
const SENSITIVE_KEYS = new Set([
  'password', 'secret', 'token', 'apiKey', 'api_key',
  'privateKey', 'private_key', 'secretKey', 'secret_key',
  'authorization', 'cookie', 'ayrshare_profile_key',
]);

/** Redact sensitive values from metadata */
const redactSensitive = (meta: Record<string, unknown>): Record<string, unknown> => {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
};

const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
  // Skip debug logs in production
  if (level === 'debug' && process.env.NODE_ENV === 'production') {
    return;
  }

  const safeMeta = meta ? redactSensitive(meta) : undefined;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...safeMeta,
  };

  const formatted = formatEntry(entry);

  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'debug':
      console.debug(formatted);
      break;
    default:
      console.info(formatted);
  }
};

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
};

/**
 * Create a request-scoped logger with pre-bound context
 * @param requestId - Unique request identifier
 * @param route - API route path
 * @returns Logger instance with pre-bound context
 */
export const createRequestLogger = (requestId: string, route: string) => {
  return {
    debug: (message: string, meta?: Record<string, unknown>) =>
      log('debug', message, { requestId, route, ...meta }),
    info: (message: string, meta?: Record<string, unknown>) =>
      log('info', message, { requestId, route, ...meta }),
    warn: (message: string, meta?: Record<string, unknown>) =>
      log('warn', message, { requestId, route, ...meta }),
    error: (message: string, meta?: Record<string, unknown>) =>
      log('error', message, { requestId, route, ...meta }),
  };
};
