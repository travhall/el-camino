/**
 * Feature Registry for Device-Aware Code Splitting
 * Manages conditional loading of features based on device capabilities
 */

export interface Feature {
  name: string;
  desktopOnly?: boolean;
  mobileOnly?: boolean;
  loadCondition?: () => boolean;
  chunk?: string;
}

interface LoadedFeature {
  module: any;
  loadedAt: number;
}

class FeatureRegistry {
  private features: Map<string, Feature> = new Map();
  private loadedModules: Map<string, LoadedFeature> = new Map();
  private loadingPromises: Map<string, Promise<any>> = new Map();

  /**
   * Register a feature with its loading conditions
   */
  register(feature: Feature): void {
    this.features.set(feature.name, feature);
  }

  /**
   * Check if a feature should be loaded on current device
   */
  shouldLoad(featureName: string): boolean {
    const feature = this.features.get(featureName);
    if (!feature) {
      console.warn(`Feature '${featureName}' not registered`);
      return false;
    }

    // Custom load condition takes precedence
    if (feature.loadCondition) {
      return feature.loadCondition();
    }

    // Check device-specific flags
    if (typeof window === 'undefined') {
      // SSR context - load desktop features by default
      return !feature.mobileOnly;
    }

    const width = window.innerWidth;
    const isDesktop = width >= 1024;
    const isMobile = width < 768;

    if (feature.desktopOnly && !isDesktop) return false;
    if (feature.mobileOnly && !isMobile) return false;

    return true;
  }

  /**
   * Dynamically load a feature if it should be loaded
   * Returns cached module if already loaded
   */
  async load<T = any>(featureName: string): Promise<T | null> {
    if (!this.shouldLoad(featureName)) {
      console.debug(`Feature '${featureName}' skipped on this device`);
      return null;
    }

    // Return cached module if already loaded
    const cached = this.loadedModules.get(featureName);
    if (cached) {
      return cached.module as T;
    }

    // Return existing loading promise if in progress
    const existingPromise = this.loadingPromises.get(featureName);
    if (existingPromise) {
      return existingPromise;
    }

    // Start new load
    const feature = this.features.get(featureName);
    if (!feature?.chunk) {
      console.error(`Feature '${featureName}' has no chunk path`);
      return null;
    }

    const loadPromise = this.loadModule<T>(featureName, feature.chunk);
    this.loadingPromises.set(featureName, loadPromise);

    try {
      const module = await loadPromise;
      this.loadedModules.set(featureName, {
        module,
        loadedAt: Date.now()
      });
      return module;
    } finally {
      this.loadingPromises.delete(featureName);
    }
  }

  /**
   * Internal module loader with error handling
   */
  private async loadModule<T>(featureName: string, chunkPath: string): Promise<T> {
    try {
      const module = await import(/* @vite-ignore */ chunkPath);
      console.debug(`Feature '${featureName}' loaded successfully`);
      return module as T;
    } catch (error) {
      console.error(`Failed to load feature '${featureName}':`, error);
      throw error;
    }
  }

  /**
   * Check if a feature is currently loaded
   */
  isLoaded(featureName: string): boolean {
    return this.loadedModules.has(featureName);
  }

  /**
   * Get all registered features
   */
  getRegisteredFeatures(): string[] {
    return Array.from(this.features.keys());
  }
}

// Export singleton instance
export const featureRegistry = new FeatureRegistry();

// Register desktop-only features
featureRegistry.register({
  name: 'quickView',
  desktopOnly: true,
  chunk: '/src/components/QuickView.astro'
});

featureRegistry.register({
  name: 'miniCart',
  desktopOnly: true,
  chunk: '/src/components/MiniCart.astro'
});

featureRegistry.register({
  name: 'cartButton',
  desktopOnly: true,
  chunk: '/src/components/CartButton.astro'
});

// Mobile fallback for cart button only
featureRegistry.register({
  name: 'cartButtonMobile',
  mobileOnly: true,
  chunk: '/src/components/CartButtonMobile.astro'
});
