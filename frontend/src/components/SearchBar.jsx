import { useEffect, useId, useRef, useState } from 'react';
import { Briefcase, Building2, Clock, Fuel, House, LoaderCircle, MapPin, Search, ShoppingBag, Star, Utensils, X } from 'lucide-react';
import { searchPlaces } from '../services/mapsService.js';
import { useDebounce } from '../hooks/useDebounce.js';

const CATEGORY_ICONS = {
  petrol_station: Fuel,
  restaurant: Utensils,
  cafe: Utensils,
  shopping: ShoppingBag,
  city: Building2,
  home: House,
  work: Briefcase,
  favorite: Star,
  recent: Clock,
};

const iconFor = (category) => CATEGORY_ICONS[category] || MapPin;

// Destination search with suggestions. `quickPicks` (saved places, recent
// destinations) show when the field is focused and empty.
export default function SearchBar({
  onSelect,
  onClear,
  near,
  selectedLabel = '',
  quickPicks = [],
  autocomplete = true,
  search = searchPlaces,
  placeholder = 'Search places, streets, petrol stations…',
  autoFocus = false,
}) {
  const [query, setQuery] = useState(selectedLabel);
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [submitted, setSubmitted] = useState('');
  const debounced = useDebounce(query, 350);
  const listId = useId();
  const inputRef = useRef(null);
  // The label of the place last chosen; typing it again should not re-search.
  const chosen = useRef(selectedLabel);
  const nearRef = useRef(near);
  nearRef.current = near;

  useEffect(() => {
    chosen.current = selectedLabel;
    setQuery(selectedLabel);
  }, [selectedLabel]);

  const term = autocomplete ? debounced.trim() : submitted.trim();

  useEffect(() => {
    if (term.length < 2 || term === chosen.current.trim()) {
      setResults([]);
      setStatus('idle');
      return undefined;
    }
    const controller = new AbortController();
    setStatus('loading');
    search(term, { near: nearRef.current ?? undefined, signal: controller.signal })
      .then((list) => {
        setResults(list);
        setStatus('done');
        setError(null);
        setActive(list.length ? 0 : -1);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setResults([]);
        setStatus('error');
        setError(err.message || 'Search failed.');
      });
    return () => controller.abort();
  }, [term, search]);

  const showQuick = open && query.trim() === '' && quickPicks.length > 0;
  const items = showQuick ? quickPicks : results;
  const showList = open && (showQuick || status !== 'idle');

  const choose = (place) => {
    chosen.current = place.name;
    setQuery(place.name);
    setOpen(false);
    setResults([]);
    setStatus('idle');
    inputRef.current?.blur();
    onSelect?.(place);
  };

  const clear = () => {
    chosen.current = '';
    setQuery('');
    setSubmitted('');
    setResults([]);
    setStatus('idle');
    setError(null);
    onClear?.();
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && items[active]) choose(items[active]);
      else if (!autocomplete) {
        setSubmitted(query);
        setOpen(true);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative w-full">
      <div className="panel flex h-12 items-center gap-2 rounded-full px-4">
        <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && items[active] ? `${listId}-${active}` : undefined}
          aria-label="Search for a destination"
          autoFocus={autoFocus}
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
        />
        {status === 'loading' && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-label="Searching" />}
        {query && (
          <button type="button" onClick={clear} className="icon-btn -mr-2 h-8 w-8" aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showList && (
        <div className="panel absolute inset-x-0 top-14 z-[1100] max-h-[60vh] overflow-y-auto py-2">
          {showQuick && <p className="px-4 pb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">Your places</p>}
          <ul id={listId} role="listbox" aria-label="Search suggestions">
            {items.map((place, i) => {
              const Icon = iconFor(place.category);
              return (
                <li
                  key={place.id ?? `${place.lat},${place.lng},${i}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(place)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 ${i === active ? 'bg-slate-100 dark:bg-white/10' : ''}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{place.name}</span>
                    {place.label && place.label !== place.name && (
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{place.label}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {!showQuick && status === 'done' && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
              No places found for “{term}”. Check the spelling or try a nearby city name.
            </p>
          )}
          {!showQuick && status === 'error' && (
            <p role="alert" className="px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {!showQuick && status === 'loading' && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-slate-500">Searching…</p>
          )}
        </div>
      )}
      {!autocomplete && open && query.trim().length >= 2 && status === 'idle' && (
        <p className="panel absolute inset-x-0 top-14 z-[1100] px-4 py-3 text-sm text-slate-500">Press Enter to search</p>
      )}
    </div>
  );
}
