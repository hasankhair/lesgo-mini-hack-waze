import { useEffect, useState } from 'react';
import { getCapabilities } from '../services/mapsService.js';

const FALLBACK = {
  geocoding: { provider: 'unknown', supportsAutocomplete: true },
  routing: { provider: 'unknown', trafficAware: false, supportsAvoidTolls: false, shortestIsApproximate: true },
  traffic: { provider: 'none', available: false },
  community: { available: null }, // unknown until the API answers
};

// Which features the configured backend providers support.
export function useCapabilities() {
  const [capabilities, setCapabilities] = useState(FALLBACK);
  useEffect(() => {
    let active = true;
    getCapabilities()
      .then((c) => active && setCapabilities(c))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return capabilities;
}
