/**
 * Device Detection Utilities
 * Provides SSR-safe device detection for conditional component loading
 */

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  hasTouch: boolean;
  screenWidth: number;
  isSlowConnection: boolean;
  connectionType: string;
}

/**
 * Detect device type from User-Agent (SSR-safe)
 * Used during server-side rendering to determine initial device type
 */
export function detectDeviceFromUA(userAgent: string): Omit<DeviceInfo, 'screenWidth'> {
  const ua = userAgent.toLowerCase();
  
  // Mobile detection patterns
  const mobilePatterns = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i;
  const tabletPatterns = /ipad|android(?!.*mobile)|tablet|kindle|silk/i;
  
  const isMobile = mobilePatterns.test(ua) && !tabletPatterns.test(ua);
  const isTablet = tabletPatterns.test(ua);
  const isDesktop = !isMobile && !isTablet;
  
  // Touch detection (heuristic for SSR)
  const hasTouch = /touch|mobile|tablet/i.test(ua);
  
  // Connection info not available during SSR - defaults
  return {
    isMobile,
    isTablet,
    isDesktop,
    hasTouch,
    isSlowConnection: false,
    connectionType: 'unknown'
  };
}

/**
 * Get device info from browser context (client-side only)
 * Provides accurate device information using browser APIs
 */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    throw new Error('getDeviceInfo can only be called in browser context');
  }
  
  const width = window.innerWidth;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Breakpoints matching Tailwind defaults
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;
  
  // Detect slow connections (from mobileOptimization.ts)
  const connection = (navigator as any).connection;
  const isSlowConnection = connection
    ? connection.effectiveType === "slow-2g" ||
      connection.effectiveType === "2g" ||
      connection.saveData
    : false;
  
  return {
    isMobile,
    isTablet,
    isDesktop,
    hasTouch,
    screenWidth: width,
    isSlowConnection,
    connectionType: connection?.effectiveType || 'unknown'
  };
}

/**
 * Responsive breakpoint detection
 * Returns current breakpoint name for conditional logic
 */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export function getCurrentBreakpoint(): Breakpoint {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
  
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

/**
 * Check if device should load desktop-only features
 */
export function shouldLoadDesktopFeatures(): boolean {
  return getCurrentBreakpoint() === 'desktop';
}

/**
 * Check if device should load mobile-only features
 */
export function shouldLoadMobileFeatures(): boolean {
  return getCurrentBreakpoint() === 'mobile';
}
