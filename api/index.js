// Vercel serverless entry point. Every /api/* request is handled by the
// same Express app that `npm start` runs locally (backend/app.js).
import { createApp } from '../backend/app.js';
import { loadConfig } from '../backend/config/env.js';

const config = loadConfig({
  ...process.env,
  // Vercel sits in front of the function as one proxy hop; trust it so rate
  // limiting sees the real client IP.
  TRUST_PROXY: process.env.TRUST_PROXY || '1',
});

export default createApp(config);
