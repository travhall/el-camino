// src/lib/navigation/init.ts - NavigationManager global initialization
import { navigationManager, type NavigationManager } from './NavigationManager';

// Make NavigationManager available globally for inline scripts
declare global {
  interface Window {
    navigationManager: NavigationManager | null;
  }
}

// Initialize on page load
if (typeof window !== 'undefined') {
  window.navigationManager = navigationManager;
  
  if (import.meta.env.DEV) {
    console.log('[NavigationManager] Global instance initialized');
  }
}

export { navigationManager };
