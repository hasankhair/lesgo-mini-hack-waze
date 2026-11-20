import { describe, expect, it } from 'vitest';
import { reportsByCategory, summarize, tripsPerDay } from '../src/pages/dashboard/Overview.jsx';

const NOW = new Date(2025, 5, 15, 12, 0, 0).getTime();
const daysAgo = (n, h = 10) => new Date(2025, 5, 15 - n, h, 0, 0).toISOString();
const future = new Date(NOW + 3600e3).toISOString();
const past = new Date(NOW - 3600e3).toISOString();

const history = [
  { created_at: daysAgo(0), distance_meters: 3000, estimated_duration_seconds: 600 },
  { created_at: daysAgo(0, 8), distance_meters: 2000, estimated_duration_seconds: 300 },
  { created_at: daysAgo(3), distance_meters: 10000, estimated_duration_seconds: 1200 },
  { created_at: daysAgo(20), distance_meters: 5000, estimated_duration_seconds: 900 },
  { created_at: daysAgo(45), distance_meters: 99000, estimated_duration_seconds: 9000 }, // outside 30 days
];
const reports = [
  { report_type: 'accident', status: 'active', expires_at: future, confirmation_count: 3 },
  { report_type: 'accident', status: 'active', expires_at: past, confirmation_count: 1 }, // expired
  { report_type: 'flood', status: 'cleared', expires_at: future, confirmation_count: 0 },
];

describe('dashboard overview statistics', () => {
  it('summarises the last 30 days of trips and all reports', () => {
    expect(summarize(history, reports, NOW)).toEqual({
      trips30: 4,
      distance30: 20000,
      duration30: 3000,
      reports: 3,
      activeReports: 1,
      confirmations: 4,
    });
  });

  it('counts trips per day, oldest first, ending today', () => {
    const buckets = tripsPerDay(history, 14, NOW);
    expect(buckets).toHaveLength(14);
    expect(buckets.at(-1).count).toBe(2); // today
    expect(buckets.at(-4).count).toBe(1); // 3 days ago
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(3); // older trips fall outside the window
  });

  it('ranks report categories by count', () => {
    expect(reportsByCategory(reports)).toEqual([
      { type: 'accident', count: 2 },
      { type: 'flood', count: 1 },
    ]);
  });

  it('handles an account with no activity', () => {
    expect(summarize([], [], NOW)).toMatchObject({ trips30: 0, distance30: 0, reports: 0, confirmations: 0 });
    expect(tripsPerDay([], 7, NOW).every((b) => b.count === 0)).toBe(true);
  });
});
