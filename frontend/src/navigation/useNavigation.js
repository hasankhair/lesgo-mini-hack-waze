import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeProgress, prepareRoute } from './navigationEngine.js';

const REROUTE_COOLDOWN_MS = 15000;
const OFF_ROUTE_CONFIRMATIONS = 2;

// Active-navigation state machine. Feeds GPS positions through the
// navigation engine and requests a new route when the driver leaves it.
export function useNavigation({ position, reroute }) {
  const [route, setRoute] = useState(null);
  const [progress, setProgress] = useState(null);
  const [rerouting, setRerouting] = useState(false);
  const offRouteCount = useRef(0);
  const lastReroute = useRef(0);
  const progressRef = useRef(null);
  const rerouteRef = useRef(reroute);
  rerouteRef.current = reroute;

  const prepared = useMemo(() => (route ? prepareRoute(route) : null), [route]);

  const start = useCallback((nextRoute) => {
    progressRef.current = null;
    offRouteCount.current = 0;
    setProgress(null);
    setRoute(nextRoute);
  }, []);

  const end = useCallback(() => {
    progressRef.current = null;
    setRoute(null);
    setProgress(null);
    setRerouting(false);
  }, []);

  useEffect(() => {
    if (!prepared || !position) return;
    const next = computeProgress(prepared, position, progressRef.current);
    progressRef.current = next;
    setProgress(next);

    if (next.arrived) return;
    offRouteCount.current = next.offRoute ? offRouteCount.current + 1 : 0;
    const due = Date.now() - lastReroute.current > REROUTE_COOLDOWN_MS;
    if (offRouteCount.current >= OFF_ROUTE_CONFIRMATIONS && due && rerouteRef.current) {
      lastReroute.current = Date.now();
      offRouteCount.current = 0;
      setRerouting(true);
      rerouteRef.current({ lat: position.lat, lng: position.lng })
        .then((fresh) => {
          if (fresh) {
            progressRef.current = null;
            setRoute(fresh);
          }
        })
        .catch(() => {})
        .finally(() => setRerouting(false));
    }
  }, [prepared, position]);

  const traveled = useMemo(() => {
    if (!prepared || !progress) return null;
    return [...prepared.line.slice(0, progress.segmentIndex + 1), progress.snapped];
  }, [prepared, progress]);

  return { active: Boolean(route), route, progress, rerouting, traveled, start, end };
}
