import { createTomTomTrafficProvider } from './tomtom.js';

// Traffic data adapter contract:
//   name: string
//   available: boolean
//   attribution: string | null
//   getIncidents({ bbox: { minLat, minLng, maxLat, maxLng } }) -> Incident[]
// Incident: { id, category, label, description, severity, from, to,
//             delaySeconds, lengthMeters, roadNumbers, startTime, endTime,
//             latitude, longitude, geometry: [lat,lng][] }
//
// The "none" provider reports that no official traffic data is connected, so
// the UI shows only community reports and labels them as such.

export function createNoTrafficProvider() {
  return {
    name: 'none',
    available: false,
    attribution: null,
    async getIncidents() {
      return [];
    },
  };
}

export function createTrafficProvider(config, fetchJson) {
  switch (config.traffic.provider) {
    case 'none':
      return createNoTrafficProvider();
    case 'tomtom':
      return createTomTomTrafficProvider({ baseUrl: config.tomtom.baseUrl, apiKey: config.tomtom.apiKey, fetchJson });
    default:
      throw new Error(`Unknown TRAFFIC_PROVIDER "${config.traffic.provider}"`);
  }
}
