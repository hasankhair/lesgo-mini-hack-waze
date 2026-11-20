// Runs the real migration against an in-process Postgres (PGlite) and checks
// constraints, triggers and Row Level Security as the anon/authenticated roles.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');

const ALICE = '00000000-0000-4000-8000-00000000000a';
const BOB = '00000000-0000-4000-8000-00000000000b';
const CAROL = '00000000-0000-4000-8000-00000000000c';
const DAVE = '00000000-0000-4000-8000-00000000000d';

let db;

async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

const asUser = (userId, fn) => asRole('authenticated', userId, fn);
const asAnon = (fn) => asRole('anon', null, fn);

async function insertReport(userId, overrides = {}) {
  const r = { report_type: 'accident', description: 'Two cars', latitude: 52.52, longitude: 13.405, ...overrides };
  return asUser(userId, async () => {
    const { rows } = await db.query(
      `insert into public.traffic_reports (user_id, report_type, description, latitude, longitude)
       values ($1, $2, $3, $4, $5)
       returning id, status, confirmation_count, expires_at, created_at, reporter_username`,
      [userId, r.report_type, r.description, r.latitude, r.longitude],
    );
    return rows[0];
  });
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(join(here, 'supabase-stub.sql'), 'utf8'));
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  }
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values
       ($1, 'alice@example.com', '{"username":"alice"}'),
       ($2, 'bob@example.com', '{"username":"bob"}'),
       ($3, 'carol@example.com', '{}'),
       ($4, 'dave@example.com', '{"username":"x"}')`,
    [ALICE, BOB, CAROL, DAVE],
  );
});

beforeEach(async () => {
  await db.exec('delete from public.traffic_reports; delete from public.saved_locations; delete from public.navigation_history;');
});

describe('profiles', () => {
  it('creates a profile on sign-up and falls back to a generated username', async () => {
    const { rows } = await db.query('select id, username, email from public.profiles order by email');
    expect(rows.map((r) => r.username)).toEqual(['alice', 'bob', expect.stringMatching(/^driver_/), expect.stringMatching(/^driver_/)]);
  });

  it('only exposes the caller’s own profile', async () => {
    const rows = await asUser(BOB, async () => (await db.query('select id, email from public.profiles')).rows);
    expect(rows).toEqual([{ id: BOB, email: 'bob@example.com' }]);
  });

  it('hides profiles from anonymous users', async () => {
    await expect(asAnon(() => db.query('select * from public.profiles'))).rejects.toThrow(/permission denied/);
  });
});

describe('traffic_reports', () => {
  it('lets an authenticated user submit a report with server-controlled fields', async () => {
    const report = await insertReport(ALICE);
    expect(report.status).toBe('active');
    expect(report.confirmation_count).toBe(0);
    expect(report.reporter_username).toBe('alice');
    const lifetimeMin = (new Date(report.expires_at) - new Date(report.created_at)) / 60000;
    expect(lifetimeMin).toBe(90);
  });

  it('rejects anonymous submissions', async () => {
    await expect(
      asAnon(() => db.query(`insert into public.traffic_reports (user_id, report_type, latitude, longitude) values ($1, 'hazard', 1, 1)`, [ALICE])),
    ).rejects.toThrow(/permission denied/);
  });

  it('rejects reports filed on behalf of another user', async () => {
    await expect(
      asUser(ALICE, () =>
        db.query(`insert into public.traffic_reports (user_id, report_type, latitude, longitude) values ($1, 'hazard', 1, 1)`, [BOB]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('rejects unknown categories and out-of-range coordinates', async () => {
    await expect(insertReport(ALICE, { report_type: 'ufo' })).rejects.toThrow(/check constraint/);
    await expect(insertReport(ALICE, { latitude: 123 })).rejects.toThrow(/check constraint/);
  });

  it('lets anonymous users read active reports', async () => {
    await insertReport(ALICE);
    const rows = await asAnon(async () => (await db.query('select id from public.traffic_reports')).rows);
    expect(rows).toHaveLength(1);
  });

  it('hides long-expired reports from the public', async () => {
    const report = await insertReport(ALICE);
    await db.query(
      `update public.traffic_reports set created_at = now() - interval '5 hours', expires_at = now() - interval '3 hours' where id = $1`,
      [report.id],
    );
    const anonRows = await asAnon(async () => (await db.query('select id from public.traffic_reports')).rows);
    expect(anonRows).toHaveLength(0);
    const ownRows = await asUser(ALICE, async () => (await db.query('select id from public.traffic_reports')).rows);
    expect(ownRows).toHaveLength(1);
  });

  it('does not expose which account filed a report', async () => {
    await insertReport(ALICE);
    await expect(asAnon(() => db.query('select user_id from public.traffic_reports'))).rejects.toThrow(/permission denied/);
    await expect(asUser(BOB, () => db.query('select * from public.traffic_reports'))).rejects.toThrow(/permission denied/);
  });

  it('lists the caller’s own reports and ownership through RPCs', async () => {
    const mine = await insertReport(ALICE);
    const other = await insertReport(BOB);
    const own = await asUser(ALICE, async () => (await db.query('select id from public.my_traffic_reports(10)')).rows);
    expect(own.map((r) => r.id)).toEqual([mine.id]);
    const owned = await asUser(ALICE, async () =>
      (await db.query('select * from public.owned_report_ids($1::uuid[]) as id', [[mine.id, other.id]])).rows,
    );
    expect(owned.map((r) => r.id)).toEqual([mine.id]);
    await expect(asAnon(() => db.query('select * from public.my_traffic_reports(10)'))).rejects.toThrow(/permission denied/);
  });

  it('prevents users from tampering with confirmation counts', async () => {
    const report = await insertReport(ALICE);
    await expect(
      asUser(ALICE, () => db.query('update public.traffic_reports set confirmation_count = 99 where id = $1', [report.id])),
    ).rejects.toThrow(/permission denied/);
  });

  it('allows owners to withdraw but not reactivate their reports', async () => {
    const report = await insertReport(ALICE);
    await asUser(ALICE, () => db.query(`update public.traffic_reports set status = 'removed' where id = $1`, [report.id]));
    await expect(
      asUser(ALICE, () => db.query(`update public.traffic_reports set status = 'active' where id = $1`, [report.id])),
    ).rejects.toThrow(/Only active reports/);
  });

  it('blocks duplicate nearby reports from the same user', async () => {
    await insertReport(ALICE);
    await expect(insertReport(ALICE, { latitude: 52.5203 })).rejects.toThrow(/already reported/);
    await expect(insertReport(BOB, { latitude: 52.5203 })).resolves.toBeTruthy();
  });

  it('rate-limits bursts of reports', async () => {
    for (let i = 0; i < 10; i += 1) await insertReport(ALICE, { latitude: 50 + i * 0.01 });
    await expect(insertReport(ALICE, { latitude: 49 })).rejects.toThrow(/too many reports/);
  });
});

describe('report_confirmations', () => {
  const vote = (userId, reportId, type) =>
    asUser(userId, () =>
      db.query(
        `insert into public.report_confirmations (report_id, user_id, confirmation_type) values ($1, $2, $3)
         on conflict (report_id, user_id) do update set confirmation_type = excluded.confirmation_type`,
        [reportId, userId, type],
      ),
    );
  const counts = async (id) =>
    (await db.query('select confirmation_count, not_present_count, status from public.traffic_reports where id = $1', [id])).rows[0];

  const voteRpc = (userId, reportId, type) =>
    asUser(userId, () => db.query('select public.vote_report($1, $2)', [reportId, type]));

  it('records and changes votes through vote_report()', async () => {
    const report = await insertReport(ALICE);
    await voteRpc(BOB, report.id, 'confirm');
    await voteRpc(BOB, report.id, 'confirm');
    expect(await counts(report.id)).toMatchObject({ confirmation_count: 1, not_present_count: 0 });
    await voteRpc(BOB, report.id, 'not_present');
    expect(await counts(report.id)).toMatchObject({ confirmation_count: 0, not_present_count: 1 });
    await expect(voteRpc(ALICE, report.id, 'confirm')).rejects.toThrow(/own report/);
    await expect(asAnon(() => db.query('select public.vote_report($1, $2)', [report.id, 'confirm']))).rejects.toThrow(/permission denied/);
  });

  it('rejects the PostgREST-style upsert that rewrites report_id and user_id', async () => {
    // This is what supabase-js .upsert() sends; it must not be allowed to move votes.
    const report = await insertReport(ALICE);
    await expect(
      asUser(BOB, () =>
        db.query(
          `insert into public.report_confirmations (report_id, user_id, confirmation_type) values ($1, $2, 'confirm')
           on conflict (report_id, user_id) do update set report_id = excluded.report_id, user_id = excluded.user_id, confirmation_type = excluded.confirmation_type`,
          [report.id, BOB],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('increments the confirmation count once per user', async () => {
    const report = await insertReport(ALICE);
    await vote(BOB, report.id, 'confirm');
    await vote(BOB, report.id, 'confirm');
    await vote(CAROL, report.id, 'confirm');
    expect(await counts(report.id)).toMatchObject({ confirmation_count: 2, not_present_count: 0 });
  });

  it('enforces one vote row per user and report', async () => {
    const report = await insertReport(ALICE);
    await vote(BOB, report.id, 'confirm');
    await expect(
      asUser(BOB, () =>
        db.query(`insert into public.report_confirmations (report_id, user_id, confirmation_type) values ($1, $2, 'confirm')`, [report.id, BOB]),
      ),
    ).rejects.toThrow(/report_confirmations_one_per_user/);
  });

  it('moves a vote when the user changes their mind', async () => {
    const report = await insertReport(ALICE);
    await vote(BOB, report.id, 'confirm');
    await vote(BOB, report.id, 'not_present');
    expect(await counts(report.id)).toMatchObject({ confirmation_count: 0, not_present_count: 1 });
  });

  it('rejects votes on the user’s own report', async () => {
    const report = await insertReport(ALICE);
    await expect(vote(ALICE, report.id, 'confirm')).rejects.toThrow(/own report/);
  });

  it('rejects votes cast as another user', async () => {
    const report = await insertReport(ALICE);
    await expect(
      asUser(BOB, () =>
        db.query(`insert into public.report_confirmations (report_id, user_id, confirmation_type) values ($1, $2, 'confirm')`, [report.id, CAROL]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('clears a report once enough drivers say it is gone', async () => {
    const report = await insertReport(ALICE);
    await vote(BOB, report.id, 'not_present');
    await vote(CAROL, report.id, 'not_present');
    expect((await counts(report.id)).status).toBe('active');
    await vote(DAVE, report.id, 'not_present');
    expect((await counts(report.id)).status).toBe('cleared');
    await expect(vote(BOB, report.id, 'confirm')).rejects.toThrow(/no longer active/);
  });

  it('extends expiry on confirmation, capped at three lifetimes', async () => {
    const report = await insertReport(ALICE, { report_type: 'traffic_jam' });
    await db.query(`update public.traffic_reports set expires_at = created_at + interval '10 minutes' where id = $1`, [report.id]);
    await vote(BOB, report.id, 'confirm');
    const { rows } = await db.query('select created_at, expires_at from public.traffic_reports where id = $1', [report.id]);
    const minutes = (new Date(rows[0].expires_at) - new Date(rows[0].created_at)) / 60000;
    expect(minutes).toBeGreaterThan(20);
    expect(minutes).toBeLessThanOrEqual(135);
  });
});

describe('saved_locations and navigation_history', () => {
  it('keeps saved locations private to their owner', async () => {
    await asUser(ALICE, () =>
      db.query(`insert into public.saved_locations (user_id, location_name, category, latitude, longitude) values ($1, 'Home', 'home', 1, 2)`, [ALICE]),
    );
    const bobRows = await asUser(BOB, async () => (await db.query('select * from public.saved_locations')).rows);
    expect(bobRows).toHaveLength(0);
    const aliceRows = await asUser(ALICE, async () => (await db.query('select * from public.saved_locations')).rows);
    expect(aliceRows).toHaveLength(1);
  });

  it('allows only one home location per user', async () => {
    const add = () =>
      asUser(ALICE, () =>
        db.query(`insert into public.saved_locations (user_id, location_name, category, latitude, longitude) values ($1, 'Home', 'home', 1, 2)`, [ALICE]),
      );
    await add();
    await expect(add()).rejects.toThrow(/saved_locations_single_home_work/);
  });

  it('keeps navigation history private to its owner', async () => {
    await asUser(ALICE, () =>
      db.query(
        `insert into public.navigation_history (user_id, destination_label, destination_latitude, destination_longitude, distance_meters, estimated_duration_seconds)
         values ($1, 'Office', 1, 2, 1000, 120)`,
        [ALICE],
      ),
    );
    const bobRows = await asUser(BOB, async () => (await db.query('select * from public.navigation_history')).rows);
    expect(bobRows).toHaveLength(0);
  });
});
