import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { isSupabaseConfigured } from './config/env.js';
import { createHttpClient } from './services/http.js';
import { createCache } from './services/cache.js';
import { createGeocoder } from './services/geocoding/index.js';
import { createRouter } from './services/routing/index.js';
import { createTrafficProvider } from './services/traffic/index.js';
import { createSupabaseFactory } from './services/supabase.js';
import { createRateLimiters } from './middleware/rateLimits.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { createMapsController } from './controllers/mapsController.js';
import { createReportsController } from './controllers/reportsController.js';
import { createAccountController } from './controllers/accountController.js';
import { createApiRouter } from './routes/index.js';

// Builds the Express app. Every external dependency can be injected, which is
// how the tests run without network access or a live Supabase project.
export function createApp(config, overrides = {}) {
  const logger = overrides.logger ?? console;
  const fetchJson =
    overrides.fetchJson ?? createHttpClient({ userAgent: config.userAgent, timeoutMs: config.upstreamTimeoutMs });

  const geocoder = overrides.geocoder ?? createGeocoder(config, fetchJson);
  const router = overrides.router ?? createRouter(config, fetchJson);
  const traffic = overrides.traffic ?? createTrafficProvider(config);
  const supabase =
    overrides.supabase !== undefined
      ? overrides.supabase
      : isSupabaseConfigured(config)
        ? createSupabaseFactory(config.supabase)
        : null;

  const limiters = createRateLimiters(config.rateLimits);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '20kb' }));

  app.use(
    '/api',
    limiters.api,
    createApiRouter({
      maps: createMapsController({
        geocoder,
        router,
        traffic,
        communityAvailable: Boolean(supabase),
        geocodeCache: createCache({ maxEntries: 1000, ttlMs: 10 * 60 * 1000 }),
        routeCache: createCache({ maxEntries: 200, ttlMs: 2 * 60 * 1000 }),
      }),
      reports: createReportsController(),
      account: createAccountController(),
      supabase,
      limiters,
    }),
  );

  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
