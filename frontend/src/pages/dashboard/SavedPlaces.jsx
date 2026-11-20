import { useCallback, useEffect, useState } from 'react';
import { Briefcase, House, LoaderCircle, Navigation, Star, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import SearchBar from '../../components/SearchBar.jsx';
import * as defaultService from '../../services/accountService.js';
import { useToast } from '../../contexts/ToastContext.jsx';

const ICONS = { home: House, work: Briefcase, favorite: Star };
const ORDER = { home: 0, work: 1, favorite: 2 };

export const navigateHref = ({ name, lat, lng, label }) => {
  const p = new URLSearchParams({ dest: `${lat},${lng}`, name });
  if (label) p.set('label', label);
  return `/?${p}`;
};

export default function SavedPlaces({ service = defaultService }) {
  const { notify } = useToast();
  const [places, setPlaces] = useState(null);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null);
  const [category, setCategory] = useState('favorite');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setPlaces(await service.listSavedLocations());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [service]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      await service.createSavedLocation({
        location_name: category === 'home' ? 'Home' : category === 'work' ? 'Work' : pending.name,
        category,
        address: pending.label || undefined,
        latitude: pending.lat,
        longitude: pending.lng,
      });
      notify('Place saved.', 'success');
      setPending(null);
      await load();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (place) => {
    try {
      await service.deleteSavedLocation(place.id);
      setPlaces((list) => list.filter((p) => p.id !== place.id));
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const sorted = places ? [...places].sort((a, b) => ORDER[a.category] - ORDER[b.category]) : [];

  return (
    <section aria-labelledby="saved-heading">
      <h2 id="saved-heading" className="text-lg font-semibold">
        Saved places
      </h2>
      <p className="text-sm text-slate-500">Home, Work and favourite destinations for one-tap navigation.</p>

      <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
        <p className="label">Add a place</p>
        <SearchBar onSelect={setPending} onClear={() => setPending(null)} selectedLabel={pending?.name ?? ''} placeholder="Search for an address or place" />
        {pending && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {['home', 'work', 'favorite'].map((c) => {
              const Icon = ICONS[c];
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={`btn py-1.5 capitalize ${category === c ? 'bg-brand-600 text-white' : 'btn-secondary'}`}
                >
                  <Icon className="h-4 w-4" aria-hidden /> {c === 'favorite' ? 'Favourite' : c}
                </button>
              );
            })}
            <button type="button" className="btn-primary ml-auto py-1.5" onClick={save} disabled={saving}>
              {saving && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Save place
            </button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}
      {places === null && !error && <p className="mt-4 text-sm text-slate-500">Loading…</p>}
      {places?.length === 0 && <p className="mt-4 text-sm text-slate-500">No saved places yet.</p>}

      <ul className="mt-4 divide-y divide-slate-100 dark:divide-white/5">
        {sorted.map((place) => {
          const Icon = ICONS[place.category] ?? Star;
          return (
            <li key={place.id} className="flex items-center gap-3 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{place.location_name}</p>
                {place.address && <p className="truncate text-xs text-slate-500">{place.address}</p>}
              </div>
              <Link
                to={navigateHref({ name: place.location_name, label: place.address, lat: place.latitude, lng: place.longitude })}
                className="icon-btn h-9 w-9"
                aria-label={`Navigate to ${place.location_name}`}
              >
                <Navigation className="h-4 w-4" />
              </Link>
              <button type="button" className="icon-btn h-9 w-9 text-red-600" onClick={() => remove(place)} aria-label={`Delete ${place.location_name}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
