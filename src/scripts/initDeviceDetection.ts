/**
 * Phase 1 Device Detection Initializer
 * Adds device-type classes to <body> for CSS targeting and stores
 * device info on window for quick access elsewhere.
 */

import { getDeviceInfo } from '@/utils/device';

if (typeof window !== 'undefined') {
  const deviceInfo = getDeviceInfo();
  (window as any).__DEVICE_INFO__ = deviceInfo;

  // Add device class to body for CSS targeting
  if (deviceInfo.isMobile) {
    document.body.classList.add('device-mobile');
  } else if (deviceInfo.isTablet) {
    document.body.classList.add('device-tablet');
  } else {
    document.body.classList.add('device-desktop');
  }

  // Debounced resize handler — keep device classes in sync
  let resizeTimeout: ReturnType<typeof setTimeout>;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const updated = getDeviceInfo();
      (window as any).__DEVICE_INFO__ = updated;
      document.body.classList.remove('device-mobile', 'device-tablet', 'device-desktop');
      if (updated.isMobile) {
        document.body.classList.add('device-mobile');
      } else if (updated.isTablet) {
        document.body.classList.add('device-tablet');
      } else {
        document.body.classList.add('device-desktop');
      }
    }, 150);
  });
}
