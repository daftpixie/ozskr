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

const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
  // Skip debug logs in production
  if (level === 'debug' && process.env.NODE_ENV === 'production') {
    return;
  }

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  const formatted = formatEntry(entry);

  switch (level) {
    case 'error':
      // eslint-disable-next-line no-console
      console.error(formatted);
      break;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(formatted);
      break;
    case 'debug':
      // eslint-disable-next-line no-console
      console.debug(formatted);
      break;
    default:
      // eslint-disable-next-line no-console
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
