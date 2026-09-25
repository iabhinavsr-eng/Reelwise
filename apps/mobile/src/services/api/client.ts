import { env } from '@/config/env';
import { AppError, isNetworkError } from '@/lib/errors';
import { authService } from '@/services/auth';

/**
 * Thin client for the Reelwise API. Sends the signed-in user's credentials;
 * never holds any server secret.
 */
export class ApiError extends AppError {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message, status === 0 ? 'network' : status === 401 ? 'auth' : 'unknown');
  }
}

export async function apiRequest<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  if (!env.apiUrl) throw new ApiError('The Reelwise API isn’t configured.', 0, 'not_configured');
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(await authService.getApiHeaders()) };
  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    throw new ApiError(
      isNetworkError(e) ? 'You seem to be offline. Check your connection and try again.' : 'We couldn’t reach Reelwise. Please try again.',
      0,
      'network',
    );
  }
  const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  if (!res.ok) {
    throw new ApiError(body?.error?.message ?? 'Something went wrong. Please try again.', res.status, body?.error?.code ?? 'unknown');
  }
  return body as T;
}
