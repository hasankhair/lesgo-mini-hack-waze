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
  Number(env.VITE_DEFAULT_LAT) || 51.5074,
  Number(env.VITE_DEFAULT_LNG) || -0.1278,
];
export const DEFAULT_ZOOM = Number(env.VITE_DEFAULT_ZOOM) || 13;
// Below this zoom, community reports are not requested (area would be too large).
export const MIN_REPORT_ZOOM = 9;
