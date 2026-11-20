import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  bboxQuery,
  createReportBody,
  geocodeSearchQuery,
  historyBody,
  limitQuery,
  profilePatch,
  reverseQuery,
  routeBody,
  savedLocationBody,
  savedLocationPatch,
  uuidParam,
  voteBody,
} from '../validation/schemas.js';

export function createApiRouter({ maps, reports, account, supabase, limiters }) {
  const api = Router();
  const auth = requireAuth(supabase);
  const maybeAuth = optionalAuth(supabase);

  api.get('/health', (_req, res) => res.json({ status: 'ok' }));
  api.get('/capabilities', maps.capabilities);

  // Maps: public, rate-limited per IP.
  api.get('/geocode/search', limiters.geocode, validate({ query: geocodeSearchQuery }), maps.search);
  api.get('/geocode/reverse', limiters.geocode, validate({ query: reverseQuery }), maps.reverse);
  api.post('/routes', limiters.route, validate({ body: routeBody }), maps.route);
  api.get('/traffic', validate({ query: bboxQuery }), maps.trafficFlow);

  // Community reports: browsing is public, writing requires an account.
  api.get('/reports', validate({ query: bboxQuery }), maybeAuth, reports.list);
  api.get('/reports/mine', auth, validate({ query: limitQuery }), reports.mine);
  api.post('/reports', auth, limiters.reports, validate({ body: createReportBody }), reports.create);
  api.post('/reports/:id/votes', auth, limiters.votes, validate({ params: uuidParam, body: voteBody }), reports.vote);
  api.delete('/reports/:id', auth, validate({ params: uuidParam }), reports.withdraw);

  // Account data: private to the signed-in user (also enforced by RLS).
  api.get('/profile', auth, account.getProfile);
  api.patch('/profile', auth, validate({ body: profilePatch }), account.updateProfile);

  api.get('/saved-locations', auth, account.listSaved);
  api.post('/saved-locations', auth, validate({ body: savedLocationBody }), account.createSaved);
  api.patch('/saved-locations/:id', auth, validate({ params: uuidParam, body: savedLocationPatch }), account.updateSaved);
  api.delete('/saved-locations/:id', auth, validate({ params: uuidParam }), account.deleteSaved);

  api.get('/history', auth, validate({ query: limitQuery }), account.listHistory);
  api.post('/history', auth, validate({ body: historyBody }), account.addHistory);
  api.delete('/history', auth, account.clearHistory);
  api.delete('/history/:id', auth, validate({ params: uuidParam }), account.deleteHistoryEntry);

  return api;
}
