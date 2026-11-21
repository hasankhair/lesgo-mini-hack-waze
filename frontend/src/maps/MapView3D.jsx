import { memo, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Map as MapLibreMap, Marker, Popup, AttributionControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { DEFAULT_CENTER, DEFAULT_ZOOM, TRAFFIC_FLOW } from './tileProviders.js';
import { incidentIcon, placeIcon, reportIcon, userLocationIcon } from './markerIcons.js';
import { STYLE_URLS, installLayers, setTrafficVisible } from './map3d/style.js';
import { leafletLikeBounds, lngLatBoundsOf, routeFeatures, toLeafletZoom, toMapLibrePadding, toMapLibreZoom } from './map3d/helpers.js';
import ReportPopup from '../reports/ReportPopup.jsx';
import IncidentPopup from '../reports/IncidentPopup.jsx';

// MapLibre v6 loads its worker from a separate module file; point it at the
// copy Vite emits so it works in production builds too.
setWorkerUrl(workerUrl);

export const DEFAULT_PITCH = 55;
const NAV_PITCH = 60;

// Builds a DOM element and MapLibre options from a Leaflet divIcon, so 2D and
// 3D use exactly the same marker artwork.
function markerFromIcon(icon, extra = {}) {
  const { html, iconSize = [24, 24], iconAnchor = [12, 12], popupAnchor = [0, -12] } = icon.options;
  const el = document.createElement('div');
  el.className = 'rp-marker3d';
  el.style.width = `${iconSize[0]}px`;
  el.style.height = `${iconSize[1]}px`;
  el.innerHTML = html;
  const marker = new Marker({ element: el, anchor: 'top-left', offset: [-iconAnchor[0], -iconAnchor[1]], ...extra });
  // Popup tip sits at the icon's popup anchor, measured from the marker point.
  const tip = popupAnchor[1];
  const offset = { bottom: [0, tip], 'bottom-left': [0, tip], 'bottom-right': [0, tip], top: [0, 6], 'top-left': [0, 6], 'top-right': [0, 6], left: [12, tip / 2], right: [-12, tip / 2], center: [0, 0] };
  return { marker, el, offset };
}

// Keeps a set of markers (keyed by id) in sync with a list of items. Each
// marker gets a React-rendered popup that updates while open.
function useMarkerLayer(mapRef, items, { getIcon, iconKey, renderPopup }) {
  const store = useRef(new Map());
  const latest = useRef(new Map());

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [id, entry] of store.current) {
      if (entry.map !== map) {
        entry.dispose();
        store.current.delete(id);
      }
    }
    const seen = new Set();
    for (const item of items) {
      seen.add(item.id);
      latest.current.set(item.id, item);
      const key = iconKey(item);
      const existing = store.current.get(item.id);
      if (existing && existing.key === key) {
        existing.marker.setLngLat([item.longitude, item.latitude]);
        existing.root?.render(renderPopup(item));
        continue;
      }
      if (existing) existing.dispose();

      const { marker, offset } = markerFromIcon(getIcon(item));
      const node = document.createElement('div');
      const popup = new Popup({ offset, maxWidth: 'none', closeButton: true, className: 'rp-popup3d', focusAfterOpen: false }).setDOMContent(node);
      const entry = { marker, key, root: null, map };
      popup.on('open', () => {
        entry.root = createRoot(node);
        entry.root.render(renderPopup(latest.current.get(item.id) ?? item));
      });
      popup.on('close', () => {
        const root = entry.root;
        entry.root = null;
        // Unmount after the current event so React isn't mid-render.
        queueMicrotask(() => root?.unmount());
      });
      marker.setLngLat([item.longitude, item.latitude]).setPopup(popup).addTo(map);
      entry.dispose = () => {
        popup.remove();
        marker.remove();
      };
      store.current.set(item.id, entry);
    }
    for (const [id, entry] of store.current) {
      if (!seen.has(id)) {
        entry.dispose();
        store.current.delete(id);
        latest.current.delete(id);
      }
    }
  });

  useEffect(
    () => () => {
      for (const entry of store.current.values()) entry.dispose();
      store.current.clear();
    },
    [],
  );
}

function usePlaceMarker(mapRef, point, kind) {
  const ref = useRef(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    if (!point) {
      ref.current?.marker.remove();
      ref.current = null;
      return undefined;
    }
    if (!ref.current || ref.current.map !== map) {
      ref.current?.marker.remove();
      ref.current = { marker: markerFromIcon(placeIcon(kind)).marker.setLngLat([point.lng, point.lat]).addTo(map), map };
    } else {
      ref.current.marker.setLngLat([point.lng, point.lat]);
    }
    return undefined;
  });
  useEffect(
    () => () => {
      ref.current?.marker.remove();
      ref.current = null;
    },
    [],
  );
}

