/**
 * RF-98 — retry layer.
 *
 * "All API calls shall retry on 408, 425, 429, 500, 502, 503 and 504 with
 * exponential backoff, jitter and Retry-After support, under an
 * AbortController timeout."
 *
 * Constants mirror the original implementation in /config.js (observed
 * 2026-09-28): retries = 4, baseDelayMs = 600, maxDelayMs = 6000,
 * timeoutMs = 12000, jitter = floor(random * 350) ms, and the delay is
 * `Retry-After` when present and greater than zero, otherwise exponential.
 */

import { ref } from 'vue';
import type { ActionName, ApiRequest, ApiResponse } from '../api/contract';
import { ApiHttpError, isRetryableStatus } from '../api/errors';
import { callApi } from '../api/mock';

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  retryLabel?: string;
}

const DEFAULTS: Required<Omit<RetryOptions, 'retryLabel'>> = {
  retries: 4,
  baseDelayMs: 600,
  maxDelayMs: 6000,
  timeoutMs: 12000,
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Exponential backoff with jitter, honouring Retry-After (RF-98). */
export function computeDelayMs(
  attempt: number,
  retryAfterMs: number | undefined,
  options?: RetryOptions,
): number {
  const base = options?.baseDelayMs ?? DEFAULTS.baseDelayMs;
  const max = options?.maxDelayMs ?? DEFAULTS.maxDelayMs;
  const exponential = Math.min(max, base * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 350);
  return (retryAfterMs !== undefined && retryAfterMs > 0 ? retryAfterMs : exponential) + jitter;
}

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException ? error.name === 'AbortError' : false;

/**
 * Composable wrapper around the (mock) API applying RF-98. Exposes the live
 * attempt counter so pages can show retry state.
 */
export function useApiRetry() {
  const pending = ref(false);
  const attempts = ref(0);
  const lastLabel = ref<string | null>(null);

  async function call<A extends ActionName>(
    action: A,
    request: ApiRequest<A>,
    options?: RetryOptions,
  ): Promise<ApiResponse<A>> {
    const retries = options?.retries ?? DEFAULTS.retries;
    const timeoutMs = options?.timeoutMs ?? DEFAULTS.timeoutMs;
    const retryLabel = options?.retryLabel ?? 'Cloud request';

    pending.value = true;
    lastLabel.value = retryLabel;
    attempts.value = 0;

    let lastError: unknown = null;

    try {
      for (let attempt = 0; attempt <= retries; attempt++) {
        attempts.value = attempt + 1;

        // AbortController timeout around each attempt (RF-98).
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const abortPromise = new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () =>
            reject(new DOMException(`${retryLabel} timed out`, 'AbortError')),
          );
        });

        try {
          const response = await Promise.race([callApi(action, request), abortPromise]);
          return response;
        } catch (error) {
          lastError = error;

          // A definite non-retryable HTTP status surfaces immediately.
          if (error instanceof ApiHttpError && !isRetryableStatus(error.status)) {
            throw error;
          }
          if (attempt === retries) {
            if (isAbortError(error) || error instanceof ApiHttpError) throw error;
            throw lastError;
          }
        } finally {
          clearTimeout(timeout);
        }

        const retryAfterMs = lastError instanceof ApiHttpError ? lastError.retryAfterMs : undefined;
        await sleep(computeDelayMs(attempt, retryAfterMs, options));
      }

      throw lastError ?? new Error(`${retryLabel} failed`);
    } finally {
      pending.value = false;
    }
  }

  return { call, pending, attempts, lastLabel };
}
