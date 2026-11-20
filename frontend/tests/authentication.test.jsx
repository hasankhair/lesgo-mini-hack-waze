import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import LoginPage, { safeRedirect } from '../src/authentication/LoginPage.jsx';
import RegisterPage, { validateRegistration } from '../src/authentication/RegisterPage.jsx';
import ForgotPasswordPage from '../src/authentication/ForgotPasswordPage.jsx';
import ProtectedRoute from '../src/authentication/ProtectedRoute.jsx';
import { createFakeSupabaseClient, renderWithProviders } from './helpers.jsx';

describe('registration', () => {
  it('validates input before contacting Supabase', () => {
    const base = { username: 'driver1', email: 'a@b.co', password: 'longenough', confirm: 'longenough' };
    expect(validateRegistration(base)).toBeNull();
    expect(validateRegistration({ ...base, username: 'a' })).toMatch(/Username/);
    expect(validateRegistration({ ...base, email: 'nope' })).toMatch(/email/);
    expect(validateRegistration({ ...base, password: 'short', confirm: 'short' })).toMatch(/8 characters/);
    expect(validateRegistration({ ...base, confirm: 'different' })).toMatch(/do not match/);
  });

  it('signs up with the username as metadata and asks the user to confirm their email', async () => {
    const user = userEvent.setup();
    const { client } = renderWithProviders(<RegisterPage />);
    await user.type(screen.getByLabelText(/^Username/), 'roadrunner');
    await user.type(screen.getByLabelText('Email'), 'rr@example.com');
    await user.type(screen.getByLabelText('Password'), 'supersecret');
    await user.type(screen.getByLabelText('Confirm password'), 'supersecret');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'rr@example.com',
      password: 'supersecret',
      options: expect.objectContaining({ data: { username: 'roadrunner' } }),
    });
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });

  it('shows a readable error when the email is taken', async () => {
    const client = createFakeSupabaseClient();
    client.auth.signUp.mockResolvedValueOnce({ data: {}, error: new Error('User already registered') });
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { client });
    await user.type(screen.getByLabelText(/^Username/), 'roadrunner');
    await user.type(screen.getByLabelText('Email'), 'rr@example.com');
    await user.type(screen.getByLabelText('Password'), 'supersecret');
    await user.type(screen.getByLabelText('Confirm password'), 'supersecret');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists.');
  });
});

describe('login', () => {
  it('signs in and returns to the page the user came from', async () => {
    const user = userEvent.setup();
    const { client } = renderWithProviders(<LoginPage />, {
      route: '/login',
      path: '/login',
      extraRoutes: <Route path="/" element={<p>map page</p>} />,
    });
    await user.type(screen.getByLabelText('Email'), 'a@b.co');
    await user.type(screen.getByLabelText('Password'), 'pw123456');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.co', password: 'pw123456' });
    expect(await screen.findByText('map page')).toBeInTheDocument();
  });

  it('explains invalid credentials', async () => {
    const client = createFakeSupabaseClient();
    client.auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: new Error('Invalid login credentials') });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { client });
    await user.type(screen.getByLabelText('Email'), 'a@b.co');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
  });

  it('only redirects to in-app paths', () => {
    expect(safeRedirect('/dashboard')).toBe('/dashboard');
    expect(safeRedirect('//evil.example')).toBe('/');
    expect(safeRedirect('https://evil.example')).toBe('/');
    expect(safeRedirect(undefined)).toBe('/');
  });
});

describe('password reset', () => {
  it('sends a reset email that links back to /reset-password', async () => {
    const user = userEvent.setup();
    const { client } = renderWithProviders(<ForgotPasswordPage />);
    await user.type(screen.getByLabelText('Email'), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.co', {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    expect(await screen.findByRole('status')).toHaveTextContent(/reset link is on its way/);
  });
});

describe('protected pages', () => {
  const routes = <Route path="/login" element={<p>login page</p>} />;

  it('redirects signed-out users to the login page', async () => {
    renderWithProviders(
      <ProtectedRoute>
        <p>secret dashboard</p>
      </ProtectedRoute>,
      { route: '/dashboard', path: '/dashboard', extraRoutes: routes },
    );
    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('secret dashboard')).not.toBeInTheDocument();
  });

  it('renders the page for signed-in users', async () => {
    const client = createFakeSupabaseClient({ session: { access_token: 't', user: { id: 'u1', email: 'a@b.co' } } });
    renderWithProviders(
      <ProtectedRoute>
        <p>secret dashboard</p>
      </ProtectedRoute>,
      { client, route: '/dashboard', path: '/dashboard', extraRoutes: routes },
    );
    await waitFor(() => expect(screen.getByText('secret dashboard')).toBeInTheDocument());
  });

  it('treats a missing Supabase configuration as signed out', async () => {
    renderWithProviders(
      <ProtectedRoute>
        <p>secret dashboard</p>
      </ProtectedRoute>,
      { client: null, route: '/dashboard', path: '/dashboard', extraRoutes: routes },
    );
    expect(await screen.findByText('login page')).toBeInTheDocument();
  });
});
