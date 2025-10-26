// src/lib/navigation/init.ts - Simplified NavigationManager initialization
import { navigationManager, type NavigationManager } from "./NavigationManager";

// Make NavigationManager available globally (simplified interface)
declare global {
  interface Window {
    navigationManager: NavigationManager | null;
  }
}

// Initialize on page load
if (typeof window !== "undefined") {
  window.navigationManager = navigationManager;

  if (import.meta.env.DEV) {
    // console.log('[NavigationManager] Simplified global instance initialized');
  }
}

export { navigationManager };
