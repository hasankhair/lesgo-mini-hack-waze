import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ALICE, REPORT_ID, authHeader, buildApp, createFakeSupabase } from './helpers.js';

const report = {
  id: REPORT_ID,
  reporter_username: 'alice',
  report_type: 'accident',
  description: 'Two cars',
  latitude: 52.52,
  longitude: 13.405,
  status: 'active',
  confirmation_count: 0,
  not_present_count: 0,
  created_at: '2025-01-01T10:00:00Z',
  expires_at: '2025-01-01T11:30:00Z',
};

describe('POST /api/reports (submission)', () => {
  it('saves a report for the signed-in user, ignoring any user_id in the body', async () => {
    const supabase = createFakeSupabase({ handle: () => ({ data: report, error: null }) });
    const res = await request(buildApp({ supabase }))
      .post('/api/reports')
      .set(authHeader)
      .send({ report_type: 'accident', description: '  Two cars  ', latitude: 52.52, longitude: 13.405, user_id: 'someone-else' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ source: 'community', verified: false, report: { id: REPORT_ID, is_mine: true } });
    const insert = supabase.ops.find((op) => op.action === 'insert');
    expect(insert.table).toBe('traffic_reports');
    expect(insert.payload).toEqual({
      user_id: ALICE.id,
      report_type: 'accident',
      description: 'Two cars',
      latitude: 52.52,
      longitude: 13.405,
    });
    expect(insert.returning).not.toContain('user_id');
  });

  it.each([
    [{ report_type: 'ufo', latitude: 1, longitude: 1 }, 'body.report_type'],
    [{ report_type: 'flood', latitude: 91, longitude: 1 }, 'body.latitude'],
    [{ report_type: 'flood', latitude: 1 }, 'body.longitude'],
    [{ report_type: 'flood', latitude: 1, longitude: 1, description: 'x'.repeat(281) }, 'body.description'],
  ])('rejects invalid input %#', async (body, field) => {
    const supabase = createFakeSupabase();
    const res = await request(buildApp({ supabase })).post('/api/reports').set(authHeader).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain(field);
    expect(supabase.ops).toHaveLength(0);
  });

  it('maps the database rate limit to HTTP 429', async () => {
    const supabase = createFakeSupabase({
      handle: () => ({ data: null, error: { code: 'RP429', message: 'You have submitted too many reports.' } }),
    });
    const res = await request(buildApp({ supabase }))
      .post('/api/reports')
      .set(authHeader)
      .send({ report_type: 'hazard', latitude: 1, longitude: 1 });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('maps duplicate reports to HTTP 409', async () => {
    const supabase = createFakeSupabase({
      handle: () => ({ data: null, error: { code: 'RP409', message: 'You already reported this incident nearby.' } }),
    });
    const res = await request(buildApp({ supabase }))
      .post('/api/reports')
      .set(authHeader)
      .send({ report_type: 'hazard', latitude: 1, longitude: 1 });
    expect(res.status).toBe(409);
  });

  it('rate-limits report bursts per user at the API layer', async () => {
    const supabase = createFakeSupabase({ handle: () => ({ data: report, error: null }) });
    const app = buildApp({ supabase }, { RATE_LIMIT_REPORTS_PER_MIN: '2' });
    const send = () => request(app).post('/api/reports').set(authHeader).send({ report_type: 'hazard', latitude: 1, longitude: 1 });
    expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(429);
  });
});

describe('POST /api/reports/:id/votes (confirmation)', () => {
  it('records a single vote per user and returns the updated report', async () => {
    const supabase = createFakeSupabase({
      handle: (op) => (op.action === 'rpc' ? { data: null, error: null } : { data: { ...report, confirmation_count: 1 }, error: null }),
    });
    const res = await request(buildApp({ supabase }))
      .post(`/api/reports/${REPORT_ID}/votes`)
      .set(authHeader)
      .send({ type: 'confirm' });

    expect(res.status).toBe(200);
    expect(res.body.report).toMatchObject({ confirmation_count: 1, my_vote: 'confirm' });
    const vote = supabase.ops.find((op) => op.action === 'rpc');
    // The database takes the voter from the JWT (auth.uid()), not the request.
    expect(vote).toMatchObject({ table: 'vote_report', payload: { p_report_id: REPORT_ID, p_type: 'confirm' } });
    expect(vote.client).toBe(`user:${ALICE.id}`);
  });

  it('accepts "not_present" votes', async () => {
    const supabase = createFakeSupabase({ handle: () => ({ data: { ...report, not_present_count: 1 }, error: null }) });
    const res = await request(buildApp({ supabase }))
      .post(`/api/reports/${REPORT_ID}/votes`)
      .set(authHeader)
      .send({ type: 'not_present' });
    expect(res.status).toBe(200);
    expect(res.body.report.my_vote).toBe('not_present');
  });

  it('rejects unknown vote types and malformed ids', async () => {
    const supabase = createFakeSupabase();
    const app = buildApp({ supabase });
    expect((await request(app).post(`/api/reports/${REPORT_ID}/votes`).set(authHeader).send({ type: 'like' })).status).toBe(400);
    expect((await request(app).post('/api/reports/not-a-uuid/votes').set(authHeader).send({ type: 'confirm' })).status).toBe(400);
  });

  it('refuses votes on the user’s own report', async () => {
    const supabase = createFakeSupabase({
      handle: () => ({ data: null, error: { code: 'RP403', message: 'You cannot vote on your own report.' } }),
    });
    const res = await request(buildApp({ supabase })).post(`/api/reports/${REPORT_ID}/votes`).set(authHeader).send({ type: 'confirm' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('OWN_REPORT');
  });

  it('reports when the incident is no longer active', async () => {
    const supabase = createFakeSupabase({
      handle: () => ({ data: null, error: { code: 'RP410', message: 'This report is no longer active.' } }),
    });
    const res = await request(buildApp({ supabase })).post(`/api/reports/${REPORT_ID}/votes`).set(authHeader).send({ type: 'confirm' });
    expect(res.status).toBe(410);
  });
});

describe('GET /api/reports (listing)', () => {
  it('only queries active, unexpired reports inside the bbox', async () => {
    const supabase = createFakeSupabase({ handle: () => ({ data: [report], error: null }) });
    const res = await request(buildApp({ supabase })).get('/api/reports?bbox=13.3,52.4,13.5,52.6');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ source: 'community', verified: false });
    expect(res.body.reports[0]).toMatchObject({ id: REPORT_ID, is_mine: false, my_vote: null });
    const filters = supabase.ops[0].filters;
    expect(filters).toContainEqual(['eq', 'status', 'active']);
    expect(filters.find((f) => f[0] === 'gt' && f[1] === 'expires_at')).toBeTruthy();
    expect(filters).toContainEqual(['gte', 'latitude', 52.4]);
    expect(filters).toContainEqual(['lte', 'longitude', 13.5]);
  });

  it('annotates ownership and the user’s votes when signed in', async () => {
    const supabase = createFakeSupabase({
      handle: (op) => {
        if (op.action === 'rpc') return { data: [REPORT_ID], error: null };
        if (op.table === 'report_confirmations') return { data: [{ report_id: REPORT_ID, confirmation_type: 'confirm' }], error: null };
        return { data: [report], error: null };
      },
    });
    const res = await request(buildApp({ supabase })).get('/api/reports?bbox=13.3,52.4,13.5,52.6').set(authHeader);
    expect(res.body.reports[0]).toMatchObject({ is_mine: true, my_vote: 'confirm' });
  });

  it.each(['', 'bbox=1,2,3', 'bbox=10,10,5,5', 'bbox=0,0,20,20'])('rejects bad bbox "%s"', async (qs) => {
    const res = await request(buildApp({ supabase: createFakeSupabase() })).get(`/api/reports?${qs}`);
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/reports/:id (withdraw)', () => {
  it('marks the report as removed', async () => {
    const supabase = createFakeSupabase({ handle: () => ({ data: [{ id: REPORT_ID, status: 'removed' }], error: null }) });
    const res = await request(buildApp({ supabase })).delete(`/api/reports/${REPORT_ID}`).set(authHeader);
    expect(res.status).toBe(200);
    expect(supabase.ops[0]).toMatchObject({ action: 'update', payload: { status: 'removed' } });
  });

  it('returns 404 when nothing was updated (not yours or not active)', async () => {
    const supabase = createFakeSupabase({ handle: () => ({ data: [], error: null }) });
    const res = await request(buildApp({ supabase })).delete(`/api/reports/${REPORT_ID}`).set(authHeader);
    expect(res.status).toBe(404);
  });
});
