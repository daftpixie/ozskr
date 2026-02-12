/**
 * Application Error Types
 * Typed error classes with consistent error codes and status codes
 */

export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Application error with typed error codes and HTTP status
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Factory: Unauthorized request (missing or invalid auth)
   */
  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(message, ErrorCode.UNAUTHORIZED, 401);
  }

  /**
   * Factory: Forbidden (authenticated but lacking permissions)
   */
  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(message, ErrorCode.FORBIDDEN, 403);
  }

  /**
   * Factory: Resource not found
   */
  static notFound(resource = 'Resource'): AppError {
    return new AppError(`${resource} not found`, ErrorCode.NOT_FOUND, 404);
  }

  /**
   * Factory: Validation error with optional details
   */
  static validation(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(message, ErrorCode.VALIDATION_ERROR, 400, details);
  }

  /**
   * Factory: Rate limit exceeded
   */
  static rateLimited(message = 'Rate limit exceeded'): AppError {
    return new AppError(message, ErrorCode.RATE_LIMITED, 429);
  }

  /**
   * Factory: Database operation failed
   */
  static database(message = 'Database operation failed'): AppError {
    return new AppError(message, ErrorCode.DATABASE_ERROR, 500);
  }

  /**
   * Factory: External service error (Supabase, Upstash, Claude API, etc.)
   */
  static external(service: string, message?: string): AppError {
    const errorMessage = message
      ? `External service error (${service}): ${message}`
      : `External service error: ${service}`;
    return new AppError(errorMessage, ErrorCode.EXTERNAL_SERVICE_ERROR, 502);
  }

  /**
   * Factory: Internal server error
   */
  static internal(message = 'Internal server error'): AppError {
    return new AppError(message, ErrorCode.INTERNAL_ERROR, 500);
  }
}
