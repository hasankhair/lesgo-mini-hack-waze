import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Info, Layers } from 'lucide-react';
import MapView from '../maps/MapView.jsx';
import { webglSupported } from '../maps/map3d/helpers.js';
import MapModeControl from '../components/MapModeControl.jsx';
import { MIN_INCIDENT_ZOOM, MIN_REPORT_ZOOM } from '../maps/tileProviders.js';
import SearchBar from '../components/SearchBar.jsx';
import Logo from '../components/Logo.jsx';
import ProfileMenu from '../components/ProfileMenu.jsx';
import FloatingControls from '../components/FloatingControls.jsx';
import LocationPanel from '../components/LocationPanel.jsx';
import SavePlaceDialog from '../components/SavePlaceDialog.jsx';
import RoutePanel from '../navigation/RoutePanel.jsx';
import NavigationHUD from '../navigation/NavigationHUD.jsx';
import { useNavigation } from '../navigation/useNavigation.js';
import { useGuidance } from '../navigation/useGuidance.js';
import { useWakeLock } from '../hooks/useWakeLock.js';
import { routeBbox, useTrafficIncidents } from '../hooks/useTrafficIncidents.js';
import { incidentAsReport, isMapMarker, isNotable } from '../reports/incidents.js';
import ReportDialog from '../reports/ReportDialog.jsx';
import { useReports } from '../reports/useReports.js';
import { useGeolocation } from '../hooks/useGeolocation.js';
import { useCapabilities } from '../hooks/useCapabilities.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { planRoute, reverseGeocode } from '../services/mapsService.js';
import { createReport, voteOnReport, withdrawReport } from '../services/reportsService.js';
import { addHistory, createSavedLocation, listHistory, listSavedLocations } from '../services/accountService.js';
import { bearingBetween, boundsToBbox } from '../utils/geo.js';
import { formatCoords } from '../utils/format.js';

const parseDestParam = (params) => {
  const [lat, lng] = (params.get('dest') || '').split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const name = (params.get('name') || 'Destination').slice(0, 120);
  return { id: `param:${lat},${lng}`, name, label: params.get('label')?.slice(0, 300) || '', lat, lng };
};

// The 3D map (MapLibre GL) is loaded only when someone switches to 3D.
const MapView3D = lazy(() => import('../maps/MapView3D.jsx'));
const MODE_KEY = 'lesgo.map3d';

const readMode = () => {
  try {
    return localStorage.getItem(MODE_KEY) === 'on' && webglSupported();
  } catch {
    return false;
  }
};