function MapView3D({
  onMapReady,
  onBearingChange,
  onFatalError,
  startView,
  userPosition,
  destination,
  origin,
  routes = [],
  selectedRouteId,
  onSelectRoute,
  traveled,
  reports = [],
  incidents = [],
  showTrafficFlow = false,
  onVote,
  onWithdraw,
  onViewChange,
  onUserPan,
  onContextMenu,
}) {
  const { resolved } = useTheme();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const readyRef = useRef(false);
  const props = useRef({});
  props.current = { onViewChange, onUserPan, onContextMenu, onSelectRoute, onBearingChange, onFatalError, routes, selectedRouteId, traveled, showTrafficFlow };

  // Create the map once.
  useEffect(() => {
    const [lat, lng] = startView?.center ?? DEFAULT_CENTER;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: STYLE_URLS[resolved] ?? STYLE_URLS.light,
      center: [lng, lat],
      zoom: toMapLibreZoom(startView?.zoom ?? DEFAULT_ZOOM),
      pitch: DEFAULT_PITCH,
      maxPitch: 70,
      attributionControl: false,
      dragRotate: true,
      touchPitch: true,
      fadeDuration: 150,
    });
    mapRef.current = map;
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
    // Some OpenFreeMap POI icons aren't in its sprite; use a blank image
    // instead of logging a warning for each one.
    const blank = { width: 1, height: 1, data: new Uint8Array(4) };
    if (typeof map.setMissingStyleImageResolver === 'function') map.setMissingStyleImageResolver(() => blank);
    else map.on('styleimagemissing', (e) => !map.hasImage(e.id) && map.addImage(e.id, blank));

    let loadedOnce = false;
    let disposed = false;
    const syncData = () => {
      const p = props.current;
      map.getSource('routes')?.setData(routeFeatures(p.routes, p.selectedRouteId, p.traveled));
      setTrafficVisible(map, p.showTrafficFlow);
    };
    map.on('style.load', () => {
      installLayers(map, {
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        trafficTiles: TRAFFIC_FLOW ? (document.documentElement.classList.contains('dark') ? TRAFFIC_FLOW.dark : TRAFFIC_FLOW.light) : null,
        trafficAttribution: TRAFFIC_FLOW?.attribution,
      });
      readyRef.current = true;
      clearTimeout(loadTimer);
      syncData();
      if (!loadedOnce) {
        loadedOnce = true;
        onMapReady?.(adapter);
        props.current.onViewChange?.(adapter.getBounds(), adapter.getZoom());
      }
    });
    // When the page unloads, the browser cancels in-flight requests and
    // MapLibre reports them as errors; never treat those as a failure.
    const onPageHide = () => {
      disposed = true;
    };
    window.addEventListener('pagehide', onPageHide);

    map.on('error', (e) => {
      // Only a base style that the server refuses (HTTP error status) is
      // fatal: the 3D map can't be shown at all. Ignore tile/source errors
      // (they carry a sourceId), cancelled or interrupted requests (no
      // status), and anything after the first successful load.
      const err = e?.error;
      if (!err || loadedOnce || disposed || e.sourceId) return;
      if (!(Number(err.status) >= 400)) return;
      props.current.onFatalError?.(err);
    });
    // A style that never loads (e.g. offline) is also fatal, after a while.
    const loadTimer = setTimeout(() => {
      if (!loadedOnce && !disposed && document.visibilityState === 'visible') {
        props.current.onFatalError?.(new Error('3D map style did not load in time'));
      }
    }, 15000);
    map.on('moveend', () => props.current.onViewChange?.(adapter.getBounds(), adapter.getZoom()));
    map.on('dragstart', () => props.current.onUserPan?.());
    map.on('rotate', () => props.current.onBearingChange?.(map.getBearing()));
    map.on('contextmenu', (e) => props.current.onContextMenu?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    for (const layer of ['route-line', 'route-casing']) {
      map.on('click', layer, (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) props.current.onSelectRoute?.(id);
      });
      map.on('mouseenter', layer, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layer, () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // Leaflet-compatible camera API used by the map page, plus 3D extras.
    const toCenter = ([la, ln]) => [ln, la];
    const adapter = {
      is3D: true,
      getZoom: () => toLeafletZoom(map.getZoom()),
      getBounds: () => leafletLikeBounds(map.getBounds()),
      zoomIn: () => map.zoomIn(),
      zoomOut: () => map.zoomOut(),
      setView: (latlng, zoom, opts = {}) =>
        opts.animate === false ? map.jumpTo({ center: toCenter(latlng), zoom: toMapLibreZoom(zoom) }) : map.easeTo({ center: toCenter(latlng), zoom: toMapLibreZoom(zoom), duration: 700 }),
      flyTo: (latlng, zoom, opts = {}) => map.flyTo({ center: toCenter(latlng), zoom: toMapLibreZoom(zoom), duration: (opts.duration ?? 0.8) * 1000, essential: true }),
      panTo: (latlng, opts = {}) => map.easeTo({ center: toCenter(latlng), duration: (opts.duration ?? 0.5) * 1000 }),
      fitBounds: (points, opts = {}) =>
        map.fitBounds(lngLatBoundsOf(points), { padding: toMapLibrePadding(opts), maxZoom: toMapLibreZoom(opts.maxZoom ?? 18), duration: 900 }),
      // Driving camera: behind the car, facing the direction of travel.
      follow: (latlng, bearing) =>
        map.easeTo({
          center: toCenter(latlng),
          bearing: Number.isFinite(bearing) ? bearing : map.getBearing(),
          pitch: NAV_PITCH,
          zoom: Math.max(map.getZoom(), toMapLibreZoom(17)),
          padding: { top: Math.round(map.getContainer().clientHeight * 0.35), bottom: 0, left: 0, right: 0 },
          duration: 900,
          easing: (t) => t,
        }),
      resetCamera: () => map.easeTo({ bearing: 0, pitch: DEFAULT_PITCH, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 600 }),
      resetNorth: () => map.easeTo({ bearing: 0, duration: 500 }),
    };

    return () => {
      disposed = true;
      clearTimeout(loadTimer);
      window.removeEventListener('pagehide', onPageHide);
      readyRef.current = false;
      onMapReady?.(null);
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme: swap the base style (custom layers are re-added on style.load).
  const themeRef = useRef(resolved);
  useEffect(() => {
    if (themeRef.current === resolved) return;
    themeRef.current = resolved;
    mapRef.current?.setStyle(STYLE_URLS[resolved] ?? STYLE_URLS.light);
  }, [resolved]);

  // Routes and traffic visibility.
  useEffect(() => {
    if (!readyRef.current) return;
    mapRef.current?.getSource('routes')?.setData(routeFeatures(routes, selectedRouteId, traveled));
  }, [routes, selectedRouteId, traveled]);
  useEffect(() => {
    if (readyRef.current && mapRef.current) setTrafficVisible(mapRef.current, showTrafficFlow);
  }, [showTrafficFlow]);

  useMarkerLayer(mapRef, reports, {
    getIcon: (r) => reportIcon(r.report_type, { confirmed: r.confirmation_count > 0 }),
    iconKey: (r) => `${r.report_type}:${r.confirmation_count > 0}`,
    renderPopup: (r) => <ReportPopup report={r} onVote={onVote} onWithdraw={onWithdraw} />,
  });
  useMarkerLayer(mapRef, incidents, {
    getIcon: (i) => incidentIcon(i.category),
    iconKey: (i) => i.category,
    renderPopup: (i) => <IncidentPopup incident={i} />,
  });
  usePlaceMarker(mapRef, origin, 'origin');
  usePlaceMarker(mapRef, destination, 'destination');

  // The user's position. With a heading, the arrow lies flat on the ground and
  // turns with the map.
  const userMarker = useRef(null);
  const hasHeading = Number.isFinite(userPosition?.heading);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!userPosition) {
      userMarker.current?.marker.remove();
      userMarker.current = null;
      return;
    }
    if (!userMarker.current || userMarker.current.hasHeading !== hasHeading || userMarker.current.map !== map) {
      userMarker.current?.marker.remove();
      const { marker } = markerFromIcon(userLocationIcon(hasHeading ? 0 : null), { rotationAlignment: 'map', pitchAlignment: 'map' });
      marker.getElement().style.zIndex = '5';
      userMarker.current = { marker: marker.setLngLat([userPosition.lng, userPosition.lat]).addTo(map), hasHeading, map };
    }
    userMarker.current.marker.setLngLat([userPosition.lng, userPosition.lat]);
    if (hasHeading) userMarker.current.marker.setRotation(userPosition.heading);
  });
  useEffect(
    () => () => {
      userMarker.current?.marker.remove();
      userMarker.current = null;
    },
    [],
  );

  return <div ref={containerRef} className="h-full w-full bg-[#eef0f3] dark:bg-navy-900" role="region" aria-label="Interactive 3D map" />;
}

export default memo(MapView3D);
