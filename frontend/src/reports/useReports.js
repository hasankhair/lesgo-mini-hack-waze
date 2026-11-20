import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as defaultService from '../services/reportsService.js';
import { subscribeToReports } from '../services/realtimeService.js';

export const isCurrent = (report, now = Date.now()) =>
  report.status === 'active' && new Date(report.expires_at).getTime() > now;

// Loads community reports for the visible map area, keeps them in sync via
// Supabase Realtime, and drops reports once they expire or are cleared.
export function useReports({ bbox, client, userId, service = defaultService, pruneIntervalMs = 30000 }) {
  const [reports, setReports] = useState(() => new Map());
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);

  const upsert = useCallback((incoming) => {
    setReports((prev) => {
      const next = new Map(prev);
      const existing = prev.get(incoming.id);
      // Realtime rows lack per-user fields; keep the ones we already know.
      const merged = { is_mine: false, my_vote: null, ...existing, ...incoming };
      if (isCurrent(merged)) next.set(incoming.id, merged);
      else next.delete(incoming.id);
      return next;
    });
  }, []);

  const remove = useCallback((id) => {
    setReports((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Fetch reports for the current viewport.
  useEffect(() => {
    if (!bbox) return undefined;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    service
      .listReports(bbox, { signal: controller.signal })
      .then((list) => {
        setLoadError(null);
        setReports((prev) => {
          const next = new Map(prev);
          for (const r of list) next.set(r.id, { ...prev.get(r.id), ...r });
          return next;
        });
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setLoadError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [bbox, service, userId]);

  // Live updates.
  useEffect(
    () =>
      subscribeToReports(client, {
        onInsert: upsert,
        onUpdate: upsert,
        onDelete: (old) => old?.id && remove(old.id),
        onStatus: setRealtimeStatus,
      }),
    [client, upsert, remove],
  );

  // Expire reports locally even if no event arrives.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setReports((prev) => {
        let changed = false;
        const next = new Map();
        for (const [k, r] of prev) {
          if (isCurrent(r, now)) next.set(k, r);
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, pruneIntervalMs);
    return () => clearInterval(id);
  }, [pruneIntervalMs]);

  // Reset per-user annotations when the signed-in user changes.
  useEffect(() => {
    setReports((prev) => {
      const next = new Map();
      for (const [k, r] of prev) next.set(k, { ...r, is_mine: false, my_vote: null });
      return next;
    });
  }, [userId]);

  const list = useMemo(() => [...reports.values()], [reports]);

  return { reports: list, upsert, remove, realtimeStatus, loadError, loading };
}
