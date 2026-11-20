export class HttpError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Maps errors raised by Postgres/PostgREST (including the custom SQLSTATEs in
// the migration) to HTTP errors with user-facing messages.
const CUSTOM_CODES = {
  RP429: [429, 'RATE_LIMITED'],
  RP409: [409, 'DUPLICATE_REPORT'],
  RP410: [410, 'REPORT_NOT_ACTIVE'],
  RP403: [403, 'OWN_REPORT'],
  RP422: [422, 'INVALID_STATUS_CHANGE'],
};

export function fromSupabaseError(error, fallbackMessage = 'Database request failed') {
  if (!error) return null;
  if (CUSTOM_CODES[error.code]) {
    const [status, code] = CUSTOM_CODES[error.code];
    return new HttpError(status, error.message, { code });
  }
  switch (error.code) {
    case '23505':
      return new HttpError(409, 'That value is already in use.', { code: 'CONFLICT' });
    case '23514':
    case '22P02':
      return new HttpError(400, 'Invalid data.', { code: 'INVALID_DATA' });
    case '23503':
      return new HttpError(404, 'Related record not found.', { code: 'NOT_FOUND' });
    case '42501':
      return new HttpError(403, 'You are not allowed to do that.', { code: 'FORBIDDEN' });
    case 'PGRST116':
      return new HttpError(404, 'Not found.', { code: 'NOT_FOUND' });
    default:
      return new HttpError(502, fallbackMessage, { code: 'DATABASE_ERROR' });
  }
}
