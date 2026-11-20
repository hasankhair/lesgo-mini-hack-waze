import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

// In-memory limiters. For multiple API instances, configure a shared store
// (e.g. rate-limit-redis). The database also rate-limits report creation.
const make = (windowMs, limit, message, keyByUser = false) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: keyByUser ? (req) => req.user?.id ?? ipKeyGenerator(req.ip) : (req) => ipKeyGenerator(req.ip),
    handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message } }),
  });

export function createRateLimiters(limits) {
  return {
    api: make(15 * 60 * 1000, limits.apiPerWindow, 'Too many requests. Please slow down.'),
    geocode: make(60 * 1000, limits.geocodePerMinute, 'Too many searches. Please wait a moment.'),
    route: make(60 * 1000, limits.routePerMinute, 'Too many route requests. Please wait a moment.'),
    reports: make(60 * 1000, limits.reportsPerMinute, 'You are reporting too quickly. Please wait a minute.', true),
    votes: make(60 * 1000, limits.votesPerMinute, 'Too many votes. Please wait a minute.', true),
  };
}
