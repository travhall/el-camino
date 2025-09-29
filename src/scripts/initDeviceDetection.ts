/**
 * Phase 1 Device Detection Initializer
 * This script should be included in the main layout to enable device-aware loading
 */

import { initializeConditionalLoading } from '@/lib/conditionalLoader';
import { getDeviceInfo } from '@/utils/device';

// Store device info globally for quick access
if (typeof window !== 'undefined') {
  (window as any).__DEVICE_INFO__ = getDeviceInfo();
  
  // Log device info for debugging
  console.debug('[El Camino] Device Info:', (window as any).__DEVICE_INFO__);
  
  // Initialize conditional feature loading
  initializeConditionalLoading();
  
  // Add device class to body for CSS targeting
  const deviceInfo = getDeviceInfo();
  if (deviceInfo.isMobile) {
    document.body.classList.add('device-mobile');
  } else if (deviceInfo.isTablet) {
    document.body.classList.add('device-tablet');
  } else {
    document.body.classList.add('device-desktop');
  }
  
  // Listen for resize events to update device info
  let resizeTimeout: NodeJS.Timeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const newDeviceInfo = getDeviceInfo();
      (window as any).__DEVICE_INFO__ = newDeviceInfo;
      
      // Update body classes
      document.body.classList.remove('device-mobile', 'device-tablet', 'device-desktop');
      if (newDeviceInfo.isMobile) {
        document.body.classList.add('device-mobile');
      } else if (newDeviceInfo.isTablet) {
        document.body.classList.add('device-tablet');
      } else {
        document.body.classList.add('device-desktop');
      }
    }, 150); // Debounce resize events
  });
}
