import { HttpError } from '../utils/httpError.js';

// Validates request parts against zod schemas. Parsed values are exposed on
// req.valid so controllers never read unvalidated input.
export const validate = (schemas) => (req, _res, next) => {
  req.valid = {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: [part, ...issue.path].join('.'),
        message: issue.message,
      }));
      return next(new HttpError(400, details[0]?.message || 'Invalid request.', { code: 'VALIDATION_ERROR', details }));
    }
    req.valid[part] = result.data;
  }
  next();
};
