// Photon (https://photon.komoot.io) geocoder adapter. Photon supports
// search-as-you-type. The public instance is fair-use only with no SLA;
// self-host Photon or set PHOTON_URL for production.

const CATEGORY_MAP = {
  fuel: 'petrol_station',
  restaurant: 'restaurant',
  fast_food: 'restaurant',
  cafe: 'cafe',
  mall: 'shopping',
  supermarket: 'shopping',
  city: 'city',
  town: 'city',
  village: 'city',
  street: 'street',
};

function toPlace(feature) {
  const p = feature.properties || {};
  const [lng, lat] = feature.geometry?.coordinates || [];
  const streetLine = [p.street, p.housenumber].filter(Boolean).join(' ');
  const parts = [p.name, streetLine, p.city || p.county, p.state, p.country].filter(Boolean);
  const label = [...new Set(parts)].join(', ');
  return {
    id: `photon:${p.osm_type || 'X'}${p.osm_id ?? `${lat},${lng}`}`,
    name: p.name || streetLine || p.city || label,
    label,
    category: CATEGORY_MAP[p.osm_value] || CATEGORY_MAP[p.type] || p.osm_value || p.type || 'place',
    lat,
    lng,
  };
}

export function createPhotonGeocoder({ baseUrl, fetchJson }) {
  const base = baseUrl.replace(/\/$/, '');
  return {
    name: 'photon',
    supportsAutocomplete: true,

    async search({ query, near, limit = 6, lang }) {
      const params = new URLSearchParams({ q: query, limit: String(limit) });
      if (near) {
        params.set('lat', String(near.lat));
        params.set('lon', String(near.lng));
      }
      if (lang && ['en', 'de', 'fr'].includes(lang)) params.set('lang', lang);
      const { data } = await fetchJson(`${base}/api/?${params}`);
      return (data?.features || []).map(toPlace).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    },

    async reverse({ lat, lng }) {
      const params = new URLSearchParams({ lat: String(lat), lon: String(lng), limit: '1' });
      const { data } = await fetchJson(`${base}/reverse?${params}`);
      const feature = data?.features?.[0];
      return feature ? toPlace(feature) : null;
    },
  };
}
