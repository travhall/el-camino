/**
 * Unified Loading Manager - Simplified 
 */

import { loadingStates, type LoadingState } from './loadingStates';

interface UnifiedLoadingConfig {
  type: 'product' | 'article' | 'image' | 'button' | 'generic';
  variant?: 'default' | 'compact' | 'featured';
  staggered?: boolean;
  index?: number;
  networkAware?: boolean;
}

class UnifiedLoadingManager {
  private static instance: UnifiedLoadingManager;
  private networkInfo: any;
  
  static getInstance(): UnifiedLoadingManager {
    if (!this.instance) {
      this.instance = new UnifiedLoadingManager();
    }
    return this.instance;
  }

  constructor() {
    this.networkInfo = (navigator as any).connection;
  }

  showProductCardLoading(container: HTMLElement, config: UnifiedLoadingConfig = { type: 'product' }): string {
    const { variant = 'default', index = 0 } = config;
    const staggerDelay = index * 0.1;
    
    const imageClass = variant === 'compact' ? 'loading-image compact' : 
                       variant === 'featured' ? 'loading-image featured' : 'loading-image';
    
    container.innerHTML = `
      <div class="loading-container loading-product-card" 
           role="status" 
           aria-label="Loading product..."
           style="--loading-stagger-delay: ${staggerDelay}s">
        <div class="${imageClass} loading-skeleton"></div>
        <div class="loading-product-content">
          <div class="loading-skeleton loading-brand"></div>
          <div class="loading-skeleton loading-title"></div>
          <div class="loading-skeleton loading-title multi-line"></div>
          <div class="loading-skeleton loading-price"></div>
        </div>
        <span class="sr-only">Loading product information...</span>
      </div>
    `;
    
    return loadingStates.showProductImageLoading(container, 1);
  }

  showArticleCardLoading(container: HTMLElement, config: UnifiedLoadingConfig = { type: 'article' }): string {
    const { index = 0 } = config;
    const staggerDelay = index * 0.1;
    
    container.innerHTML = `
      <div class="loading-container loading-article-card" 
           role="status" 
           aria-label="Loading article..."
           style="--loading-stagger-delay: ${staggerDelay}s">
        <div class="loading-skeleton loading-image"></div>
        <div class="loading-article-content">
          <div class="loading-skeleton loading-badge"></div>
          <div class="loading-skeleton loading-title"></div>
          <div class="loading-skeleton loading-title multi-line"></div>
          <div class="loading-skeleton loading-text-line"></div>
          <div class="loading-skeleton loading-text-line"></div>
          <div class="loading-skeleton loading-text-line"></div>
          <div class="loading-article-tags">
            <div class="loading-skeleton loading-tag"></div>
            <div class="loading-skeleton loading-tag"></div>
            <div class="loading-skeleton loading-tag"></div>
          </div>
        </div>
        <span class="sr-only">Loading article information...</span>
      </div>
    `;
    
    return `article-loading-${Date.now()}`;
  }

  /**
   * Generic Loading
   */
  showGenericLoading(container: HTMLElement, elements: string[], config: UnifiedLoadingConfig = { type: 'generic' }): string {
    const { index = 0 } = config;
    const staggerDelay = index * 0.1;
    
    const skeletonElements = elements.map((elementType, idx) => 
      `<div class="loading-skeleton loading-${elementType}" style="animation-delay: ${(idx * 0.1) + staggerDelay}s"></div>`
    ).join('');
    
    container.innerHTML = `
      <div class="loading-container" 
           role="status" 
           aria-label="Loading content..."
           style="--loading-stagger-delay: ${staggerDelay}s">
        ${skeletonElements}
        <span class="sr-only">Loading content...</span>
      </div>
    `;
    
    return `generic-loading-${Date.now()}`;
  }

  // Legacy compatibility
  hideLoading(loaderId: string, immediate?: boolean): void {
    loadingStates.hideLoading(loaderId, immediate);
  }

  showSuccess(loaderId: string, message?: string): void {
    loadingStates.transitionToSuccess(loaderId, message);
  }

  showError(loaderId: string, message?: string): void {
    loadingStates.transitionToError(loaderId, message);
  }
}

// Export singleton instance
export const unifiedLoadingManager = UnifiedLoadingManager.getInstance();

// Simple convenience functions
export function showProductLoading(container: HTMLElement, config?: UnifiedLoadingConfig) {
  return unifiedLoadingManager.showProductCardLoading(container, config);
}

export function showArticleLoading(container: HTMLElement, config?: UnifiedLoadingConfig) {
  return unifiedLoadingManager.showArticleCardLoading(container, config);
}

export function showGenericLoading(container: HTMLElement, elements: string[], config?: UnifiedLoadingConfig) {
  return unifiedLoadingManager.showGenericLoading(container, elements, config);
}

export function hideLoading(loaderId: string, immediate?: boolean) {
  unifiedLoadingManager.hideLoading(loaderId, immediate);
}

export function showSuccess(loaderId: string, message?: string) {
  unifiedLoadingManager.showSuccess(loaderId, message);
}

export function showError(loaderId: string, message?: string) {
  unifiedLoadingManager.showError(loaderId, message);
}

export { UnifiedLoadingManager, type UnifiedLoadingConfig };