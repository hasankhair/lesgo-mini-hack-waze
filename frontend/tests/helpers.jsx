import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from '../src/contexts/AuthContext.jsx';
import { ThemeProvider } from '../src/contexts/ThemeContext.jsx';
import { ToastProvider } from '../src/contexts/ToastContext.jsx';

// A stand-in for the Supabase client's auth API.
export function createFakeSupabaseClient({ session = null } = {}) {
  let listener = () => {};
  const auth = {
    getSession: vi.fn(async () => ({ data: { session } })),
    onAuthStateChange: vi.fn((cb) => {
      listener = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signUp: vi.fn(async () => ({ data: { session: null, user: { id: 'u1' } }, error: null })),
    signInWithPassword: vi.fn(async () => {
      session = { access_token: 't', user: { id: 'u1', email: 'a@b.co' } };
      listener('SIGNED_IN', session);
      return { data: { session }, error: null };
    }),
    signOut: vi.fn(async () => {
      session = null;
      listener('SIGNED_OUT', null);
      return { error: null };
    }),
    resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
    updateUser: vi.fn(async () => ({ data: {}, error: null })),
  };
  return { auth, channel: vi.fn(), removeChannel: vi.fn() };
}

export function renderWithProviders(ui, { client = createFakeSupabaseClient(), route = '/', path = '*', extraRoutes = null } = {}) {
  const result = render(
    <MemoryRouter initialEntries={[route]}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider client={client}>
            <Routes>
              <Route path={path} element={ui} />
              {extraRoutes}
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
  return { ...result, client };
}
