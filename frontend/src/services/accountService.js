import { apiFetch } from './api.js';

export const getProfile = async () => (await apiFetch('/profile')).profile;
export const updateProfile = async (patch) => (await apiFetch('/profile', { method: 'PATCH', body: patch })).profile;

export const listSavedLocations = async () => (await apiFetch('/saved-locations')).locations;
export const createSavedLocation = async (location) =>
  (await apiFetch('/saved-locations', { method: 'POST', body: location })).location;
export const updateSavedLocation = async (id, patch) =>
  (await apiFetch(`/saved-locations/${id}`, { method: 'PATCH', body: patch })).location;
export const deleteSavedLocation = (id) => apiFetch(`/saved-locations/${id}`, { method: 'DELETE' });

export const listHistory = async (limit = 20) => (await apiFetch('/history', { query: { limit } })).history;
export const addHistory = (trip) => apiFetch('/history', { method: 'POST', body: trip });
export const deleteHistoryEntry = (id) => apiFetch(`/history/${id}`, { method: 'DELETE' });
export const clearHistory = () => apiFetch('/history', { method: 'DELETE' });
