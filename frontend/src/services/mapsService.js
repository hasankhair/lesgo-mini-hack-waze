import { apiFetch } from './api.js';

export const getCapabilities = () => apiFetch('/capabilities');

export async function searchPlaces(query, { near, limit = 6, signal } = {}) {
  const data = await apiFetch('/geocode/search', {
    query: { q: query, limit, lat: near?.lat, lng: near?.lng },
    signal,
  });
  return data.results;
}

export async function reverseGeocode({ lat, lng }, { signal } = {}) {
  const data = await apiFetch('/geocode/reverse', { query: { lat, lng }, signal });
  return data.result;
}

export const planRoute = ({ origin, destination, preference, avoidTolls }, { signal } = {}) =>
  apiFetch('/routes', { method: 'POST', body: { origin, destination, preference, avoidTolls }, signal });
