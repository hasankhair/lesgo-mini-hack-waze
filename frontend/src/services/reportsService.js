import { apiFetch } from './api.js';

export async function listReports(bbox, { signal } = {}) {
  const data = await apiFetch('/reports', { query: { bbox }, signal });
  return data.reports;
}

export async function createReport({ report_type, description, latitude, longitude }) {
  const data = await apiFetch('/reports', { method: 'POST', body: { report_type, description, latitude, longitude } });
  return data.report;
}

export async function voteOnReport(id, type) {
  const data = await apiFetch(`/reports/${id}/votes`, { method: 'POST', body: { type } });
  return data.report;
}

export const withdrawReport = (id) => apiFetch(`/reports/${id}`, { method: 'DELETE' });

export async function listMyReports(limit = 50) {
  const data = await apiFetch('/reports/mine', { query: { limit } });
  return data.reports;
}
