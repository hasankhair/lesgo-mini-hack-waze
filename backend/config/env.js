// Central configuration. All values come from environment variables so that
// providers and credentials can change per deployment without code changes.

const bool = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const int = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const list = (value, fallback) =>
  value ? value.split(',').map((s) => s.trim()).filter(Boolean) : fallback;

export function loadConfig(env = process.env) {
  return {
    nodeEnv: env.NODE_ENV || 'development',
    port: int(env.PORT, 4000),
    trustProxy: int(env.TRUST_PROXY, 0),
    corsOrigins: list(env.CORS_ORIGINS, ['http://localhost:5173']),
    // Identifies the app to public OSM services, as their usage policies require.
    userAgent: env.UPSTREAM_USER_AGENT || 'Lesgo/0.1 (development; set UPSTREAM_USER_AGENT)',
    upstreamTimeoutMs: int(env.UPSTREAM_TIMEOUT_MS, 10000),

    supabase: {
      url: env.SUPABASE_URL || '',
      // Public anon key only. The backend forwards each user's JWT so that RLS
      // applies to every query. No service-role key is needed or read.
      anonKey: env.SUPABASE_ANON_KEY || '',
    },

    geocoding: {
      provider: env.GEOCODING_PROVIDER || 'photon',
      photonUrl: env.PHOTON_URL || 'https://photon.komoot.io',
      nominatimUrl: env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
      nominatimEmail: env.NOMINATIM_EMAIL || '',
    },

    routing: {
      provider: env.ROUTING_PROVIDER || 'osrm',
      osrmUrl: env.OSRM_URL || 'https://router.project-osrm.org',
      // The public OSRM demo server rejects exclude=toll. Enable this only for
      // a self-hosted OSRM built with the car profile's excludable classes.
      osrmSupportsExclude: bool(env.OSRM_SUPPORTS_EXCLUDE, false),
      orsUrl: env.ORS_URL || 'https://api.openrouteservice.org',
      orsApiKey: env.ORS_API_KEY || '',
    },

    traffic: {
      provider: env.TRAFFIC_PROVIDER || 'none',
    },

    rateLimits: {
      apiPerWindow: int(env.RATE_LIMIT_API_PER_15MIN, 600),
      geocodePerMinute: int(env.RATE_LIMIT_GEOCODE_PER_MIN, 60),
      routePerMinute: int(env.RATE_LIMIT_ROUTE_PER_MIN, 30),
      reportsPerMinute: int(env.RATE_LIMIT_REPORTS_PER_MIN, 5),
      votesPerMinute: int(env.RATE_LIMIT_VOTES_PER_MIN, 30),
    },
  };
}

export const isSupabaseConfigured = (config) => Boolean(config.supabase.url && config.supabase.anonKey);
