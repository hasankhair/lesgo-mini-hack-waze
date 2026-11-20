import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase as defaultClient } from '../services/supabaseClient.js';
import { setAccessTokenProvider } from '../services/api.js';

const AuthContext = createContext(null);

const NOT_CONFIGURED = 'Accounts are unavailable because Supabase is not configured.';

export function AuthProvider({ children, client = defaultClient }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(client));
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!client) return undefined;
    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((event, next) => {
      setSession(next ?? null);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  useEffect(() => {
    setAccessTokenProvider(async () => {
      if (!client) return null;
      const { data } = await client.auth.getSession();
      return data.session?.access_token ?? null;
    });
  }, [client]);

  const requireClient = useCallback(() => {
    if (!client) throw new Error(NOT_CONFIGURED);
    return client;
  }, [client]);

  const signUp = useCallback(
    async ({ email, password, username }) => {
      const { data, error } = await requireClient().auth.signUp({
        email,
        password,
        options: { data: { username }, emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      return { needsConfirmation: !data.session };
    },
    [requireClient],
  );

  const signIn = useCallback(
    async ({ email, password }) => {
      const { error } = await requireClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    [requireClient],
  );

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
  }, [client]);

  const sendPasswordReset = useCallback(
    async (email) => {
      const { error } = await requireClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    },
    [requireClient],
  );

  const updatePassword = useCallback(
    async (password) => {
      const { error } = await requireClient().auth.updateUser({ password });
      if (error) throw error;
      setRecovering(false);
    },
    [requireClient],
  );

  const value = useMemo(
    () => ({
      client,
      isConfigured: Boolean(client),
      session,
      user: session?.user ?? null,
      loading,
      recovering,
      signUp,
      signIn,
      signOut,
      sendPasswordReset,
      updatePassword,
    }),
    [client, session, loading, recovering, signUp, signIn, signOut, sendPasswordReset, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
