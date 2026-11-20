import L from 'leaflet';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { REPORT_TYPES, getReportType } from '../reports/reportTypes.js';

// Leaflet divIcons rendered from Lucide icons. Cached per variant.
const cache = new Map();

// Renders a Lucide icon to an SVG string with the React DOM client the app
// already loads (react-dom/server would add ~500 KB to the bundle). This must
// not run while React is rendering, so all report glyphs are rendered once,
// when this module is first imported.
function renderSvg(Icon, size = 16) {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(createElement(Icon, { size, color: 'white', strokeWidth: 2.5, 'aria-hidden': true })));
  const html = host.innerHTML;
  root.unmount();
  return html;
}

const GLYPHS = new Map(REPORT_TYPES.map((t) => [t.icon, renderSvg(t.icon)]));
const svg = (Icon) => GLYPHS.get(Icon) ?? '';

export function reportIcon(type, { confirmed = false } = {}) {
  const key = `report:${type}:${confirmed}`;
  if (!cache.has(key)) {
    const { color, icon, label } = getReportType(type);
    cache.set(
      key,
      L.divIcon({
        className: 'rp-icon',
        iconSize: [36, 44],
        iconAnchor: [18, 42],
        popupAnchor: [0, -38],
        html: `
          <div role="img" aria-label="${label}" style="position:relative;width:36px;height:44px">
            <svg width="36" height="44" viewBox="0 0 36 44" style="position:absolute;inset:0;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
              <path d="M18 1C8.6 1 1 8.4 1 17.5 1 29.4 18 43 18 43s17-13.6 17-25.5C35 8.4 27.4 1 18 1z" fill="${color}" stroke="white" stroke-width="2"/>
            </svg>
            <div style="position:absolute;top:9px;left:10px;width:16px;height:16px">${svg(icon)}</div>
            ${confirmed ? '<span style="position:absolute;top:-2px;right:-2px;width:12px;height:12px;border-radius:9999px;background:#10b981;border:2px solid white"></span>' : ''}
          </div>`,
      }),
    );
  }
  return cache.get(key);
}

export function userLocationIcon(heading) {
  const hasHeading = Number.isFinite(heading);
  const key = `user:${hasHeading ? Math.round(heading / 10) * 10 : 'none'}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      L.divIcon({
        className: 'rp-icon',
        iconSize: [48, 48],
        iconAnchor: [24, 24],
        html: `
          <div aria-label="Your location" style="position:relative;width:48px;height:48px">
            <span class="animate-pulse-ring" style="position:absolute;inset:12px;border-radius:9999px;background:rgba(37,99,235,.35)"></span>
            ${
              hasHeading
                ? `<svg width="48" height="48" viewBox="0 0 48 48" style="position:absolute;inset:0;transform:rotate(${heading}deg)">
                     <path d="M24 2 L32 18 L16 18 Z" fill="rgba(37,99,235,.55)"/>
                   </svg>`
                : ''
            }
            <span style="position:absolute;inset:15px;border-radius:9999px;background:#2563eb;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>
          </div>`,
      }),
    );
  }
  return cache.get(key);
}

export function placeIcon(kind = 'destination') {
  const key = `place:${kind}`;
  if (!cache.has(key)) {
    const fill = kind === 'origin' ? '#10b981' : '#0f172a';
    cache.set(
      key,
      L.divIcon({
        className: 'rp-icon',
        iconSize: [34, 42],
        iconAnchor: [17, 40],
        html: `
          <svg width="34" height="42" viewBox="0 0 34 42" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))" aria-label="${kind}">
            <path d="M17 1C8.2 1 1 8 1 16.6 1 28 17 41 17 41s16-13 16-24.4C33 8 25.8 1 17 1z" fill="${fill}" stroke="white" stroke-width="2"/>
            <circle cx="17" cy="16.5" r="6" fill="white"/>
          </svg>`,
      }),
    );
  }
  return cache.get(key);
}
