// Helpers for official traffic incidents (TomTom).

// Ordinary slow traffic is already visible as road colours on the flow layer,
// so only major jams get their own marker and alert. Closures, accidents,
// roadworks and hazards always do.
export const isNotable = (incident) => incident.category !== 'traffic_jam' || incident.severity === 'major';

// Jams of any size are left to the road colours on the map; closures,
// roadworks, accidents and hazards get a marker.
export const isMapMarker = (incident) => incident.category !== 'traffic_jam';

// Shapes an incident like a community report, so navigation alerts can treat
// both the same way. `official` marks where it came from.
export const incidentAsReport = (incident) => ({
  id: `official:${incident.id}`,
  report_type: incident.category,
  label: incident.label,
  latitude: incident.latitude,
  longitude: incident.longitude,
  confirmation_count: 0,
  official: true,
});
