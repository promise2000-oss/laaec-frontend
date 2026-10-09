/**
 * API error carrying an HTTP status, used by the retry layer (RF-98) to decide
 * whether a failure is retryable. The mock adapter throws it when a retryable
 * status is injected via `failNextCall`.
 */
export class ApiHttpError extends Error {
  readonly status: number;
  /** Milliseconds derived from a `Retry-After` header, where one was sent. */
  readonly retryAfterMs?: number;
  readonly data?: unknown;

  constructor(message: string, status: number, options?: { retryAfterMs?: number; data?: unknown }) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
    this.retryAfterMs = options?.retryAfterMs;
    this.data = options?.data;
  }
}

/** RF-98 retryable statuses, verbatim. */
export const RETRYABLE_STATUSES: readonly number[] = [408, 425, 429, 500, 502, 503, 504];

export const isRetryableStatus = (status: number): boolean => RETRYABLE_STATUSES.includes(status);
