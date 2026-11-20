import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nextAnnouncement, spokenDistance } from './voiceGuidance.js';
import { ALERT_METERS, reportsAlongRoute, upcomingReports } from './reportsAhead.js';
import { speak as defaultSpeak, speechSupported, stopSpeaking } from './speech.js';
import { getReportType } from '../reports/reportTypes.js';

const VOICE_KEY = 'lesgo.voice';

const readVoicePref = () => {
  try {
    return localStorage.getItem(VOICE_KEY) !== 'off';
  } catch {
    return true;
  }
};

// Spoken turn instructions and "incident ahead" alerts while navigating.
// Returns the nearest community report ahead (for the on-screen banner) and
// the voice on/off control.
export function useGuidance({ active, prepared, progress, reports, rerouting, speak = defaultSpeak }) {
  const [voiceOn, setVoiceOn] = useState(readVoicePref);
  const spoken = useRef(new Set());
  const alerted = useRef(new Set());
  const voiceRef = useRef(voiceOn);
  voiceRef.current = voiceOn;

  const say = useCallback(
    (text, opts) => {
      if (voiceRef.current) speak(text, opts);
    },
    [speak],
  );

  const toggleVoice = useCallback(() => {
    setVoiceOn((on) => {
      const next = !on;
      try {
        localStorage.setItem(VOICE_KEY, next ? 'on' : 'off');
      } catch {
        /* storage unavailable */
      }
      if (!next) stopSpeaking();
      return next;
    });
  }, []);

  // A new route (start or reroute) starts announcements afresh.
  useEffect(() => {
    spoken.current = new Set();
  }, [prepared]);

  useEffect(() => {
    if (!active) {
      spoken.current = new Set();
      alerted.current = new Set();
      stopSpeaking();
    }
  }, [active]);

  // Turn-by-turn announcements.
  useEffect(() => {
    if (!active || !progress || rerouting) return;
    const next = nextAnnouncement(progress, spoken.current);
    if (!next) return;
    next.keys.forEach((k) => spoken.current.add(k));
    say(next.text, { urgent: next.keys.at(-1)?.endsWith(':now') });
  }, [active, progress, rerouting, say]);

  // Announce completed reroutes.
  const wasRerouting = useRef(false);
  useEffect(() => {
    if (wasRerouting.current && !rerouting && active) say('Route recalculated.');
    wasRerouting.current = rerouting;
  }, [rerouting, active, say]);

  // Community reports on the route.
  const onRoute = useMemo(() => (active ? reportsAlongRoute(prepared, reports) : []), [active, prepared, reports]);
  const upcoming = useMemo(
    () => (progress && !progress.offRoute ? upcomingReports(onRoute, progress.distanceAlong) : []),
    [onRoute, progress],
  );
  const nearest = upcoming[0] ?? null;

  useEffect(() => {
    if (!nearest || nearest.distanceAhead > ALERT_METERS) return;
    const { id, report_type: type } = nearest.report;
    if (alerted.current.has(id)) return;
    alerted.current.add(id);
    say(`${getReportType(type).label} reported ahead, in ${spokenDistance(nearest.distanceAhead)}.`);
  }, [nearest, say]);

  return { voiceOn, voiceSupported: speechSupported(), toggleVoice, say, reportAhead: nearest, reportsAheadCount: upcoming.length };
}
