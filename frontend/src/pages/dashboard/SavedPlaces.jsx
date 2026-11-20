import { useCallback, useEffect, useState } from 'react';
import { Bookmark, Briefcase, House, LoaderCircle, Navigation, Plus, Star, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import SearchBar from '../../components/SearchBar.jsx';
import * as defaultService from '../../services/accountService.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { Card, EmptyState, ErrorState, IconTile, ListSkeleton } from './ui.jsx';

const ICONS = { home: House, work: Briefcase, favorite: Star };
const TONES = { home: 'brand', work: 'navy', favorite: 'amber' };
const LABELS = { home: 'Home', work: 'Work', favorite: 'Favourite' };
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
    <div className="space-y-6">
      <Card title="Add a place" description="Search for an address, then save it as Home, Work or a favourite." bodyClassName="p-5">
        <SearchBar onSelect={setPending} onClear={() => setPending(null)} selectedLabel={pending?.name ?? ''} placeholder="Search for an address or place" />
        {pending && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Save as" className="segmented">
              {['home', 'work', 'favorite'].map((c) => {
                const Icon = ICONS[c];
                return (
                  <button key={c} type="button" role="radio" aria-checked={category === c} aria-pressed={category === c} onClick={() => setCategory(c)} className="segment">
                    <Icon className="h-4 w-4" aria-hidden /> {LABELS[c]}
                  </button>
                );
              })}
            </div>
            <button type="button" className="btn-primary ml-auto" onClick={save} disabled={saving}>
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />} Save place
            </button>
          </div>
        )}
      </Card>

      <Card title="Your places" description="Tap the arrow to start navigating." bodyClassName="">
        {error && <ErrorState message={error} />}
        {places === null && !error && <ListSkeleton />}
        {places?.length === 0 && (
          <EmptyState icon={Bookmark} title="No saved places yet." text="Save Home, Work and places you visit often for one-tap navigation." />
        )}
        {sorted.length > 0 && (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {sorted.map((place) => {
              const Icon = ICONS[place.category] ?? Star;
              return (
                <li key={place.id} className="list-row">
                  <IconTile icon={Icon} tone={TONES[place.category] ?? 'brand'} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2">
                      <span className="truncate font-semibold text-navy-900 dark:text-white">{place.location_name}</span>
                      {place.category !== 'favorite' && place.location_name !== LABELS[place.category] && <span className="badge-neutral">{LABELS[place.category]}</span>}
                    </p>
                    {place.address && <p className="truncate text-[13px] text-slate-600 dark:text-slate-400">{place.address}</p>}
                  </div>
                  <Link
                    to={navigateHref({ name: place.location_name, label: place.address, lat: place.latitude, lng: place.longitude })}
                    className="btn-secondary btn-sm"
                    aria-label={`Navigate to ${place.location_name}`}
                  >
                    <Navigation className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden sm:inline">Go</span>
                  </Link>
                  <button
                    type="button"
                    className="icon-btn h-9 w-9 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                    onClick={() => remove(place)}
                    aria-label={`Delete ${place.location_name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
