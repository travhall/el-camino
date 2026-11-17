/**
 * Tests for initDeviceDetection (plan 225). The module acts on import: it
 * tags <body> with a device class and keeps it in sync on (debounced) resize.
 * `getDeviceInfo` is mocked so each test picks the device; the resize
 * listener it adds to window is removed afterwards so tests don't stack.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DeviceInfo } from '@/utils/device';

const getDeviceInfo = vi.hoisted(() => vi.fn());
vi.mock('@/utils/device', () => ({ getDeviceInfo }));

const info = (kind: 'mobile' | 'tablet' | 'desktop'): DeviceInfo => ({
  isMobile: kind === 'mobile',
  isTablet: kind === 'tablet',
  isDesktop: kind === 'desktop',
  hasTouch: kind !== 'desktop',
  screenWidth: 1000,
  isSlowConnection: false,
  connectionType: 'unknown',
});

const DEVICE_CLASSES = ['device-mobile', 'device-tablet', 'device-desktop'];
const classes = () =>
  DEVICE_CLASSES.filter((c) => document.body.classList.contains(c));

let added: [string, EventListenerOrEventListenerObject][] = [];

async function load(kind: 'mobile' | 'tablet' | 'desktop') {
  getDeviceInfo.mockReturnValue(info(kind));
  vi.resetModules();
  await import('../initDeviceDetection');
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.className = '';
  delete (window as { __DEVICE_INFO__?: DeviceInfo }).__DEVICE_INFO__;
  added = [];
  const original = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation(((
    type: string,
    fn: EventListenerOrEventListenerObject,
    opts?: boolean | AddEventListenerOptions
  ) => {
    added.push([type, fn]);
    return original(type, fn, opts);
  }) as typeof window.addEventListener);
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const [type, fn] of added) window.removeEventListener(type, fn);
  vi.useRealTimers();
});

describe('initDeviceDetection', () => {
  it.each([
    ['mobile', 'device-mobile'],
    ['tablet', 'device-tablet'],
    ['desktop', 'device-desktop'],
  ] as const)('tags the body for a %s', async (kind, cls) => {
    await load(kind);

    expect(classes()).toEqual([cls]);
  });

  it('stores the detected info on window', async () => {
    await load('tablet');

    expect(window.__DEVICE_INFO__).toEqual(info('tablet'));
  });

  it('prefers mobile when a device reports both mobile and tablet', async () => {
    getDeviceInfo.mockReturnValue({ ...info('mobile'), isTablet: true });
    vi.resetModules();
    await import('../initDeviceDetection');

    expect(classes()).toEqual(['device-mobile']);
  });

  it('re-detects after resize, replacing the class and the stored info', async () => {
    await load('desktop');

    getDeviceInfo.mockReturnValue(info('mobile'));
    window.dispatchEvent(new Event('resize'));
    // Debounced: nothing yet
    expect(classes()).toEqual(['device-desktop']);

    vi.advanceTimersByTime(150);
    expect(classes()).toEqual(['device-mobile']);
    expect(window.__DEVICE_INFO__).toEqual(info('mobile'));
  });

  it('debounces a burst of resize events into one re-detection', async () => {
    await load('desktop');
    getDeviceInfo.mockClear();

    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(100);
    }
    expect(getDeviceInfo).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(getDeviceInfo).toHaveBeenCalledTimes(1);
  });

  it('moves between all three classes on successive resizes', async () => {
    await load('mobile');

    for (const [kind, cls] of [
      ['tablet', 'device-tablet'],
      ['desktop', 'device-desktop'],
      ['mobile', 'device-mobile'],
    ] as const) {
      getDeviceInfo.mockReturnValue(info(kind));
      window.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(150);
      expect(classes()).toEqual([cls]);
    }
  });
});
