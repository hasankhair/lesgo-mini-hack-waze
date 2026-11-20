import { createClient } from '@supabase/supabase-js';

// Creates Supabase clients that only ever use the public anon key.
// - anon():          for public reads (RLS applies as the "anon" role)
// - forUser(token):  forwards the caller's JWT, so RLS applies as that user
// - verifyToken():   validates a JWT with Supabase Auth and returns the user
export function createSupabaseFactory({ url, anonKey }) {
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const anonClient = createClient(url, anonKey, options);

  return {
    anon: () => anonClient,
    forUser: (token) =>
      createClient(url, anonKey, {
        ...options,
        global: { headers: { Authorization: `Bearer ${token}` } },
      }),
    async verifyToken(token) {
      const { data, error } = await anonClient.auth.getUser(token);
      if (error || !data?.user) return null;
      return data.user;
    },
  };
}
