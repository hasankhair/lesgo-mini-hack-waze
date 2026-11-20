# Lesgo

Lesgo is a navigation app with community traffic reporting. It has an interactive OpenStreetMap map, GPS location, destination search, route planning with turn-by-turn guidance, and incident reports from drivers that update live through Supabase Realtime.

Lesgo does **not** use live traffic data by default. Routes use typical road speeds, and incident markers are unverified community reports. The UI labels both.

## Contents

- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Supabase setup](#supabase-setup)
- [Features](#features)
- [Providers and their limits](#providers-and-their-limits)
- [Security and privacy](#security-and-privacy)
- [Testing](#testing)
- [API reference](#api-reference)
- [Production checklist](#production-checklist)

## Architecture

```text
lesgo/
├── frontend/                 React 19 + Vite + Tailwind CSS 4 + React Leaflet
│   ├── src/
│   │   ├── authentication/   Login, register, password reset, ProtectedRoute
│   │   ├── components/       Search bar, controls, panels, dialogs
│   │   ├── contexts/         Auth, theme (light/dark/system), toasts
│   │   ├── hooks/            useGeolocation, useCapabilities, useDebounce, useNow
│   │   ├── maps/             MapView, marker icons, tile provider config
│   │   ├── navigation/       Route panel, turn-by-turn HUD, navigation engine
│   │   ├── pages/            Map page, dashboard (profile, places, history, reports, settings)
│   │   ├── reports/          Report dialog/popup, categories, useReports (realtime)
│   │   ├── services/         API client, Supabase client, realtime subscription
│   │   └── utils/            Geometry and formatting helpers
│   └── tests/
├── backend/                  Node.js + Express 5
│   ├── config/               Environment configuration
│   ├── controllers/          Maps, reports, account
│   ├── middleware/           Auth, validation (zod), rate limits, errors
│   ├── routes/               /api router
│   ├── services/
│   │   ├── geocoding/        Photon and Nominatim adapters
│   │   ├── routing/          OSRM and openrouteservice adapters, ranking, instructions
│   │   └── traffic/          Traffic data adapter (none by default)
│   ├── validation/           Request schemas
│   └── tests/
├── supabase/
│   ├── migrations/           Schema, RLS policies, triggers, grants, realtime
│   └── tests/                Migration + RLS tests on in-process Postgres (PGlite)
└── .env.example
```

**How requests flow**

- The browser uses Supabase directly for **authentication** and the **Realtime** subscription to `traffic_reports`.
- All other data goes through the **Express API**. The API proxies geocoding and routing, which adds caching, rate limiting and a stable response format across providers. It also reads and writes Supabase data.
- The API never holds elevated credentials. It verifies each request's Supabase JWT, then queries Supabase **as that user** (anon key plus the user's token), so Row Level Security applies to every query. No service-role key is used anywhere.
- Rules that matter for integrity (who can write what, report rate limits, duplicate detection, one vote per user, expiry, counts) are enforced **in the database**. Someone calling Supabase directly with the public anon key cannot get around them.

**Provider adapters.** Geocoding (`backend/services/geocoding`), routing (`backend/services/routing`), traffic (`backend/services/traffic`) and map tiles (`frontend/src/maps/tileProviders.js`) each sit behind a small interface and are chosen with environment variables. `GET /api/capabilities` tells the UI what the active providers support. For example, the "Avoid tolls" option is disabled when the router can't avoid tolls, and search falls back to search-on-Enter when the geocoder forbids autocomplete.

## Quick start

Requirements: Node.js 20 or newer (developed on Node 26) and npm.

```bash
npm install
cp .env.example .env      # then fill in the Supabase values (see below)
npm run dev               # API on :4000, web app on http://localhost:5173
```

Without Supabase values, you can still use the map, search, routing and navigation. Accounts and community reports show as unavailable.

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | API (watch mode) and Vite dev server together |
| `npm run build` | Production build of the frontend into `frontend/dist` |
| `npm start` | Start the API |
| `npm test` | All tests: backend, frontend and database |

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migration. Either:
   - with the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`, or
   - paste `supabase/migrations/20250101000000_initial_schema.sql` into the SQL editor and run it.
3. Copy **Project URL** and the **anon public** key into `.env` (both the plain and the `VITE_` variables).
4. In **Authentication → URL Configuration**, set the Site URL (e.g. `http://localhost:5173`) and add `http://localhost:5173/reset-password` to the redirect URLs, so password-reset links work.
5. Optional: enable `pg_cron` and schedule `select public.expire_stale_reports()` every few minutes to mark expired rows. Queries already hide expired reports, so this only tidies up stored statuses.

The migration adds `traffic_reports` to the `supabase_realtime` publication. That is all Realtime needs.

### Database

| Table | Purpose | Notable rules |
| --- | --- | --- |
| `profiles` | Username, email, avatar, `save_history` | Created by trigger on sign-up; each user can read/update only their own row |
| `traffic_reports` | Community incidents | 9 categories (check constraint); server sets status, counts, `created_at`, `expires_at`; `user_id` is not readable by clients |
| `report_confirmations` | "Still there" / "Not there" votes | `unique (report_id, user_id)`; no votes on your own or inactive reports |
| `saved_locations` | Home, Work, favourites | Private; at most one Home and one Work per user (partial unique index) |
| `navigation_history` | Started trips | Private; origin stored at ~110 m precision; skipped when `save_history` is off |

**Report lifecycle.** A report starts `active`. Its lifetime depends on the category: 45 min for a traffic jam, up to 12 h for construction. Each "still there" confirmation extends it, up to 3× the base lifetime. It becomes `cleared` when at least 3 drivers say it's gone and they outnumber the confirmations. The reporter can withdraw it (`removed`). Expired and inactive reports never show as current: the API filters them out, the client prunes them on a timer, and RLS hides rows more than an hour past expiry.

## Features

- **Map**: full-screen Leaflet map, custom location marker with heading and accuracy circle, zoom/pan, report markers with a distinct colour and icon per category, route lines with clickable alternatives. Right-click or long-press the map to navigate to that point.
- **GPS**: when the map opens it asks for the user's location (the browser shows its permission prompt the first time) and starts there. If permission is denied or no fix arrives, it stays on the default city (Kuala Lumpur, set with `VITE_DEFAULT_LAT`/`VITE_DEFAULT_LNG`) and says how to retry. Opening a destination link or moving the map first cancels the jump. Shows coordinates, accuracy and speed (Info panel). Handles denied permission, unavailable GPS, timeouts and unsupported browsers. Continuous tracking runs only during navigation and stops when it ends. *Stop using location* also discards the position.
- **Search**: suggestions as you type (debounced, keyboard accessible), biased to your location, with category icons for petrol stations, restaurants, shops and cities. Saved places and recent destinations appear when the field is empty. Shows clear messages for no results or errors.
- **Routing**: recommended route plus alternatives, with distance, duration and arrival time. Preferences are Fastest, Shortest and Avoid tolls (when supported). Warnings explain each limitation.
- **Turn-by-turn**: next instruction and the distance to it, the following instruction, remaining distance and time, ETA and speed. Detects when you leave the route (allowing for GPS accuracy) and recalculates. Detects arrival.
- **Voice guidance**: spoken instructions at about 1 km, 250 m and at the turn, plus "route recalculated" and arrival messages. Uses the browser's built-in speech; the mute choice is remembered.
- **Incident ahead alerts**: while navigating, community reports within 40 m of the route and up to 2 km ahead show in a banner with a countdown, and are announced once at 1 km.
- **Screen stays on** during navigation (Screen Wake Lock API, where supported), and is released when navigation ends.
- **Installable**: a web app manifest and icons let users add Lesgo to their home screen and open it full-screen.
- **Community reports**: 9 categories, optional description, at your GPS position or the map centre. Other drivers can confirm a report or mark it gone. Each report shows its reporter's username, age, confirmations and expiry. New reports, count changes and removals appear for everyone instantly via Realtime.
- **Accounts**: registration (with email confirmation if enabled in Supabase), login, logout, password reset, change password. You can browse the map signed out. Reporting and voting require an account.
- **Dashboard** (`/dashboard`): profile and username, saved places (add via search, set Home/Work, navigate, delete), recent destinations (navigate, delete, clear), your report history with statuses, and settings (theme, history on/off, password).
- **Design**: light, dark and system themes; responsive layout with bottom sheets on mobile and side panels on desktop; floating controls (My location, Report, Route, Info).

## Providers and their limits

The defaults are free public services meant for **development and light use**. Each one has a usage policy you must follow.

| Concern | Default | Limits | Production options |
| --- | --- | --- | --- |
| Map tiles | `tile.openstreetmap.org` | [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/): no heavy use, attribution required, no SLA | MapTiler, Stadia Maps, Thunderforest, or self-hosted tiles via `VITE_TILE_*` |
| Dark tiles | Same OSM tiles, inverted with a CSS filter | Same as above | Any dark style via `VITE_TILE_DARK_URL` |
| Geocoding | Photon (`photon.komoot.io`) | Fair use, no SLA, may be rate limited | Self-hosted Photon (`PHOTON_URL`), or your own Nominatim |
| Geocoding (alt.) | Nominatim | [Policy](https://operations.osmfoundation.org/policies/nominatim/): max 1 req/s, **no autocomplete**. The adapter throttles requests and the UI switches to search-on-Enter | Self-hosted Nominatim (`NOMINATIM_URL`) |
| Routing | OSRM demo (`router.project-osrm.org`) | Demo only, no SLA. Driving profile only. **No live traffic**. No toll avoidance (`exclude=toll` is rejected). "Shortest" is the shortest of up to 3 candidate routes | Self-hosted OSRM (`OSRM_URL`, `OSRM_SUPPORTS_EXCLUDE=true`), or openrouteservice (`ROUTING_PROVIDER=openrouteservice`, `ORS_API_KEY`) for true shortest routes and toll avoidance |
| Live traffic | None | Not connected. The UI says so | Implement the adapter in `backend/services/traffic/index.js` (e.g. TomTom or HERE traffic flow) |

The API caches geocoding results for 10 minutes and routes for 2 minutes, and coarsens the search-bias location to about 1 km before forwarding it.

## Security and privacy

- **Credentials**: only the public anon key appears anywhere. The backend uses the caller's JWT, so there is no service-role key to leak. `.env` is git-ignored.
- **RLS on every table**, with explicit column-level grants that replace Supabase's broad defaults. Clients can't change counts, status (except withdrawing their own report) or timestamps. Clients also can't read which account filed a report, because `user_id` isn't granted. The schema and RLS behaviour are tested.
- **Input validation**: every API input passes through a zod schema, and the database also enforces constraints. Text is length-limited, control characters are stripped, and the UI renders text without HTML. Report bounding boxes are capped in size.
- **Rate limiting**: per-IP limits for the API overall, geocoding and routing. Per-user limits for reports and votes. The database also caps reports at 10 per 10 minutes per user and rejects duplicates within about 100 m.
- **Other measures**: Helmet security headers, a CORS allow-list, a 20 kB JSON body limit, error responses that never leak internals, and login redirects restricted to in-app paths.
- **Location**: read only through the browser's permission prompt. The map requests a single position on load; continuous tracking runs only during navigation. It is only sent to the server to plan a route, submit a report, or save history (origin rounded to ~110 m, and only if history is enabled). Users can delete history or turn it off, and can stop location access at any time.

## Testing

```bash
npm test                 # everything
npm run test -w backend  # API: supertest + mocked providers and Supabase
npm run test -w frontend # UI: Vitest + Testing Library (jsdom)
npm run test:db          # Runs the real migration in PGlite and checks RLS/triggers
```

None of the tests need network access, Docker or a Supabase project.

| Requirement | Where it's tested |
| --- | --- |
| Registration and login | `frontend/tests/authentication.test.jsx`; profile-on-signup trigger in `supabase/tests/rls.test.js` |
| Current location detection | `frontend/tests/geolocation.test.jsx` (success, speed, denied, unavailable, timeout, unsupported, tracking start/stop) |
| Destination search | `frontend/tests/search.test.jsx`; `backend/tests/maps.test.js` (Photon/Nominatim adapters, validation, caching) |
| Route calculation | `backend/tests/maps.test.js` (OSRM/ORS mapping, ranking, honesty warnings, no-route); `frontend/tests/navigation.test.js` (progress, off-route, arrival) |
| Traffic report submission | `backend/tests/reports.test.js`; `frontend/tests/reports.test.jsx`; DB rules in `supabase/tests/rls.test.js` |
| Report confirmation | Same three files: one vote per user, vote switching, own-report and inactive-report rejection, auto-clearing |
| Real-time incident updates | `frontend/tests/reports.test.jsx` (insert/update/delete events, expiry pruning, unsubscribe) |
| Saved locations | `frontend/tests/savedLocations.test.jsx`; `backend/tests/account.test.js`; privacy and Home/Work uniqueness in `supabase/tests/rls.test.js` |
| Authentication protection | `backend/tests/auth.test.js` (401 on every protected route, user-scoped DB client); `ProtectedRoute` tests in the frontend |

**Not covered by automated tests:** a live Supabase Realtime connection, and real browser geolocation and map rendering. Check these manually against a Supabase project. For example, open two browser windows signed in as different users, submit a report in one, and confirm it in the other.

## API reference

All endpoints are under `/api`. Errors have the shape `{ "error": { "code", "message", "details?" } }`.

| Method & path | Auth | Description |
| --- | --- | --- |
| `GET /health` | – | Liveness |
| `GET /capabilities` | – | Active providers and what they support |
| `GET /geocode/search?q=&lat=&lng=&limit=` | – | Place search |
| `GET /geocode/reverse?lat=&lng=` | – | Reverse geocode |
| `POST /routes` `{origin, destination, preference, avoidTolls}` | – | Routes, warnings and applied preferences |
| `GET /traffic?bbox=` | – | Live traffic flow (empty with the `none` provider) |
| `GET /reports?bbox=minLng,minLat,maxLng,maxLat` | optional | Active reports; includes `is_mine` and `my_vote` when signed in |
| `POST /reports` `{report_type, description, latitude, longitude}` | ✔ | Submit a report |
| `POST /reports/:id/votes` `{type: confirm\|not_present}` | ✔ | Confirm or mark gone |
| `DELETE /reports/:id` | ✔ | Withdraw your own report |
| `GET /reports/mine` | ✔ | Your report history |
| `GET/PATCH /profile` | ✔ | Profile and settings |
| `GET/POST /saved-locations`, `PATCH/DELETE /saved-locations/:id` | ✔ | Saved places |
| `GET/POST/DELETE /history`, `DELETE /history/:id` | ✔ | Navigation history |

## Production checklist

- Replace the public tile, geocoding and routing services with commercial or self-hosted ones, and set `UPSTREAM_USER_AGENT` with real contact details.
- Serve `frontend/dist` from a CDN or static host. Set `VITE_API_URL` and `CORS_ORIGINS` to match.
- Set `TRUST_PROXY` behind a load balancer. If you run several API instances, move rate limiting and caching to Redis.
- Enable email confirmation and set the auth redirect URLs in Supabase. Consider CAPTCHA protection on sign-up.
- Schedule `expire_stale_reports()` with `pg_cron`. For large report volumes, consider PostGIS and a spatial index.
- Add a Content-Security-Policy for the static site that allows your tile, API and Supabase origins.
