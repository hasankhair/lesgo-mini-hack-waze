// Map tile configuration. Defaults use free services suitable for development:
// - Light: OpenStreetMap standard tiles. Their tile usage policy
//   (https://operations.osmfoundation.org/policies/tiles/) forbids heavy use;
//   use a commercial or self-hosted provider in production.
// - Dark: the same OSM tiles darkened with a CSS filter (no API key needed).
//   For a native dark style set VITE_TILE_DARK_URL, e.g. CARTO Dark Matter
//   (requires a CARTO key for most use) or MapTiler/Stadia dark styles.
// Override with VITE_TILE_LIGHT_URL / VITE_TILE_DARK_URL and the matching
// *_ATTRIBUTION variables (e.g. MapTiler, Stadia Maps, or your own tiles).

const env = import.meta.env;

export const TILE_PROVIDERS = {
  light: {
    url: env.VITE_TILE_LIGHT_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      env.VITE_TILE_LIGHT_ATTRIBUTION ||
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  dark: env.VITE_TILE_DARK_URL
    ? {
        url: env.VITE_TILE_DARK_URL,
        attribution: env.VITE_TILE_DARK_ATTRIBUTION || '&copy; OpenStreetMap contributors',
        maxZoom: 20,
        subdomains: env.VITE_TILE_DARK_SUBDOMAINS || 'abc',
      }
    : {
        url: env.VITE_TILE_LIGHT_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution:
          env.VITE_TILE_LIGHT_ATTRIBUTION ||
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        className: 'rp-dark-tiles',
      },
};

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
const TOMTOM_KEY = env.VITE_TOMTOM_API_KEY || '';
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
