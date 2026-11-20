import { useState } from 'react';
import { Briefcase, House, LoaderCircle, Star } from 'lucide-react';
import Sheet from './Sheet.jsx';

const CATEGORIES = [
  { value: 'home', label: 'Home', icon: House },
  { value: 'work', label: 'Work', icon: Briefcase },
  { value: 'favorite', label: 'Favourite', icon: Star },
];

export default function SavePlaceDialog({ place, onSave, onClose }) {
  const [category, setCategory] = useState('favorite');
  const [name, setName] = useState(place.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const finalName = category === 'favorite' ? name.trim() : category === 'home' ? 'Home' : 'Work';
    if (!finalName) {
      setError('Give this place a name.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ location_name: finalName, category, address: place.label || undefined, latitude: place.lat, longitude: place.lng });
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Sheet title="Save place" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="mb-3 truncate text-sm text-slate-500">{place.label || place.name}</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Place type">
          {CATEGORIES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={category === value}
              onClick={() => setCategory(value)}
              className={`btn flex-col py-3 ${category === value ? 'bg-brand-600 text-white' : 'btn-secondary'}`}
            >
              <Icon className="h-5 w-5" aria-hidden /> {label}
            </button>
          ))}
        </div>
        {category === 'favorite' && (
          <div className="mt-4">
            <label htmlFor="place-name" className="label">
              Name
            </label>
            <input id="place-name" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        {category !== 'favorite' && <p className="mt-3 text-xs text-slate-500">This replaces your current {category} location, if any.</p>}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary mt-5 w-full" disabled={saving}>
          {saving && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Save
        </button>
      </form>
    </Sheet>
  );
}
