// Base map styles and extra layers for the 3D map.
//
// Defaults use OpenFreeMap (https://openfreemap.org): free OpenStreetMap
// vector tiles with building heights, no API key, no usage limits for
// reasonable use, attribution required (included in the styles). Override
// with VITE_MAP3D_STYLE_LIGHT / VITE_MAP3D_STYLE_DARK (any MapLibre style URL
// based on the OpenMapTiles schema, e.g. MapTiler).

const env = import.meta.env;

export const STYLE_URLS = {
  light: env.VITE_MAP3D_STYLE_LIGHT || 'https://tiles.openfreemap.org/styles/liberty',
  dark: env.VITE_MAP3D_STYLE_DARK || 'https://tiles.openfreemap.org/styles/fiord',
};

const BUILDING_COLORS = {
  light: 'hsl(35, 8%, 86%)',
  dark: 'hsl(215, 22%, 30%)',
};

const firstSymbolLayerId = (map) => map.getStyle().layers.find((l) => l.type === 'symbol')?.id;

// Adds 3D building extrusions (if the style lacks them), the live traffic
// raster and the route layers. Runs after every style load, because
// setStyle() drops custom layers.
export function installLayers(map, { theme, trafficTiles, trafficAttribution }) {
  const labels = firstSymbolLayerId(map);
  const style = map.getStyle();
  const vectorSource = Object.entries(style.sources).find(([, s]) => s.type === 'vector')?.[0];

  // 3D buildings
  if (vectorSource) {
    if (map.getLayer('building-3d')) {
      map.setPaintProperty('building-3d', 'fill-extrusion-color', BUILDING_COLORS[theme]);
      map.setPaintProperty('building-3d', 'fill-extrusion-opacity', theme === 'dark' ? 0.9 : 0.8);
    } else {
      map.addLayer(
        {
          id: 'building-3d',
          type: 'fill-extrusion',
          source: vectorSource,
          'source-layer': 'building',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': BUILDING_COLORS[theme],
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': theme === 'dark' ? 0.9 : 0.8,
          },
        },
        labels,
      );
    }
  }

  // Live traffic colours, draped on the ground under buildings and labels.
  if (trafficTiles && !map.getSource('traffic-flow')) {
    map.addSource('traffic-flow', { type: 'raster', tiles: [trafficTiles], tileSize: 256, attribution: trafficAttribution });
    map.addLayer(
      { id: 'traffic-flow', type: 'raster', source: 'traffic-flow', paint: { 'raster-opacity': 0.9 }, layout: { visibility: 'none' } },
      map.getLayer('building-3d') ? 'building-3d' : labels,
    );
  }

  // Routes, drawn above buildings so they're never hidden behind them: insert
  // before the first label layer that comes after the 3D buildings (styles
  // differ in where buildings sit), or on top if there is none.
  if (!map.getSource('routes')) {
    map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const layers = map.getStyle().layers;
    const buildingIndex = layers.findIndex((l) => l.id === 'building-3d');
    const before = layers.find((l, i) => i > buildingIndex && l.type === 'symbol')?.id;
    map.addLayer(
      {
        id: 'route-casing',
        type: 'line',
        source: 'routes',
        filter: ['==', ['get', 'kind'], 'route'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['case', ['get', 'selected'], '#1e3a8a', '#64748b'],
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, ['case', ['get', 'selected'], 8, 6], 14, ['case', ['get', 'selected'], 13, 10], 17, ['case', ['get', 'selected'], 24, 18]],
          'line-opacity': ['case', ['get', 'selected'], 0.9, 0.55],
        },
      },
      before,
    );
    map.addLayer(
      {
        id: 'route-line',
        type: 'line',
        source: 'routes',
        filter: ['==', ['get', 'kind'], 'route'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['case', ['get', 'selected'], '#3b82f6', '#cbd5e1'],
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, ['case', ['get', 'selected'], 5, 4], 14, ['case', ['get', 'selected'], 9, 7], 17, ['case', ['get', 'selected'], 17, 13]],
        },
      },
      before,
    );
    map.addLayer(
      {
        id: 'route-traveled',
        type: 'line',
        source: 'routes',
        filter: ['==', ['get', 'kind'], 'traveled'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#94a3b8', 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, 5, 14, 9, 17, 17] },
      },
      before,
    );
  }
}

export function setTrafficVisible(map, visible) {
  if (map.getLayer('traffic-flow')) map.setLayoutProperty('traffic-flow', 'visibility', visible ? 'visible' : 'none');
}
