// Map tile configuration.
// - With VITE_TOMTOM_API_KEY: TomTom "basic" (light) and "night" (dark)
//   styles. Cleaner than OSM's default style (far fewer POI icons), so routes,
//   traffic and incidents are easier to read. These tiles count towards the
//   TomTom tile quota, shared with the traffic flow layer.
// - Otherwise: OpenStreetMap standard tiles. Their tile usage policy
//   (https://operations.osmfoundation.org/policies/tiles/) forbids heavy use;
//   use a commercial or self-hosted provider in production. Dark mode uses the
//   same tiles darkened with a CSS filter.
// Set VITE_TILE_LIGHT_URL / VITE_TILE_DARK_URL (and *_ATTRIBUTION) to use any
// other provider; they take precedence over both defaults.

const env = import.meta.env;
const TOMTOM_KEY = env.VITE_TOMTOM_API_KEY || '';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const TOMTOM_ATTRIBUTION = '&copy; <a href="https://www.tomtom.com">TomTom</a>';
const tomtomStyle = (style) =>
  `https://api.tomtom.com/map/1/tile/basic/${style}/{z}/{x}/{y}.png?key=${TOMTOM_KEY}&tileSize=256&view=Unified&language=en-GB`;

const osmLight = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: OSM_ATTRIBUTION,
  maxZoom: 19,
};

function lightTiles() {
  if (env.VITE_TILE_LIGHT_URL) {
    return { url: env.VITE_TILE_LIGHT_URL, attribution: env.VITE_TILE_LIGHT_ATTRIBUTION || OSM_ATTRIBUTION, maxZoom: 19 };
  }
  if (TOMTOM_KEY) return { url: tomtomStyle('main'), attribution: TOMTOM_ATTRIBUTION, maxZoom: 20 };
  return osmLight;
}

function darkTiles() {
  if (env.VITE_TILE_DARK_URL) {
    return {
      url: env.VITE_TILE_DARK_URL,
      attribution: env.VITE_TILE_DARK_ATTRIBUTION || OSM_ATTRIBUTION,
      maxZoom: 20,
      subdomains: env.VITE_TILE_DARK_SUBDOMAINS || 'abc',
    };
  }
  if (env.VITE_TILE_LIGHT_URL) return { ...lightTiles(), className: 'rp-dark-tiles' };
  if (TOMTOM_KEY) return { url: tomtomStyle('night'), attribution: TOMTOM_ATTRIBUTION, maxZoom: 20 };
  return { ...osmLight, className: 'rp-dark-tiles' };
}

export const TILE_PROVIDERS = { light: lightTiles(), dark: darkTiles() };

export const DEFAULT_CENTER = [
  Number(env.VITE_DEFAULT_LAT) || 3.1478, // Kuala Lumpur city centre
  Number(env.VITE_DEFAULT_LNG) || 101.6953,
];
export const DEFAULT_ZOOM = Number(env.VITE_DEFAULT_ZOOM) || 13;
// Below this zoom, community reports are not requested (area would be too large).
export const MIN_REPORT_ZOOM = 9;

// Live traffic flow overlay (TomTom). Road colours show current speed relative
// to free flow. The key is visible to the browser: restrict it to your
// domain in the TomTom developer dashboard.
export const TRAFFIC_FLOW = TOMTOM_KEY
  ? {
      light: `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_KEY}&tileSize=256`,
      dark: `https://api.tomtom.com/traffic/map/4/tile/flow/relative0-dark/{z}/{x}/{y}.png?key=${TOMTOM_KEY}&tileSize=256`,
      attribution: 'Traffic &copy; <a href="https://www.tomtom.com">TomTom</a>',
      maxZoom: 22,
    }
  : null;
// Traffic incidents are requested from this zoom level (smaller areas).
export const MIN_INCIDENT_ZOOM = 11;
