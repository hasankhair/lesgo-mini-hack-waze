// Nominatim geocoder adapter. The public instance's usage policy
// (https://operations.osmfoundation.org/policies/nominatim/) allows at most
// 1 request per second and forbids client-side autocomplete, so this adapter
// throttles requests and reports supportsAutocomplete=false. The frontend then
// searches only when the user submits. Point NOMINATIM_URL at your own
// instance to lift these limits.

function toPlace(item) {
  return {
    id: `nominatim:${item.osm_type?.[0]?.toUpperCase() || 'X'}${item.osm_id ?? item.place_id}`,
    name: item.name || item.display_name?.split(',')[0] || 'Unnamed place',
    label: item.display_name,
    category: item.type === 'fuel' ? 'petrol_station' : item.type || item.category || 'place',
    lat: Number(item.lat),
    lng: Number(item.lon),
  };
}

function createThrottle(minIntervalMs) {
  let next = 0;
  return async () => {
    const now = Date.now();
    const wait = Math.max(0, next - now);
    next = Math.max(now, next) + minIntervalMs;
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  };
}

export function createNominatimGeocoder({ baseUrl, email, fetchJson, minIntervalMs = 1000 }) {
  const base = baseUrl.replace(/\/$/, '');
  const throttle = createThrottle(minIntervalMs);
  const common = (params) => {
    params.set('format', 'jsonv2');
    if (email) params.set('email', email);
    return params;
  };

  return {
    name: 'nominatim',
    supportsAutocomplete: false,

    async search({ query, near, limit = 6, lang }) {
      const params = common(new URLSearchParams({ q: query, limit: String(limit) }));
      if (near) {
        const d = 0.5;
        params.set('viewbox', [near.lng - d, near.lat + d, near.lng + d, near.lat - d].join(','));
      }
      await throttle();
      const { data } = await fetchJson(`${base}/search?${params}`, {
        headers: lang ? { 'Accept-Language': lang } : {},
      });
      return (Array.isArray(data) ? data : []).map(toPlace);
    },

    async reverse({ lat, lng }) {
      const params = common(new URLSearchParams({ lat: String(lat), lon: String(lng) }));
      await throttle();
      const { data } = await fetchJson(`${base}/reverse?${params}`);
      return data && !data.error ? toPlace(data) : null;
    },
  };
}
