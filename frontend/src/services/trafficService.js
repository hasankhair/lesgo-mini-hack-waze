import { apiFetch } from './api.js';

export async function listTrafficIncidents(bbox, { signal } = {}) {
  const data = await apiFetch('/traffic/incidents', { query: { bbox }, signal });
  return data.incidents ?? [];
}
