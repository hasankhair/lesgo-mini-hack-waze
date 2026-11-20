import { HttpError } from '../utils/httpError.js';

const bearer = (req) => {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
};

const ensureConfigured = (supabase) => {
  if (!supabase) {
    throw new HttpError(503, 'Accounts and community reports are unavailable: Supabase is not configured.', {
      code: 'SUPABASE_NOT_CONFIGURED',
    });
  }
};

// Requires a valid Supabase session. Sets req.user and a user-scoped client
// (req.db) so every query runs under that user's RLS policies.
export const requireAuth = (supabase) => async (req, _res, next) => {
  try {
    ensureConfigured(supabase);
    const token = bearer(req);
    if (!token) throw new HttpError(401, 'Please sign in to continue.', { code: 'UNAUTHENTICATED' });
    const user = await supabase.verifyToken(token);
    if (!user) throw new HttpError(401, 'Your session has expired. Please sign in again.', { code: 'INVALID_TOKEN' });
    req.user = { id: user.id, email: user.email };
    req.db = supabase.forUser(token);
    next();
  } catch (err) {
    next(err);
  }
};

// Attaches the user when a valid token is present; otherwise continues as anon.
export const optionalAuth = (supabase) => async (req, _res, next) => {
  try {
    ensureConfigured(supabase);
    const token = bearer(req);
    const user = token ? await supabase.verifyToken(token) : null;
    if (user) {
      req.user = { id: user.id, email: user.email };
      req.db = supabase.forUser(token);
    } else {
      req.db = supabase.anon();
    }
    next();
  } catch (err) {
    next(err);
  }
};
