// Pure helpers for the 3D (MapLibre) map. Kept free of MapLibre imports so
// they can be unit-tested without WebGL.

// Leaflet uses 256 px tiles and MapLibre 512 px tiles, so the same view is one
// zoom level lower in MapLibre. The app works in Leaflet zoom levels.
export const toMapLibreZoom = (leafletZoom) => leafletZoom - 1;
export const toLeafletZoom = (maplibreZoom) => maplibreZoom + 1;

export const toLngLat = ([lat, lng]) => [lng, lat];

// Converts Leaflet fitBounds padding options to MapLibre's {top,right,bottom,left}.
export function toMapLibrePadding({ padding = [0, 0], paddingTopLeft, paddingBottomRight } = {}) {
  const [px, py] = padding;
  const [tlx, tly] = paddingTopLeft ?? [px, py];
  const [brx, bry] = paddingBottomRight ?? [px, py];
  return { top: tly, left: tlx, right: brx, bottom: bry };
}

// [[lat,lng], ...] -> [[minLng,minLat],[maxLng,maxLat]]
export function lngLatBoundsOf(points) {
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

// Wraps MapLibre bounds in the subset of Leaflet's LatLngBounds API the app uses.
export function leafletLikeBounds(b) {
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  return {
    getSouthWest: () => ({ lat: sw.lat, lng: sw.lng }),
    getNorthEast: () => ({ lat: ne.lat, lng: ne.lng }),
    getCenter: () => ({ lat: (sw.lat + ne.lat) / 2, lng: (sw.lng + ne.lng) / 2 }),
  };
}

// GeoJSON for route lines. The selected route is drawn last (on top).
export function routeFeatures(routes = [], selectedId, traveled) {
  const features = [...routes]
    .sort((a, b) => (a.id === selectedId ? 1 : b.id === selectedId ? -1 : 0))
    .map((route) => ({
      type: 'Feature',
      properties: { id: route.id, selected: route.id === selectedId, kind: 'route' },
      geometry: { type: 'LineString', coordinates: route.geometry.map(toLngLat) },
    }));
  if (traveled?.length > 1) {
    features.push({
      type: 'Feature',
      properties: { id: 'traveled', selected: true, kind: 'traveled' },
      geometry: { type: 'LineString', coordinates: traveled.map(toLngLat) },
    });
  }
  return { type: 'FeatureCollection', features };
}

// Smallest signed difference between two bearings, in degrees (-180..180).
export const bearingDelta = (from, to) => ((((to - from) % 360) + 540) % 360) - 180;

export function webglSupported() {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
