// Traffic data adapter. Lesgo ships without a live traffic feed: the
// "none" provider reports that no official traffic data is available, so the
// UI shows only community reports and labels them as such.
//
// To add a provider (e.g. TomTom Traffic Flow, HERE Traffic), implement:
//   name: string
//   available: boolean
//   getFlow({ bbox: { minLat, minLng, maxLat, maxLng } }) ->
//     { segments: [{ geometry: [lat,lng][], speedKmh, freeFlowKmh, congestion: 'free'|'moderate'|'heavy' }],
//       attribution: string }
// and register it below.

export function createNoTrafficProvider() {
  return {
    name: 'none',
    available: false,
    async getFlow() {
      return { segments: [], attribution: null };
    },
  };
}

export function createTrafficProvider(config) {
  switch (config.traffic.provider) {
    case 'none':
      return createNoTrafficProvider();
    default:
      throw new Error(`Unknown TRAFFIC_PROVIDER "${config.traffic.provider}"`);
  }
}
