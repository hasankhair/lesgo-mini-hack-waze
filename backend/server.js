import { createApp } from './app.js';
import { loadConfig, isSupabaseConfigured } from './config/env.js';

const config = loadConfig();
const app = createApp(config);

const server = app.listen(config.port, () => {
  console.log(`Lesgo API listening on http://localhost:${config.port}`);
  console.log(`  geocoding: ${config.geocoding.provider}  routing: ${config.routing.provider}  traffic: ${config.traffic.provider}`);
  if (!isSupabaseConfigured(config)) {
    console.warn('  Supabase is not configured: accounts and community reports are disabled.');
  }
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
