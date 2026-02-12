/**
 * Structured Logger
 * Lightweight structured logging for production code.
 * Outputs JSON in production, pretty-prints in development.
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
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
    default:
      // eslint-disable-next-line no-console
      console.info(formatted);
  }
};

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
};
