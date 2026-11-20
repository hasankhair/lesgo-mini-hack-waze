import { Fragment, memo } from 'react';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { DEFAULT_CENTER, DEFAULT_ZOOM, TILE_PROVIDERS, TRAFFIC_FLOW } from './tileProviders.js';
import { incidentIcon, placeIcon, reportIcon, userLocationIcon } from './markerIcons.js';
import ReportPopup from '../reports/ReportPopup.jsx';
import IncidentPopup from '../reports/IncidentPopup.jsx';

function MapEvents({ onViewChange, onUserPan, onContextMenu }) {
  const map = useMapEvents({
    moveend: () => onViewChange?.(map.getBounds(), map.getZoom()),
    dragstart: () => onUserPan?.(),
    contextmenu: (e) => onContextMenu?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
}

const RouteLines = memo(function RouteLines({ routes, selectedId, onSelect, traveled }) {
  const sorted = [...routes].sort((a, b) => (a.id === selectedId ? 1 : b.id === selectedId ? -1 : 0));
  return sorted.map((route) => {
    const selected = route.id === selectedId;
    return (
      <Fragment key={route.id}>
        <Polyline
          positions={route.geometry}
          pathOptions={{ color: selected ? '#1e3a8a' : '#64748b', weight: selected ? 10 : 8, opacity: selected ? 0.9 : 0.5, lineCap: 'round' }}
          eventHandlers={{ click: () => onSelect?.(route.id) }}
        />
        <Polyline
          positions={route.geometry}
          pathOptions={{ color: selected ? '#3b82f6' : '#cbd5e1', weight: selected ? 6 : 5, opacity: 1, lineCap: 'round' }}
          eventHandlers={{ click: () => onSelect?.(route.id) }}
        />
        {selected && traveled?.length > 1 && (
          <Polyline positions={traveled} pathOptions={{ color: '#94a3b8', weight: 6, opacity: 0.9, lineCap: 'round' }} interactive={false} />
        )}
      </Fragment>
    );
  });
});

function MapView({
  onMapReady,
  userPosition,
  destination,
  origin,
  routes = [],
  selectedRouteId,
  onSelectRoute,
  traveled,
  reports = [],
  incidents = [],
  showTrafficFlow = false,
  onVote,
  onWithdraw,
  onViewChange,
  onUserPan,
  onContextMenu,
}) {
  const { resolved } = useTheme();
  const tiles = TILE_PROVIDERS[resolved] ?? TILE_PROVIDERS.light;

  return (
    <MapContainer
      ref={onMapReady}
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      zoomControl={false}
      worldCopyJump
      className="h-full w-full"
      aria-label="Interactive map"
    >
      <TileLayer key={resolved} url={tiles.url} attribution={tiles.attribution} maxZoom={tiles.maxZoom} subdomains={tiles.subdomains ?? 'abc'} className={tiles.className} />
      {showTrafficFlow && TRAFFIC_FLOW && (
        <TileLayer
          key={`flow-${resolved}`}
          url={resolved === 'dark' ? TRAFFIC_FLOW.dark : TRAFFIC_FLOW.light}
          attribution={TRAFFIC_FLOW.attribution}
          maxZoom={TRAFFIC_FLOW.maxZoom}
          opacity={0.9}
          zIndex={2}
        />
      )}
      <MapEvents onViewChange={onViewChange} onUserPan={onUserPan} onContextMenu={onContextMenu} />

      <RouteLines routes={routes} selectedId={selectedRouteId} onSelect={onSelectRoute} traveled={traveled} />

      {incidents.map((incident) => (
        <Marker
          key={incident.id}
          position={[incident.latitude, incident.longitude]}
          icon={incidentIcon(incident.category)}
          title={`Official: ${incident.label}`}
        >
          <Popup autoPanPaddingTopLeft={[16, 196]} autoPanPaddingBottomRight={[16, 108]}>
            <IncidentPopup incident={incident} />
          </Popup>
        </Marker>
      ))}

      {reports.map((report) => (
        <Marker
          key={report.id}
          position={[report.latitude, report.longitude]}
          icon={reportIcon(report.report_type, { confirmed: report.confirmation_count > 0 })}
          title={report.report_type}
        >
          <Popup autoPanPaddingTopLeft={[16, 196]} autoPanPaddingBottomRight={[16, 108]}>
            <ReportPopup report={report} onVote={onVote} onWithdraw={onWithdraw} />
          </Popup>
        </Marker>
      ))}

      {origin && <Marker position={[origin.lat, origin.lng]} icon={placeIcon('origin')} title="Start" />}
      {destination && <Marker position={[destination.lat, destination.lng]} icon={placeIcon('destination')} title={destination.name} />}

      {userPosition && (
        <>
          {userPosition.accuracy > 30 && (
            <Circle
              center={[userPosition.lat, userPosition.lng]}
              radius={userPosition.accuracy}
              pathOptions={{ color: '#3b82f6', weight: 1, fillOpacity: 0.08 }}
              interactive={false}
            />
          )}
          <Marker
            position={[userPosition.lat, userPosition.lng]}
            icon={userLocationIcon(userPosition.heading)}
            zIndexOffset={1000}
            interactive={false}
            keyboard={false}
          />
        </>
      )}
    </MapContainer>
  );
}

export default memo(MapView);
