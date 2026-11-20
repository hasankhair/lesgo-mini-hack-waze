import { useCallback, useEffect, useRef, useState } from 'react';

// Browser geolocation with explicit, user-initiated access.
//
// status: 'idle'        nothing requested yet
//         'locating'    waiting for a fix
//         'active'      have a recent position
//         'denied'      user or browser blocked permission
//         'unavailable' no GPS / position signal
//         'timeout'     took too long to get a fix
//         'unsupported' browser has no Geolocation API
//
// Location is requested when locate() or startTracking() is called. With
// `locateOnMount`, it is requested as soon as the component mounts (the
// browser shows its permission prompt the first time). Otherwise it is only
// requested automatically when permission was already granted.

const OPTIONS = { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 };

const toPosition = (pos) => ({
  lat: pos.coords.latitude,
  lng: pos.coords.longitude,
  accuracy: pos.coords.accuracy,
  speed: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
  heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
  timestamp: pos.timestamp,
});

const errorStatus = (err) => (err?.code === 1 ? 'denied' : err?.code === 3 ? 'timeout' : 'unavailable');

const ERROR_MESSAGES = {
  denied: 'Location permission was denied. Enable it in your browser settings to use your position.',
  unavailable: 'Your location is currently unavailable. Check that GPS or location services are on.',
  timeout: 'Getting your location took too long. Move to an open area and try again.',
  unsupported: 'This browser does not support location services.',
};

export function useGeolocation({ locateOnMount = false, autoLocateIfGranted = true, geolocation } = {}) {
  const geo = geolocation ?? (typeof navigator !== 'undefined' ? navigator.geolocation : undefined);
  const [status, setStatus] = useState(geo ? 'idle' : 'unsupported');
  const [position, setPosition] = useState(null);
  const [tracking, setTracking] = useState(false);
  const watchId = useRef(null);

  const onSuccess = useCallback((pos) => {
    setPosition(toPosition(pos));
    setStatus('active');
  }, []);

  const onError = useCallback((err) => {
    const next = errorStatus(err);
    setStatus(next);
    if (next === 'denied' && watchId.current !== null) {
      geo?.clearWatch(watchId.current);
      watchId.current = null;
      setTracking(false);
    }
  }, [geo]);

  const locate = useCallback(() => {
    if (!geo) {
      setStatus('unsupported');
      return;
    }
    setStatus((s) => (s === 'active' ? s : 'locating'));
    geo.getCurrentPosition(onSuccess, onError, OPTIONS);
  }, [geo, onSuccess, onError]);

  const startTracking = useCallback(() => {
    if (!geo) {
      setStatus('unsupported');
      return;
    }
    if (watchId.current !== null) return;
    setStatus((s) => (s === 'active' ? s : 'locating'));
    watchId.current = geo.watchPosition(onSuccess, onError, OPTIONS);
    setTracking(true);
  }, [geo, onSuccess, onError]);

  const stopTracking = useCallback(() => {
    if (watchId.current !== null) {
      geo?.clearWatch(watchId.current);
      watchId.current = null;
    }
    setTracking(false);
  }, [geo]);

  // Forget the position entirely (e.g. user turns location off).
  const clear = useCallback(() => {
    stopTracking();
    setPosition(null);
    setStatus(geo ? 'idle' : 'unsupported');
  }, [geo, stopTracking]);

  useEffect(() => {
    if (locateOnMount) {
      locate();
      return undefined;
    }
    if (!autoLocateIfGranted || !geo || !navigator.permissions?.query) return undefined;
    let cancelled = false;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((result) => {
        if (!cancelled && result.state === 'granted') locate();
        if (!cancelled && result.state === 'denied') setStatus('denied');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [locateOnMount, autoLocateIfGranted, geo, locate]);

  useEffect(() => () => {
    if (watchId.current !== null) geo?.clearWatch(watchId.current);
  }, [geo]);

  return {
    status,
    position,
    tracking,
    error: ERROR_MESSAGES[status] ?? null,
    locate,
    startTracking,
    stopTracking,
    clear,
  };
}