export default function MapPage() {
  const { user, client } = useAuth();
  const { notify } = useToast();
  const capabilities = useCapabilities();
  // Ask for location on load so the map can open where the user is.
  const geo = useGeolocation({ locateOnMount: true });
  const [params, setParams] = useSearchParams();

  const [map, setMap] = useState(null);
  const [is3D, setIs3D] = useState(readMode);
  const [bearing, setBearing] = useState(0);
  // Last camera position, so switching 2D <-> 3D keeps the same place.
  const lastView = useRef(null);
  const [bbox, setBbox] = useState(null);
  const [incidentViewBbox, setIncidentViewBbox] = useState(null);
  const [trafficOn, setTrafficOn] = useState(() => {
    try {
      return localStorage.getItem('lesgo.traffic') !== 'off';
    } catch {
      return true;
    }
  });
  const toggleTraffic = () =>
    setTrafficOn((on) => {
      try {
        localStorage.setItem('lesgo.traffic', on ? 'off' : 'on');
      } catch {
        /* storage unavailable */
      }
      return !on;
    });
  const [mapCenter, setMapCenter] = useState(null);
  const [following, setFollowing] = useState(false);

  const [destination, setDestination] = useState(() => parseDestParam(params));
  const [plan, setPlan] = useState(null);
  const [planOrigin, setPlanOrigin] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [preference, setPreference] = useState('fastest');
  const [avoidTolls, setAvoidTolls] = useState(false);

  const [panel, setPanel] = useState(destination ? 'route' : null); // 'route' | 'info' | null
  const [reportOpen, setReportOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [quickPicks, setQuickPicks] = useState([]);

  const positionRef = useRef(geo.position);
  positionRef.current = geo.position;
  const centerOnNextFix = useRef(false);
  // Jump to the user's first position fix, unless they've already moved the
  // map or opened a destination link: 'pending' | 'done' | 'skip'.
  const initialView = useRef(destination ? 'skip' : 'pending');

  const { reports, upsert, remove, realtimeStatus } = useReports({
    bbox: capabilities.community?.available ? bbox : null,
    client: capabilities.community?.available ? client : null,
    userId: user?.id,
  });

  // ---- Navigation -----------------------------------------------------------
  const reroute = useCallback(
    async (from) => {
      if (!destination) return null;
      const fresh = await planRoute({ origin: from, destination, preference, avoidTolls });
      setPlan(fresh);
      setSelectedRouteId(fresh.routes[0]?.id ?? null);
      return fresh.routes[0] ?? null;
    },
    [destination, preference, avoidTolls],
  );
  const nav = useNavigation({ position: geo.position, reroute });

  // Direction of travel for the 3D driving camera: the device heading when
  // moving, otherwise the direction of the route segment the driver is on.
  const navBearing = useMemo(() => {
    const p = geo.position;
    if (p && Number.isFinite(p.heading) && (p.speed ?? 0) > 1.5) return p.heading;
    const line = nav.prepared?.line;
    const i = nav.progress?.segmentIndex;
    if (line && Number.isInteger(i) && line[i + 1]) return bearingBetween(line[i], line[i + 1]);
    return null;
  }, [geo.position, nav.prepared, nav.progress?.segmentIndex]);
  const navBearingRef = useRef(navBearing);
  navBearingRef.current = navBearing;

  // Official traffic incidents: the visible area while browsing (if the
  // traffic layer is on), or the whole route area while navigating so
  // incidents ahead can be announced.
  const trafficAvailable = capabilities.traffic.available === true;
  const navRouteBbox = useMemo(() => (nav.route ? routeBbox(nav.route.geometry) : null), [nav.route]);
  const incidents = useTrafficIncidents({
    bbox: nav.active ? navRouteBbox : incidentViewBbox,
    enabled: trafficAvailable && (nav.active || trafficOn),
  });
  const notableIncidents = useMemo(() => incidents.filter(isNotable), [incidents]);
  const incidentMarkers = useMemo(() => incidents.filter(isMapMarker), [incidents]);
  const alertables = useMemo(() => [...reports, ...notableIncidents.map(incidentAsReport)], [reports, notableIncidents]);

  const guidance = useGuidance({
    active: nav.active,
    prepared: nav.prepared,
    progress: nav.progress,
    reports: alertables,
    rerouting: nav.rerouting,
  });
  // Keep the screen on for the whole trip.
  useWakeLock(nav.active);

  // ---- Map view tracking ----------------------------------------------------
  const onViewChange = useCallback((bounds, zoom) => {
    const c = bounds.getCenter();
    lastView.current = { center: [c.lat, c.lng], zoom };
    setMapCenter({ lat: c.lat, lng: c.lng });
    setBbox(zoom >= MIN_REPORT_ZOOM ? boundsToBbox(bounds) : null);
    setIncidentViewBbox(zoom >= MIN_INCIDENT_ZOOM ? boundsToBbox(bounds, 0.05) : null);
  }, []);

  useEffect(() => {
    if (!map) return;
    onViewChange(map.getBounds(), map.getZoom());
  }, [map, onViewChange]);

  // Follow the driver, and centre on the first fix after "My location".
  useEffect(() => {
    if (!map || !geo.position) return;
    const here = [geo.position.lat, geo.position.lng];
    if (initialView.current === 'pending') {
      initialView.current = 'done';
      map.setView(here, 16, { animate: false });
    } else if (centerOnNextFix.current) {
      centerOnNextFix.current = false;
      map.flyTo(here, Math.max(map.getZoom(), 16), { duration: 0.8 });
    } else if (following) {
      if (nav.active && map.follow) map.follow(here, navBearingRef.current);
      else map.panTo(here, { animate: true, duration: 0.5 });
    }
    // navBearingRef is read, not tracked: the camera moves on GPS updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, geo.position, following]);

  const errorRef = useRef(geo.status);
  useEffect(() => {
    if (errorRef.current !== geo.status && geo.error) {
      if (centerOnNextFix.current) {
        notify(geo.error, 'error', { duration: 6000 });
        centerOnNextFix.current = false;
      } else if (initialView.current === 'pending') {
        // The on-load request failed: keep the default view and say why, once.
        initialView.current = 'skip';
        notify(`${geo.error} Tap My location to try again.`, 'info', { duration: 7000 });
      }
    }
    errorRef.current = geo.status;
  }, [geo.status, geo.error, notify]);

  const handleLocate = () => {
    if (geo.position && map) {
      map.flyTo([geo.position.lat, geo.position.lng], Math.max(map.getZoom(), 16), { duration: 0.8 });
      setFollowing(true);
    } else {
      centerOnNextFix.current = true;
    }
    geo.locate();
  };

  // ---- Saved places / recent destinations for the search box ---------------
  const loadQuickPicks = useCallback(async () => {
    if (!user) {
      setQuickPicks([]);
      return;
    }
    try {
      const [saved, history] = await Promise.all([listSavedLocations(), listHistory(5)]);
      const order = { home: 0, work: 1, favorite: 2 };
      const savedPicks = [...saved]
        .sort((a, b) => order[a.category] - order[b.category])
        .map((s) => ({ id: `saved:${s.id}`, name: s.location_name, label: s.address, category: s.category, lat: s.latitude, lng: s.longitude }));
      const seen = new Set(savedPicks.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`));
      const recent = history
        .map((h) => ({ id: `recent:${h.id}`, name: h.destination_label, category: 'recent', lat: h.destination_latitude, lng: h.destination_longitude }))
        .filter((p) => !seen.has(`${p.lat.toFixed(4)},${p.lng.toFixed(4)}`) && seen.add(`${p.lat.toFixed(4)},${p.lng.toFixed(4)}`));
      setQuickPicks([...savedPicks, ...recent]);
    } catch {
      setQuickPicks([]);
    }
  }, [user]);

  useEffect(() => {
    loadQuickPicks();
  }, [loadQuickPicks]);

  // ---- Destination & route planning -----------------------------------------
  const selectDestination = useCallback(
    (place) => {
      setDestination(place);
      if (initialView.current === 'pending') initialView.current = 'skip';
      setPlan(null);
      setPlanError(null);
      setPanel('route');
      setFollowing(false);
      map?.flyTo([place.lat, place.lng], Math.max(map.getZoom(), 14), { duration: 0.8 });
    },
    [map],
  );

  const clearDestination = useCallback(() => {
    setDestination(null);
    setPlan(null);
    setPlanError(null);
    setPlanOrigin(null);
    setPanel((p) => (p === 'route' ? null : p));
    if (params.has('dest')) setParams({}, { replace: true });
  }, [params, setParams]);

  const hasPosition = Boolean(geo.position);

  useEffect(() => {
    if (!destination || nav.active) return undefined;
    const origin = positionRef.current;
    if (!origin) return undefined;
    const controller = new AbortController();
    setPlanLoading(true);
    setPlanError(null);
    const from = { lat: origin.lat, lng: origin.lng };
    planRoute({ origin: from, destination: { lat: destination.lat, lng: destination.lng }, preference, avoidTolls }, { signal: controller.signal })
      .then((result) => {
        setPlan(result);
        setPlanOrigin(from);
        setSelectedRouteId(result.routes[0]?.id ?? null);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setPlan(null);
        setPlanError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPlanLoading(false);
      });
    return () => controller.abort();
    // Re-plan when inputs change, not on every GPS update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, preference, avoidTolls, hasPosition]);

  // Fit the map to the recommended route once it arrives.
  useEffect(() => {
    if (!map || !plan || nav.active) return;
    const route = plan.routes[0];
    if (route?.geometry.length) map.fitBounds(route.geometry, { padding: [60, 60], paddingTopLeft: window.innerWidth >= 640 ? [420, 80] : [40, 80], maxZoom: 16 });
  }, [map, plan, nav.active]);

  const startNavigation = (route) => {
    // Speaking inside the click handler unlocks speech on iOS Safari, which
    // blocks speech that doesn't start from a user tap.
    guidance.say('Starting navigation.', { urgent: true });
    nav.start(route);
    geo.startTracking();
    setFollowing(true);
    setPanel(null);
    if (geo.position && map) {
      if (map.follow) map.follow([geo.position.lat, geo.position.lng], navBearingRef.current);
      else map.setView([geo.position.lat, geo.position.lng], 17, { animate: true });
    }
    if (user && destination) {
      addHistory({
        origin: planOrigin ? { label: 'Current location', ...planOrigin } : undefined,
        destination: { label: destination.name, lat: destination.lat, lng: destination.lng },
        distance: route.distance,
        duration: route.duration,
      })
        .then(loadQuickPicks)
        .catch(() => {});
    }
  };

  const endNavigation = () => {
    const arrived = nav.progress?.arrived;
    nav.end();
    // Stop continuous tracking as soon as navigation ends.
    geo.stopTracking();
    setFollowing(false);
    map?.resetCamera?.();
    if (arrived) clearDestination();
    else setPanel('route');
  };

  useEffect(() => {
    if (nav.progress?.arrived) notify('You have arrived at your destination.', 'success');
  }, [nav.progress?.arrived, notify]);

  // ---- Reports --------------------------------------------------------------
  const submitReport = async (input) => {
    const report = await createReport(input);
    upsert(report);
    notify('Thanks! Your report is now visible to other drivers.', 'success');
  };

  const vote = useCallback(
    async (report, type) => {
      if (!user) {
        notify('Sign in to confirm or clear reports.', 'info');
        return;
      }
      try {
        upsert(await voteOnReport(report.id, type));
        notify(type === 'confirm' ? 'Thanks for confirming.' : 'Thanks, we noted it is gone.', 'success');
      } catch (err) {
        notify(err.message, 'error');
        if (err.status === 410 || err.status === 404) remove(report.id);
      }
    },
    [user, upsert, remove, notify],
  );

  const withdraw = useCallback(
    async (report) => {
      try {
        await withdrawReport(report.id);
        remove(report.id);
        notify('Your report was withdrawn.', 'success');
      } catch (err) {
        notify(err.message, 'error');
      }
    },
    [remove, notify],
  );

  // Right-click / long-press on the map to navigate to that point.
  const onContextMenu = useCallback(
    async (point) => {
      const pin = { id: `pin:${point.lat},${point.lng}`, name: 'Dropped pin', label: formatCoords(point.lat, point.lng), ...point };
      selectDestination(pin);
      try {
        const place = await reverseGeocode(point);
        if (place) setDestination((d) => (d?.id === pin.id ? { ...pin, name: place.name || pin.name, label: place.label || pin.label } : d));
      } catch {
        /* keep the coordinate label */
      }
    },
    [selectDestination],
  );

  const saveDestination = async (location) => {
    await createSavedLocation(location);
    notify('Place saved.', 'success');
    loadQuickPicks();
  };

  const selectedRoute = plan?.routes.find((r) => r.id === selectedRouteId);
  const displayedRoutes = nav.active ? (nav.route ? [nav.route] : []) : plan?.routes ?? [];
  const displayedSelectedId = nav.active ? nav.route?.id : selectedRoute?.id;

  const near = useMemo(
    () => (geo.position ? { lat: geo.position.lat, lng: geo.position.lng } : mapCenter),
    // Only refresh the bias point when it moves noticeably.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geo.position && Math.round(geo.position.lat * 100), geo.position && Math.round(geo.position.lng * 100), mapCenter && Math.round(mapCenter.lat * 10), mapCenter && Math.round(mapCenter.lng * 10)],
  );

  const setMode = useCallback((on) => {
    setIs3D(on);
    setBearing(0);
    try {
      localStorage.setItem(MODE_KEY, on ? 'on' : 'off');
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggle3D = () => {
    if (!is3D && !webglSupported()) {
      notify('3D maps need WebGL, which this browser or device doesn’t support.', 'error');
      return;
    }
    setMap(null);
    setMode(!is3D);
  };

  const on3DFailed = useCallback(() => {
    setMap(null);
    setMode(false);
    notify('The 3D map couldn’t load, so Lesgo switched back to 2D.', 'error', { duration: 6000 });
  }, [setMode, notify]);

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {is3D ? (
        <Suspense fallback={<MapLoading />}>
          <MapView3D
            key="map3d"
            startView={lastView.current}
            onBearingChange={setBearing}
            onFatalError={on3DFailed}
        onMapReady={setMap}
            userPosition={geo.position}
            destination={destination}
            origin={!nav.active && plan ? planOrigin : null}
            routes={displayedRoutes}
            selectedRouteId={displayedSelectedId}
            onSelectRoute={nav.active ? undefined : setSelectedRouteId}
            traveled={nav.active ? nav.traveled : null}
            reports={reports}
            incidents={trafficOn || nav.active ? incidentMarkers : []}
            showTrafficFlow={trafficAvailable && trafficOn}
            onVote={vote}
            onWithdraw={withdraw}
            onViewChange={onViewChange}
            onUserPan={() => {
              setFollowing(false);
              if (initialView.current === 'pending') initialView.current = 'skip';
            }}
            onContextMenu={nav.active ? undefined : onContextMenu}
          />
        </Suspense>
      ) : (
        <MapView
          key="map2d"
          startView={lastView.current}
        onMapReady={setMap}
          userPosition={geo.position}
          destination={destination}
          origin={!nav.active && plan ? planOrigin : null}
          routes={displayedRoutes}
          selectedRouteId={displayedSelectedId}
          onSelectRoute={nav.active ? undefined : setSelectedRouteId}
          traveled={nav.active ? nav.traveled : null}
          reports={reports}
          incidents={trafficOn || nav.active ? incidentMarkers : []}
          showTrafficFlow={trafficAvailable && trafficOn}
          onVote={vote}
          onWithdraw={withdraw}
          onViewChange={onViewChange}
          onUserPan={() => {
            setFollowing(false);
            if (initialView.current === 'pending') initialView.current = 'skip';
          }}
          onContextMenu={nav.active ? undefined : onContextMenu}
        />
      )}

      <MapModeControl
        is3D={is3D}
        onToggle={toggle3D}
        bearing={bearing}
        onResetNorth={() => map?.resetNorth?.()}
        className={nav.active ? 'bottom-24 sm:bottom-28' : 'bottom-[5.75rem] sm:bottom-28'}
      />

      {nav.active ? (
        <NavigationHUD
          progress={nav.progress}
          speed={geo.position?.speed}
          rerouting={nav.rerouting}
          gpsStatus={geo.status}
          following={following}
          onRecenter={() => {
            setFollowing(true);
            if (!geo.position || !map) return;
            if (map.follow) map.follow([geo.position.lat, geo.position.lng], navBearingRef.current);
            else map.flyTo([geo.position.lat, geo.position.lng], 17, { duration: 0.6 });
          }}
          onEnd={endNavigation}
          onReport={() => setReportOpen(true)}
          reportAhead={guidance.reportAhead}
          reportsAheadCount={guidance.reportsAheadCount}
          voice={{ supported: guidance.voiceSupported, on: guidance.voiceOn, toggle: guidance.toggleVoice }}
        />
      ) : (
        <>
          <header className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-start gap-2 p-2 sm:gap-3 sm:p-4">
            <div className="panel pointer-events-auto hidden h-12 items-center rounded-full pr-4 pl-2 md:flex">
              <Logo />
            </div>
            <div className="pointer-events-auto flex-1 sm:mx-auto sm:max-w-xl">
              <SearchBar
                onSelect={selectDestination}
                onClear={clearDestination}
                near={near}
                selectedLabel={destination?.name ?? ''}
                quickPicks={quickPicks}
                autocomplete={capabilities.geocoding.supportsAutocomplete}
              />
              {/* With the route panel open on larger screens, keep the chips to the right of it. */}
              <div className={`mt-2 flex flex-wrap gap-2 ${panel === 'route' && destination ? 'sm:justify-end' : ''}`}>
                <span className="map-chip" title="Incident pins are reported by drivers and are not verified.">
                  <span
                    className={`status-dot ${realtimeStatus === 'live' ? 'bg-go-500 shadow-[0_0_0_3px] shadow-go-500/20' : 'bg-slate-400'}`}
                    aria-hidden
                  />
                  {capabilities.community?.available === false
                    ? 'Community reports unavailable'
                    : `Community reports${realtimeStatus === 'live' ? ' · live' : ''}`}
                </span>
                {trafficAvailable ? (
                  <button
                    type="button"
                    className="map-chip aria-pressed:border-go-500/40"
                    onClick={toggleTraffic}
                    aria-pressed={trafficOn}
                    title="Live road speeds and official incidents from TomTom"
                  >
                    <Layers className={`h-3.5 w-3.5 ${trafficOn ? 'text-go-600 dark:text-green-400' : 'text-slate-400'}`} aria-hidden />
                    Live traffic {trafficOn ? 'on' : 'off'}
                  </button>
                ) : (
                  <button type="button" className="map-chip" onClick={() => setPanel('info')}>
                    <Info className="h-3.5 w-3.5 text-slate-500" aria-hidden /> No live traffic data
                  </button>
                )}
              </div>
            </div>
            <div className="pointer-events-auto">
              <ProfileMenu />
            </div>
          </header>

          {panel === 'route' && destination && (
            <RoutePanel
              destination={destination}
              hasOrigin={hasPosition}
              onUseLocation={geo.locate}
              locationStatus={geo.status}
              plan={plan}
              loading={planLoading}
              error={planError}
              selectedRouteId={selectedRouteId}
              onSelectRoute={setSelectedRouteId}
              preference={preference}
              onPreferenceChange={setPreference}
              avoidTolls={avoidTolls}
              onAvoidTollsChange={setAvoidTolls}
              capabilities={capabilities}
              onStart={startNavigation}
              onSave={() => setSaveOpen(true)}
              canSave={Boolean(user)}
              onClose={() => setPanel(null)}
            />
          )}

          {panel === 'info' && <LocationPanel geo={geo} realtimeStatus={realtimeStatus} capabilities={capabilities} onClose={() => setPanel(null)} />}

          <FloatingControls
            onLocate={handleLocate}
            locating={geo.status === 'locating'}
            locationActive={geo.status === 'active'}
            onReport={() => setReportOpen(true)}
            onRouteOptions={() => setPanel((p) => (p === 'route' ? null : 'route'))}
            routeOptionsAvailable={Boolean(destination)}
            routeOpen={panel === 'route'}
            onInfo={() => setPanel((p) => (p === 'info' ? null : 'info'))}
            infoOpen={panel === 'info'}
            onZoomIn={() => map?.zoomIn()}
            onZoomOut={() => map?.zoomOut()}
          />
        </>
      )}

      {reportOpen && (
        <ReportDialog user={user} userPosition={geo.position} mapCenter={mapCenter} onSubmit={submitReport} onClose={() => setReportOpen(false)} />
      )}
      {saveOpen && destination && <SavePlaceDialog place={destination} onSave={saveDestination} onClose={() => setSaveOpen(false)} />}
    </div>
  );
}

function MapLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#eef0f3] dark:bg-navy-900" role="status">
      <span className="panel flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" aria-hidden /> Loading 3D map…
      </span>
    </div>
  );
}
