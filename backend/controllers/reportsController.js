import { HttpError, fromSupabaseError } from '../utils/httpError.js';

export const REPORT_COLUMNS =
  'id, reporter_username, report_type, description, latitude, longitude, status, confirmation_count, not_present_count, created_at, expires_at';

const SOURCE = { source: 'community', verified: false };

const throwIf = (error, message) => {
  if (error) throw fromSupabaseError(error, message);
};

async function annotateForUser(db, userId, reports) {
  if (!userId || reports.length === 0) return reports.map((r) => ({ ...r, is_mine: false, my_vote: null }));
  const ids = reports.map((r) => r.id);
  const [owned, votes] = await Promise.all([
    db.rpc('owned_report_ids', { p_ids: ids }),
    db.from('report_confirmations').select('report_id, confirmation_type').in('report_id', ids),
  ]);
  throwIf(owned.error, 'Could not load reports.');
  throwIf(votes.error, 'Could not load reports.');
  const mine = new Set((owned.data || []).map((row) => (typeof row === 'string' ? row : row.owned_report_ids ?? row.id)));
  const voteMap = new Map((votes.data || []).map((v) => [v.report_id, v.confirmation_type]));
  return reports.map((r) => ({ ...r, is_mine: mine.has(r.id), my_vote: voteMap.get(r.id) ?? null }));
}

export function createReportsController() {
  return {
    // Public: active, unexpired community reports inside a bounding box.
    async list(req, res) {
      const { minLat, maxLat, minLng, maxLng } = req.valid.query.bbox;
      const { data, error } = await req.db
        .from('traffic_reports')
        .select(REPORT_COLUMNS)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .gte('latitude', minLat)
        .lte('latitude', maxLat)
        .gte('longitude', minLng)
        .lte('longitude', maxLng)
        .order('created_at', { ascending: false })
        .limit(500);
      throwIf(error, 'Could not load reports.');
      const reports = await annotateForUser(req.db, req.user?.id, data || []);
      res.json({ reports, ...SOURCE });
    },

    async create(req, res) {
      const { report_type, description, latitude, longitude } = req.valid.body;
      const { data, error } = await req.db
        .from('traffic_reports')
        .insert({ user_id: req.user.id, report_type, description: description || null, latitude, longitude })
        .select(REPORT_COLUMNS)
        .single();
      throwIf(error, 'Could not save your report.');
      res.status(201).json({ report: { ...data, is_mine: true, my_vote: null }, ...SOURCE });
    },

    async vote(req, res) {
      const { id } = req.valid.params;
      const { type } = req.valid.body;
      const { error } = await req.db
        .from('report_confirmations')
        .upsert({ report_id: id, user_id: req.user.id, confirmation_type: type }, { onConflict: 'report_id,user_id' });
      throwIf(error, 'Could not record your vote.');

      const { data, error: readError } = await req.db.from('traffic_reports').select(REPORT_COLUMNS).eq('id', id).maybeSingle();
      throwIf(readError, 'Could not load the report.');
      if (!data) throw new HttpError(404, 'Report not found.', { code: 'NOT_FOUND' });
      res.json({ report: { ...data, is_mine: false, my_vote: type }, ...SOURCE });
    },

    // The reporter withdraws their own report.
    async withdraw(req, res) {
      const { id } = req.valid.params;
      const { data, error } = await req.db
        .from('traffic_reports')
        .update({ status: 'removed' })
        .eq('id', id)
        .eq('status', 'active')
        .select('id, status');
      throwIf(error, 'Could not withdraw the report.');
      if (!data || data.length === 0) throw new HttpError(404, 'Active report not found.', { code: 'NOT_FOUND' });
      res.json({ report: data[0] });
    },

    async mine(req, res) {
      const { data, error } = await req.db.rpc('my_traffic_reports', { p_limit: req.valid.query.limit });
      throwIf(error, 'Could not load your reports.');
      res.json({ reports: data || [] });
    },
  };
}
