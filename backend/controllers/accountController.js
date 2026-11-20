import { HttpError, fromSupabaseError } from '../utils/httpError.js';

const SAVED_COLUMNS = 'id, location_name, category, address, latitude, longitude, created_at';
const HISTORY_COLUMNS =
  'id, origin_label, origin_latitude, origin_longitude, destination_label, destination_latitude, destination_longitude, distance_meters, estimated_duration_seconds, created_at';
const PROFILE_COLUMNS = 'id, username, email, avatar_url, save_history, created_at';

const throwIf = (error, message) => {
  if (error) throw fromSupabaseError(error, message);
};

// Coarsen the trip origin (~110 m) so history does not pinpoint where a user lives.
const coarse = (n) => Math.round(n * 1000) / 1000;

export function createAccountController() {
  return {
    async getProfile(req, res) {
      const { data, error } = await req.db.from('profiles').select(PROFILE_COLUMNS).eq('id', req.user.id).maybeSingle();
      throwIf(error, 'Could not load your profile.');
      if (!data) throw new HttpError(404, 'Profile not found.', { code: 'NOT_FOUND' });
      res.json({ profile: data });
    },

    async updateProfile(req, res) {
      const patch = Object.fromEntries(Object.entries(req.valid.body).filter(([, v]) => v !== undefined));
      const { data, error } = await req.db.from('profiles').update(patch).eq('id', req.user.id).select(PROFILE_COLUMNS).single();
      if (error?.code === '23505') throw new HttpError(409, 'That username is taken.', { code: 'USERNAME_TAKEN' });
      throwIf(error, 'Could not update your profile.');
      res.json({ profile: data });
    },

    async listSaved(req, res) {
      const { data, error } = await req.db.from('saved_locations').select(SAVED_COLUMNS).order('created_at', { ascending: false }).limit(200);
      throwIf(error, 'Could not load saved places.');
      res.json({ locations: data || [] });
    },

    async createSaved(req, res) {
      const body = req.valid.body;
      // Home and Work are single slots: saving a new one replaces the old one.
      if (body.category === 'home' || body.category === 'work') {
        const { error } = await req.db.from('saved_locations').delete().eq('user_id', req.user.id).eq('category', body.category);
        throwIf(error, 'Could not save the place.');
      }
      const { data, error } = await req.db
        .from('saved_locations')
        .insert({ ...body, address: body.address || null, user_id: req.user.id })
        .select(SAVED_COLUMNS)
        .single();
      throwIf(error, 'Could not save the place.');
      res.status(201).json({ location: data });
    },

    async updateSaved(req, res) {
      const { data, error } = await req.db
        .from('saved_locations')
        .update(req.valid.body)
        .eq('id', req.valid.params.id)
        .select(SAVED_COLUMNS);
      throwIf(error, 'Could not update the place.');
      if (!data?.length) throw new HttpError(404, 'Saved place not found.', { code: 'NOT_FOUND' });
      res.json({ location: data[0] });
    },

    async deleteSaved(req, res) {
      const { data, error } = await req.db.from('saved_locations').delete().eq('id', req.valid.params.id).select('id');
      throwIf(error, 'Could not delete the place.');
      if (!data?.length) throw new HttpError(404, 'Saved place not found.', { code: 'NOT_FOUND' });
      res.status(204).end();
    },

    async listHistory(req, res) {
      const { data, error } = await req.db
        .from('navigation_history')
        .select(HISTORY_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(req.valid.query.limit);
      throwIf(error, 'Could not load your history.');
      res.json({ history: data || [] });
    },

    async addHistory(req, res) {
      const { data: profile, error: profileError } = await req.db
        .from('profiles')
        .select('save_history')
        .eq('id', req.user.id)
        .maybeSingle();
      throwIf(profileError, 'Could not save history.');
      if (profile && profile.save_history === false) {
        return res.status(200).json({ saved: false, reason: 'History is turned off in your settings.' });
      }
      const { origin, destination, distance, duration } = req.valid.body;
      const { data, error } = await req.db
        .from('navigation_history')
        .insert({
          user_id: req.user.id,
          origin_label: origin?.label || null,
          origin_latitude: origin ? coarse(origin.lat) : null,
          origin_longitude: origin ? coarse(origin.lng) : null,
          destination_label: destination.label,
          destination_latitude: destination.lat,
          destination_longitude: destination.lng,
          distance_meters: distance,
          estimated_duration_seconds: duration,
        })
        .select(HISTORY_COLUMNS)
        .single();
      throwIf(error, 'Could not save history.');
      res.status(201).json({ saved: true, entry: data });
    },

    async deleteHistoryEntry(req, res) {
      const { error } = await req.db.from('navigation_history').delete().eq('id', req.valid.params.id);
      throwIf(error, 'Could not delete the entry.');
      res.status(204).end();
    },

    async clearHistory(req, res) {
      const { error } = await req.db.from('navigation_history').delete().eq('user_id', req.user.id);
      throwIf(error, 'Could not clear history.');
      res.status(204).end();
    },
  };
}
