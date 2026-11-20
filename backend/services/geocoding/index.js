import { createPhotonGeocoder } from './photon.js';
import { createNominatimGeocoder } from './nominatim.js';

// Geocoder adapter contract:
//   name: string
//   supportsAutocomplete: boolean
//   search({ query, near?: {lat,lng}, limit?, lang? }) -> Place[]
//   reverse({ lat, lng }) -> Place | null
// Place: { id, name, label, category, lat, lng }
export function createGeocoder(config, fetchJson) {
  switch (config.geocoding.provider) {
    case 'photon':
      return createPhotonGeocoder({ baseUrl: config.geocoding.photonUrl, fetchJson });
    case 'nominatim':
      return createNominatimGeocoder({
        baseUrl: config.geocoding.nominatimUrl,
        email: config.geocoding.nominatimEmail,
        fetchJson,
      });
    default:
      throw new Error(`Unknown GEOCODING_PROVIDER "${config.geocoding.provider}"`);
  }
}
