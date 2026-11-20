// Small in-memory TTL cache with LRU eviction. Reduces load on public
// geocoding/routing services. Replace with Redis when running several instances.
export function createCache({ maxEntries = 500, ttlMs = 5 * 60 * 1000 } = {}) {
  const store = new Map();

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expires < Date.now()) {
        store.delete(key);
        return undefined;
      }
      store.delete(key);
      store.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      store.delete(key);
      store.set(key, { value, expires: Date.now() + ttlMs });
      while (store.size > maxEntries) store.delete(store.keys().next().value);
    },
    get size() {
      return store.size;
    },
  };
}

export async function cached(cache, key, producer) {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = await producer();
  cache.set(key, value);
  return value;
}
