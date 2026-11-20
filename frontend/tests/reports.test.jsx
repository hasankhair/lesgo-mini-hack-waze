import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ReportDialog from '../src/reports/ReportDialog.jsx';
import ReportPopup from '../src/reports/ReportPopup.jsx';
import { useReports } from '../src/reports/useReports.js';
import { REPORT_TYPES } from '../src/reports/reportTypes.js';

const future = () => new Date(Date.now() + 30 * 60_000).toISOString();
const makeReport = (overrides = {}) => ({
  id: 'r1',
  report_type: 'accident',
  description: 'Two cars, right lane',
  latitude: 52.5,
  longitude: 13.4,
  status: 'active',
  confirmation_count: 2,
  not_present_count: 0,
  reporter_username: 'alice',
  created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  expires_at: future(),
  is_mine: false,
  my_vote: null,
  ...overrides,
});

describe('report categories', () => {
  it('covers all nine categories required by the database', () => {
    expect(REPORT_TYPES.map((t) => t.value)).toEqual([
      'accident', 'traffic_jam', 'roadblock', 'police', 'construction', 'flood', 'hazard', 'breakdown', 'other',
    ]);
  });
});

describe('report submission', () => {
  const renderDialog = (props) =>
    render(
      <MemoryRouter>
        <ReportDialog onClose={vi.fn()} onSubmit={vi.fn()} mapCenter={{ lat: 1, lng: 2 }} {...props} />
      </MemoryRouter>,
    );

  it('asks anonymous users to sign in instead of showing the form', () => {
    renderDialog({ user: null });
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: /submit report/i })).not.toBeInTheDocument();
  });

  it('submits the chosen category, description and GPS coordinates', async () => {
    const onSubmit = vi.fn(async () => {});
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog({ user: { id: 'u1' }, userPosition: { lat: 52.52, lng: 13.405 }, onSubmit, onClose });

    await user.click(screen.getByRole('button', { name: /road construction/i }));
    await user.type(screen.getByLabelText(/details/i), '  Lane closed ');
    await user.click(screen.getByRole('button', { name: /submit report/i }));

    expect(onSubmit).toHaveBeenCalledWith({ report_type: 'construction', description: 'Lane closed', latitude: 52.52, longitude: 13.405 });
    expect(onClose).toHaveBeenCalled();
  });

  it('falls back to the map centre when GPS is unavailable', async () => {
    const onSubmit = vi.fn(async () => {});
    const user = userEvent.setup();
    renderDialog({ user: { id: 'u1' }, userPosition: null, onSubmit });
    expect(screen.getByRole('button', { name: /my location/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /flood/i }));
    await user.click(screen.getByRole('button', { name: /submit report/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ latitude: 1, longitude: 2 }));
  });

  it('requires a category', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderDialog({ user: { id: 'u1' }, onSubmit });
    await user.click(screen.getByRole('button', { name: /submit report/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/choose what you want to report/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows server errors such as rate limits', async () => {
    const user = userEvent.setup();
    renderDialog({ user: { id: 'u1' }, onSubmit: async () => Promise.reject(new Error('You are reporting too quickly.')) });
    await user.click(screen.getByRole('button', { name: /hazard/i }));
    await user.click(screen.getByRole('button', { name: /submit report/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You are reporting too quickly.');
  });
});

describe('report confirmation', () => {
  it('shows report details and lets drivers confirm or clear it', async () => {
    const onVote = vi.fn(async () => {});
    const user = userEvent.setup();
    render(<ReportPopup report={makeReport()} onVote={onVote} />);

    expect(screen.getByText('Accident')).toBeInTheDocument();
    expect(screen.getByText(/by alice/)).toBeInTheDocument();
    expect(screen.getByText('5 min ago')).toBeInTheDocument();
    expect(screen.getByText(/2 confirmed/)).toBeInTheDocument();
    expect(screen.getByText(/not verified/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /still there/i }));
    expect(onVote).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }), 'confirm');
    await user.click(screen.getByRole('button', { name: /not there/i }));
    expect(onVote).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'r1' }), 'not_present');
  });

  it('marks the user’s current vote', () => {
    render(<ReportPopup report={makeReport({ my_vote: 'confirm' })} onVote={vi.fn()} />);
    expect(screen.getByRole('button', { name: /still there/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers withdrawal instead of voting on the user’s own report', async () => {
    const onWithdraw = vi.fn(async () => {});
    const user = userEvent.setup();
    render(<ReportPopup report={makeReport({ is_mine: true })} onVote={vi.fn()} onWithdraw={onWithdraw} />);
    expect(screen.queryByRole('button', { name: /still there/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /withdraw/i }));
    expect(onWithdraw).toHaveBeenCalled();
  });
});

describe('real-time incident updates', () => {
  function fakeRealtimeClient() {
    const handlers = [];
    const channel = {
      on: vi.fn((_type, _filter, cb) => {
        handlers.push(cb);
        return channel;
      }),
      subscribe: vi.fn((cb) => {
        cb('SUBSCRIBED');
        return channel;
      }),
    };
    return {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
      emit: (payload) => handlers.forEach((h) => h(payload)),
    };
  }

  it('loads reports for the map area, then applies live inserts, updates and deletes', async () => {
    const client = fakeRealtimeClient();
    const service = { listReports: vi.fn(async () => [makeReport({ my_vote: 'confirm' })]) };
    const { result } = renderHook(() => useReports({ bbox: '13,52,14,53', client, userId: 'u1', service }));

    await waitFor(() => expect(result.current.reports).toHaveLength(1));
    expect(service.listReports).toHaveBeenCalledWith('13,52,14,53', expect.anything());
    expect(result.current.realtimeStatus).toBe('live');
    expect(client.channel).toHaveBeenCalled();

    // Another driver reports a new incident.
    act(() => client.emit({ eventType: 'INSERT', new: makeReport({ id: 'r2', report_type: 'flood' }) }));
    expect(result.current.reports.map((r) => r.id).sort()).toEqual(['r1', 'r2']);

    // Someone confirms r1: count updates, the user's own vote is preserved.
    const { is_mine: _m, my_vote: _v, ...rowWithoutUserFields } = makeReport({ confirmation_count: 3 });
    act(() => client.emit({ eventType: 'UPDATE', new: rowWithoutUserFields }));
    const r1 = result.current.reports.find((r) => r.id === 'r1');
    expect(r1.confirmation_count).toBe(3);
    expect(r1.my_vote).toBe('confirm');

    // Drivers say r2 is gone.
    act(() => client.emit({ eventType: 'UPDATE', new: makeReport({ id: 'r2', status: 'cleared' }) }));
    expect(result.current.reports.map((r) => r.id)).toEqual(['r1']);

    act(() => client.emit({ eventType: 'DELETE', old: { id: 'r1' } }));
    expect(result.current.reports).toHaveLength(0);
  });

  it('ignores reports that are already expired', async () => {
    const client = fakeRealtimeClient();
    const service = { listReports: vi.fn(async () => []) };
    const { result } = renderHook(() => useReports({ bbox: '1,1,2,2', client, service }));
    await waitFor(() => expect(service.listReports).toHaveBeenCalled());
    act(() => client.emit({ eventType: 'INSERT', new: makeReport({ id: 'old', expires_at: new Date(Date.now() - 1000).toISOString() }) }));
    expect(result.current.reports).toHaveLength(0);
  });

  it('removes reports locally when they expire', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const soon = new Date(Date.now() + 1000).toISOString();
      const service = { listReports: vi.fn(async () => [makeReport({ expires_at: soon })]) };
      const { result } = renderHook(() => useReports({ bbox: '1,1,2,2', client: null, service, pruneIntervalMs: 500 }));
      await waitFor(() => expect(result.current.reports).toHaveLength(1));
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      expect(result.current.reports).toHaveLength(0);
      expect(result.current.realtimeStatus).toBe('disabled');
    } finally {
      vi.useRealTimers();
    }
  });

  it('unsubscribes on unmount', () => {
    const client = fakeRealtimeClient();
    const { unmount } = renderHook(() => useReports({ bbox: null, client, service: { listReports: vi.fn() } }));
    unmount();
    expect(client.removeChannel).toHaveBeenCalled();
  });
});
