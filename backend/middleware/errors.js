import { HttpError } from '../utils/httpError.js';

export const notFound = (req, _res, next) => next(new HttpError(404, `Route ${req.method} ${req.path} not found.`, { code: 'NOT_FOUND' }));

// Final error handler. Never leaks stack traces or internal messages for 5xx.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (logger) => (err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' } });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
  }
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) logger.error(err);
  const message = err instanceof HttpError ? err.message : 'Something went wrong. Please try again.';
  res.status(status).json({
    error: {
      code: err?.code && err instanceof HttpError ? err.code : 'INTERNAL_ERROR',
      message,
      ...(err instanceof HttpError && err.details && status < 500 ? { details: err.details } : {}),
    },
  });
};
