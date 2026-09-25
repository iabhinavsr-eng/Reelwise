/** Errors carry a customer-friendly message; raw details stay in logs. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'auth' | 'validation' | 'unknown' = 'unknown',
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const NETWORK_HINTS = ['network request failed', 'failed to fetch', 'network error', 'timeout', 'load failed'];

export function isNetworkError(e: unknown): boolean {
  const message = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
  return NETWORK_HINTS.some((hint) => message.includes(hint));
}

export function friendlyMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (e instanceof AppError) return e.message;
  if (isNetworkError(e)) return 'You seem to be offline. Check your connection and try again.';
  if (__DEV__) console.warn(e);
  return fallback;
}
