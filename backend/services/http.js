import { HttpError } from '../utils/httpError.js';

// fetch() wrapper for upstream providers: timeout, User-Agent, JSON parsing,
// and conversion of upstream failures into 502/504 errors.
export function createHttpClient({ userAgent, timeoutMs, fetchImpl = globalThis.fetch }) {
  return async function fetchJson(url, { method = 'GET', headers = {}, body, allowStatuses = [] } = {}) {
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          Accept: 'application/json',
          'User-Agent': userAgent,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new HttpError(504, 'The map service took too long to respond.', { code: 'UPSTREAM_TIMEOUT' });
      }
      throw new HttpError(502, 'The map service is unreachable.', { code: 'UPSTREAM_UNAVAILABLE' });
    }

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok && !allowStatuses.includes(response.status)) {
      if (response.status === 429) {
        throw new HttpError(503, 'The map service is busy. Please try again shortly.', { code: 'UPSTREAM_RATE_LIMITED' });
      }
      throw new HttpError(502, 'The map service returned an error.', {
        code: 'UPSTREAM_ERROR',
        details: { status: response.status },
      });
    }
    return { status: response.status, data };
  };
}
