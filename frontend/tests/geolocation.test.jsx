import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGeolocation } from '../src/hooks/useGeolocation.js';

const fix = (overrides = {}) => ({
  coords: { latitude: 52.52, longitude: 13.405, accuracy: 8, speed: 13.9, heading: 90, ...overrides },
  timestamp: 1700000000000,
});

function fakeGeolocation() {
  const watchers = new Map();
  let nextId = 1;
  return {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn((success, error) => {
      const id = nextId++;
      watchers.set(id, { success, error });
      return id;
    }),
    clearWatch: vi.fn((id) => watchers.delete(id)),
    emit: (pos) => watchers.forEach((w) => w.success(pos)),
    fail: (code) => watchers.forEach((w) => w.error({ code })),
    watchers,
  };
}

describe('useGeolocation', () => {
  it('does not request location until asked', () => {
    const geo = fakeGeolocation();
    const { result } = renderHook(() => useGeolocation({ geolocation: geo, autoLocateIfGranted: false }));
    expect(result.current.status).toBe('idle');
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    expect(geo.watchPosition).not.toHaveBeenCalled();
  });

  it('requests location on mount when asked to', () => {
    const geo = fakeGeolocation();
    geo.getCurrentPosition.mockImplementation((success) => success(fix()));
    const { result } = renderHook(() => useGeolocation({ geolocation: geo, locateOnMount: true }));
    expect(geo.getCurrentPosition).toHaveBeenCalled();
    expect(result.current.position).toMatchObject({ lat: 52.52, lng: 13.405 });
    expect(geo.watchPosition).not.toHaveBeenCalled(); // a single fix, not tracking
  });

  it('reports denial from the on-mount request', () => {
    const geo = fakeGeolocation();
    geo.getCurrentPosition.mockImplementation((_s, error) => error({ code: 1 }));
    const { result } = renderHook(() => useGeolocation({ geolocation: geo, locateOnMount: true }));
    expect(result.current.status).toBe('denied');
  });

  it('detects the current location with speed and heading', () => {
    const geo = fakeGeolocation();
    geo.getCurrentPosition.mockImplementation((success) => success(fix()));
    const { result } = renderHook(() => useGeolocation({ geolocation: geo, autoLocateIfGranted: false }));
    act(() => result.current.locate());
    expect(result.current.status).toBe('active');
    expect(result.current.position).toMatchObject({ lat: 52.52, lng: 13.405, accuracy: 8, speed: 13.9, heading: 90 });
  });

  it('reports permission denial with a helpful message', () => {
    const geo = fakeGeolocation();
    geo.getCurrentPosition.mockImplementation((_s, error) => error({ code: 1 }));
    const { result } = renderHook(() => useGeolocation({ geolocation: geo, autoLocateIfGranted: false }));
    act(() => result.current.locate());
    expect(result.current.status).toBe('denied');
    expect(result.current.error).toMatch(/permission was denied/i);
  });

  it('distinguishes unavailable GPS from timeouts', () => {
    const geo = fakeGeolocation();
    const { result } = renderHook(() => useGeolocation({ geolocation: geo, autoLocateIfGranted: false }));
    geo.getCurrentPosition.mockImplementationOnce((_s, error) => error({ code: 2 }));
    act(() => result.current.locate());
    expect(result.current.status).toBe('unavailable');
    geo.getCurrentPosition.mockImplementationOnce((_s, error) => error({ code: 3 }));
    act(() => result.current.locate());
    expect(result.current.status).toBe('timeout');
  });

  it('handles browsers without geolocation', () => {
    const { result } = renderHook(() => useGeolocation({ geolocation: null, autoLocateIfGranted: false }));
    expect(result.current.status).toBe('unsupported');
  });

  it('tracks movement while active and stops when asked', () => {
    const geo = fakeGeolocation();
    const { result } = renderHook(() => useGeolocation({ geolocation: geo, autoLocateIfGranted: false }));
    act(() => result.current.startTracking());
    expect(result.current.tracking).toBe(true);

    act(() => geo.emit(fix()));
    act(() => geo.emit(fix({ latitude: 52.53, speed: null })));
    expect(result.current.position.lat).toBe(52.53);
    expect(result.current.position.speed).toBeNull();

    act(() => result.current.stopTracking());
    expect(result.current.tracking).toBe(false);
    expect(geo.clearWatch).toHaveBeenCalledWith(1);
    expect(geo.watchers.size).toBe(0);
  });

  it('clears the watch when the component unmounts', () => {
    const geo = fakeGeolocation();
    const { result, unmount } = renderHook(() => useGeolocation({ geolocation: geo, autoLocateIfGranted: false }));
    act(() => result.current.startTracking());
    unmount();
    expect(geo.clearWatch).toHaveBeenCalled();
  });

  it('forgets the position when location is turned off', () => {
    const geo = fakeGeolocation();
    geo.getCurrentPosition.mockImplementation((success) => success(fix()));
    const { result } = renderHook(() => useGeolocation({ geolocation: geo, autoLocateIfGranted: false }));
    act(() => result.current.locate());
    act(() => result.current.clear());
    expect(result.current.position).toBeNull();
    expect(result.current.status).toBe('idle');
  });
});
