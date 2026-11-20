// Thin fetch wrapper for the Lesgo API. Attaches the Supabase access
// token when signed in and normalises errors into ApiError.

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

let getAccessToken = async () => null;
export function setAccessTokenProvider(fn) {
  getAccessToken = fn;
}

export class ApiError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch(path, { method = 'GET', body, query, signal } = {}) {
  const url = new URL(`${BASE_URL}/api${path}`, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(0, 'Cannot reach the Lesgo server. Check your connection.', { code: 'NETWORK_ERROR' });
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, data?.error?.message || `Request failed (${response.status}).`, {
      code: data?.error?.code,
      details: data?.error?.details,
    });
  }
  return data;
}
