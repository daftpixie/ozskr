'use client';

/**
 * React Error Boundary
 * Catches rendering errors and displays user-friendly fallback UI
 */

import React from 'react';
import { logger } from '@/lib/utils/logger';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Default error fallback UI
 */
function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-void-black p-4">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-black/50 p-8 text-center">
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="mb-2 text-xl font-semibold text-white">Something went wrong</h2>
        <p className="mb-6 text-sm text-white/60">
          An unexpected error occurred. Please try again or contact support if the problem
          persists.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-4 rounded bg-black/30 p-4 text-left">
            <summary className="cursor-pointer text-xs font-mono text-white/40">
              Error details (dev only)
            </summary>
            <pre className="mt-2 overflow-auto text-xs text-red-400">{error.message}</pre>
          </details>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-md bg-solana-purple px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-solana-purple/90 focus:outline-none focus:ring-2 focus:ring-solana-purple focus:ring-offset-2 focus:ring-offset-void-black"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

/**
 * Error Boundary Component
 * Must be a class component per React requirements
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to structured logger
    logger.error('React Error Boundary caught error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} reset={this.reset} />;
    }

    return this.props.children;
  }
}
