/**
 * Conditional Component Loader
 * Provides utilities for loading components based on device capabilities
 */

import { featureRegistry } from '@/lib/featureRegistry';
import { getDeviceInfo } from '@/utils/device';

export interface ConditionalLoadOptions {
  fallback?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
}

/**
 * Load a feature conditionally based on device type
 * Automatically handles fallback and error scenarios
 */
export async function loadFeatureConditionally<T = any>(
  featureName: string,
  options: ConditionalLoadOptions = {}
): Promise<T | null> {
  const { fallback, onError, timeout = 5000 } = options;

  try {
    // Check if feature should load on this device
    if (!featureRegistry.shouldLoad(featureName)) {
      console.debug(`Feature '${featureName}' not loaded - device mismatch`);
      fallback?.();
      return null;
    }

    // Load with timeout
    const module = await Promise.race([
      featureRegistry.load<T>(featureName),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Load timeout')), timeout)
      ),
    ]);

    return module;
  } catch (error) {
    console.error(`Failed to load feature '${featureName}':`, error);
    onError?.(error as Error);
    fallback?.();
    return null;
  }
}

/**
 * Initialize conditional loading on page load
 * Preloads critical features based on device type
 */
export function initializeConditionalLoading(): void {
  if (typeof window === 'undefined') return;

  const deviceInfo = getDeviceInfo();
  
  console.debug('Device info:', deviceInfo);
  console.debug('Registered features:', featureRegistry.getRegisteredFeatures());

  // Preload desktop features if on desktop AND not on slow connection
  if (deviceInfo.isDesktop && !deviceInfo.isSlowConnection) {
    const desktopFeatures = ['cartButton', 'productCard', 'viewTransitions'];
    desktopFeatures.forEach(feature => {
      featureRegistry.load(feature).catch(err => {
        console.warn(`Failed to preload ${feature}:`, err);
      });
    });
  } else if (deviceInfo.isDesktop && deviceInfo.isSlowConnection) {
    console.debug('Skipping desktop feature preload due to slow connection');
  }
}

// Auto-initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeConditionalLoading);
  } else {
    initializeConditionalLoading();
  }
}
