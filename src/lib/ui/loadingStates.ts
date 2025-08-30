/**
 * Loading States Manager - Phase 2 UX Enhancement
 * Enhanced loading states with skeleton screens and perceived performance optimization
 */

export interface LoadingState {
  type: 'skeleton' | 'spinner' | 'progress' | 'shimmer';
  duration?: number;
  fadeOut?: boolean;
  customContent?: string;
}

export interface SkeletonConfig {
  width: string;
  height: string;
  borderRadius?: string;
  animationDuration?: number;
  pulse?: boolean;
}

class LoadingStateManager {
  private activeLoaders = new Map<string, LoadingController>();
  private globalConfig: LoadingState = {
    type: 'skeleton',
    duration: 2000,
    fadeOut: true
  };

  constructor() {
    this.injectGlobalStyles();
  }

  // Product-specific loading states
  showProductImageLoading(container: HTMLElement, count: number = 1): string {
    const loaderId = `product-images-${Date.now()}`;
    
    const skeletonHTML = Array(count).fill(0).map(() => `
      <div class="skeleton-image-container">
        <div class="skeleton skeleton-image"></div>
        <div class="skeleton-overlay">
          <div class="skeleton skeleton-badge"></div>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="loading-state" data-loader-id="${loaderId}">
        <div class="product-image-gallery-skeleton">
          ${skeletonHTML}
        </div>
      </div>
    `;

    this.activeLoaders.set(loaderId, new LoadingController(container, 'skeleton'));
    return loaderId;
  }

  showProductDetailsLoading(container: HTMLElement): string {
    const loaderId = `product-details-${Date.now()}`;
    
    container.innerHTML = `
      <div class="loading-state" data-loader-id="${loaderId}">
        <div class="product-details-skeleton">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-price"></div>
          <div class="skeleton skeleton-description"></div>
          <div class="skeleton skeleton-rating"></div>
          
          <div class="skeleton-variations">
            <div class="skeleton skeleton-variation-label"></div>
            <div class="skeleton-variation-options">
              <div class="skeleton skeleton-variation-option"></div>
              <div class="skeleton skeleton-variation-option"></div>
              <div class="skeleton skeleton-variation-option"></div>
              <div class="skeleton skeleton-variation-option"></div>
            </div>
          </div>
          
          <div class="skeleton-actions">
            <div class="skeleton skeleton-quantity-selector"></div>
            <div class="skeleton skeleton-add-to-cart"></div>
          </div>
        </div>
      </div>
    `;

    this.activeLoaders.set(loaderId, new LoadingController(container, 'skeleton'));
    return loaderId;
  }

  showCartUpdateLoading(button: HTMLElement): string {
    const loaderId = `cart-update-${Date.now()}`;
    const originalContent = button.innerHTML;
    
    (button as HTMLButtonElement).disabled = true;
    button.innerHTML = `
      <div class="loading-state inline" data-loader-id="${loaderId}">
        <div class="spinner-container">
          <div class="spinner"></div>
          <span class="loading-text">Adding...</span>
        </div>
      </div>
    `;

    const controller = new LoadingController(button, 'spinner');
    controller.setOriginalContent(originalContent);
    this.activeLoaders.set(loaderId, controller);
    
    return loaderId;
  }

  showInventoryCheckLoading(element: HTMLElement): string {
    const loaderId = `inventory-${Date.now()}`;
    
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.setAttribute('data-loader-id', loaderId);
    loadingOverlay.innerHTML = `
      <div class="inventory-loading">
        <div class="shimmer-container">
          <div class="shimmer"></div>
        </div>
        <span class="loading-text">Checking availability...</span>
      </div>
    `;

    element.style.position = 'relative';
    element.appendChild(loadingOverlay);

    this.activeLoaders.set(loaderId, new LoadingController(loadingOverlay, 'shimmer'));
    return loaderId;
  }

  // Success/Error state transitions
  transitionToSuccess(loaderId: string, message: string = 'Success!', duration: number = 1000) {
    const controller = this.activeLoaders.get(loaderId);
    if (!controller) return;

    controller.transitionToState('success', message, duration);
    
    setTimeout(() => {
      this.hideLoading(loaderId);
    }, duration);
  }

  transitionToError(loaderId: string, message: string = 'Error occurred', showRetry: boolean = true) {
    const controller = this.activeLoaders.get(loaderId);
    if (!controller) return;

    controller.transitionToState('error', message, 0, showRetry);
  }

  hideLoading(loaderId: string, immediate: boolean = false) {
    const controller = this.activeLoaders.get(loaderId);
    if (!controller) return;

    if (immediate) {
      controller.remove();
    } else {
      controller.fadeOut(() => {
        controller.remove();
      });
    }

    this.activeLoaders.delete(loaderId);
  }

  hideAllLoading() {
    this.activeLoaders.forEach((controller, loaderId) => {
      this.hideLoading(loaderId, true);
    });
  }

  // Smart loading based on connection speed
  getOptimalLoadingType(): LoadingState['type'] {
    const connection = (navigator as any).connection;
    
    if (connection) {
      const slowConnection = connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g';
      if (slowConnection) {
        return 'spinner'; // Lighter weight for slow connections
      }
    }

    return 'skeleton'; // Rich experience for good connections
  }

  private injectGlobalStyles() {
    if (document.querySelector('#loading-states-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'loading-states-styles';
    styles.textContent = `
      /* Base skeleton styles */
      .skeleton {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: skeleton-loading 1.5s infinite;
        border-radius: 4px;
      }

      @keyframes skeleton-loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      /* Product skeleton layouts */
      .skeleton-image { width: 100%; height: 300px; border-radius: 8px; }
      .skeleton-title { width: 80%; height: 24px; margin: 16px 0 8px 0; }
      .skeleton-price { width: 40%; height: 20px; margin: 8px 0; }
      .skeleton-description { width: 100%; height: 60px; margin: 12px 0; }
      .skeleton-rating { width: 120px; height: 16px; margin: 8px 0; }
      .skeleton-variation-label { width: 60px; height: 16px; margin: 16px 0 8px 0; }
      .skeleton-variation-option { width: 48px; height: 48px; border-radius: 50%; margin: 4px; }
      .skeleton-quantity-selector { width: 120px; height: 44px; }
      .skeleton-add-to-cart { width: 200px; height: 48px; margin-left: 12px; }
      .skeleton-badge { width: 60px; height: 24px; border-radius: 12px; }

      .skeleton-variations {
        margin: 20px 0;
      }

      .skeleton-variation-options {
        display: flex;
        gap: 8px;
        margin-top: 8px;
      }

      .skeleton-actions {
        display: flex;
        align-items: center;
        margin: 24px 0;
      }

      /* Loading overlays */
      .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
      }

      /* Spinner styles */
      .spinner-container {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #e0e0e0;
        border-top: 2px solid #3b82f6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* Shimmer effect */
      .shimmer-container {
        width: 100px;
        height: 20px;
        background: #f0f0f0;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 8px;
      }

      .shimmer {
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, 
          transparent 0%, 
          rgba(255, 255, 255, 0.4) 50%, 
          transparent 100%
        );
        animation: shimmer 1.5s infinite;
      }

      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }

      /* State transitions */
      .loading-state {
        opacity: 1;
        transition: opacity 0.3s ease;
      }

      .loading-state.fade-out {
        opacity: 0;
      }

      .success-state {
        color: #10b981;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .error-state {
        color: #ef4444;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .loading-text {
        font-size: 14px;
        color: #6b7280;
      }

      /* Mobile optimizations */
      @media (max-width: 768px) {
        .skeleton-image { height: 250px; }
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .skeleton, .spinner, .shimmer {
          animation: none;
        }
        .skeleton {
          background: #f0f0f0;
        }
      }
    `;

    document.head.appendChild(styles);
  }
}

class LoadingController {
  private element: HTMLElement;
  private type: LoadingState['type'];
  private originalContent?: string;

  constructor(element: HTMLElement, type: LoadingState['type']) {
    this.element = element;
    this.type = type;
  }

  setOriginalContent(content: string) {
    this.originalContent = content;
  }

  transitionToState(state: 'success' | 'error', message: string, duration: number, showRetry: boolean = false) {
    const stateElement = this.element.querySelector('.loading-state') || this.element;
    
    let icon = '';
    let className = '';
    
    if (state === 'success') {
      icon = '✓';
      className = 'success-state';
    } else {
      icon = '⚠';
      className = 'error-state';
    }

    const retryButton = showRetry ? 
      `<button class="retry-button" onclick="window.location.reload()">Retry</button>` : '';

    stateElement.innerHTML = `
      <div class="${className}">
        <span class="state-icon">${icon}</span>
        <span class="state-message">${message}</span>
        ${retryButton}
      </div>
    `;
  }

  fadeOut(callback?: () => void) {
    const loadingElement = this.element.querySelector('.loading-state') || this.element;
    loadingElement.classList.add('fade-out');
    
    setTimeout(() => {
      if (callback) callback();
    }, 300);
  }

  remove() {
    const loadingElement = this.element.querySelector('.loading-state');
    
    if (loadingElement) {
      loadingElement.remove();
    }

    // Restore original content if it was a button
    if (this.originalContent && this.element.tagName === 'BUTTON') {
      (this.element as HTMLButtonElement).disabled = false;
      this.element.innerHTML = this.originalContent;
    }
  }
}

// Export singleton instance
export const loadingStates = new LoadingStateManager();

// Helper functions for common use cases
export function showProductLoading(container: HTMLElement) {
  return loadingStates.showProductDetailsLoading(container);
}

export function showImageLoading(container: HTMLElement, count?: number) {
  return loadingStates.showProductImageLoading(container, count);
}

export function showButtonLoading(button: HTMLElement) {
  return loadingStates.showCartUpdateLoading(button);
}

export function hideLoading(loaderId: string) {
  loadingStates.hideLoading(loaderId);
}

export function showSuccess(loaderId: string, message?: string) {
  loadingStates.transitionToSuccess(loaderId, message);
}

export function showError(loaderId: string, message?: string) {
  loadingStates.transitionToError(loaderId, message);
}
