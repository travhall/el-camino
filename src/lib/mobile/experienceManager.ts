/**
 * Mobile Experience Enhancement - Phase 2 UX Implementation
 * Touch interactions, responsive design, and mobile-optimized flows
 */

export interface TouchInteractionConfig {
  swipeThreshold: number;
  longPressDelay: number;
  doubleTapDelay: number;
  hapticFeedback: boolean;
}

export interface MobileOptimizationConfig {
  touchTargetMinSize: number;
  viewportBreakpoints: ViewportBreakpoint[];
  gestureSupport: GestureType[];
  performanceMode: 'standard' | 'lite';
}

export interface ViewportBreakpoint {
  name: string;
  minWidth: number;
  maxWidth?: number;
}

export type GestureType = 'swipe' | 'pinch' | 'longpress' | 'doubletap';

class MobileExperienceManager {
  private touchConfig: TouchInteractionConfig = {
    swipeThreshold: 50,
    longPressDelay: 500,
    doubleTapDelay: 300,
    hapticFeedback: true
  };

  private config: MobileOptimizationConfig = {
    touchTargetMinSize: 44,
    viewportBreakpoints: [
      { name: 'mobile', minWidth: 320, maxWidth: 767 },
      { name: 'tablet', minWidth: 768, maxWidth: 1023 },
      { name: 'desktop', minWidth: 1024 }
    ],
    gestureSupport: ['swipe', 'pinch', 'longpress'],
    performanceMode: this.detectPerformanceMode()
  };

  private touchStartData: TouchStartData | null = null;
  private lastTapTime = 0;
  private observers = new Map<string, IntersectionObserver>();

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeMobileEnhancements();
    }
  }

  private initializeMobileEnhancements() {
    this.enforceMinimumTouchTargets();
    this.initializeGestureHandling();
    this.optimizeScrolling();
    this.initializeViewportObserver();
    this.setupMobileNavigation();
  }

  private enforceMinimumTouchTargets() {
    const style = document.createElement('style');
    style.id = 'mobile-touch-targets';
    style.textContent = `
      @media (hover: none) and (pointer: coarse) {
        button, a, input, select, [role="button"] {
          min-height: ${this.config.touchTargetMinSize}px;
          min-width: ${this.config.touchTargetMinSize}px;
          padding: 8px;
        }
        
        .product-variation-option {
          min-height: 48px;
          min-width: 48px;
          margin: 4px;
        }
        
        .cart-quantity-controls button {
          min-height: 44px;
          min-width: 44px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  private initializeGestureHandling() {
    // Product image gallery swipe
    this.initializeImageGallerySwipe();
    
    // Variation selection long press for details
    this.initializeVariationLongPress();
    
    // Pinch to zoom on product images
    this.initializePinchZoom();
    
    // Double tap to add to cart
    this.initializeDoubleTapActions();
  }

  private initializeImageGallerySwipe() {
    const galleries = document.querySelectorAll('.product-image-gallery');
    
    galleries.forEach(gallery => {
      this.addSwipeHandling(gallery as HTMLElement, (direction) => {
        const currentIndex = parseInt(gallery.getAttribute('data-current-index') || '0');
        const images = gallery.querySelectorAll('.gallery-image');
        const maxIndex = images.length - 1;
        
        let newIndex = currentIndex;
        if (direction === 'left' && currentIndex < maxIndex) {
          newIndex = currentIndex + 1;
        } else if (direction === 'right' && currentIndex > 0) {
          newIndex = currentIndex - 1;
        }
        
        if (newIndex !== currentIndex) {
          this.switchToImage(gallery, newIndex);
          this.triggerHapticFeedback('light');
        }
      });
    });
  }

  private initializeVariationLongPress() {
    const variations = document.querySelectorAll('.variation-option');
    
    variations.forEach(variation => {
      this.addLongPressHandling(variation as HTMLElement, (element) => {
        const variationName = element.getAttribute('data-variation-name');
        const variationDetails = element.getAttribute('data-variation-details');
        
        this.showVariationTooltip(element, variationName, variationDetails);
        this.triggerHapticFeedback('medium');
      });
    });
  }

  private initializePinchZoom() {
    const productImages = document.querySelectorAll('.product-main-image');
    
    productImages.forEach(image => {
      this.addPinchZoomHandling(image as HTMLElement);
    });
  }

  private initializeDoubleTapActions() {
    const addToCartButton = document.querySelector('#add-to-cart-button');
    
    if (addToCartButton) {
      this.addDoubleTapHandling(addToCartButton as HTMLElement, () => {
        // Double tap adds to cart and shows quick confirmation
        this.triggerAddToCart();
        this.showQuickConfirmation('Added to cart!');
        this.triggerHapticFeedback('heavy');
      });
    }
  }

  private addSwipeHandling(element: HTMLElement, callback: (direction: 'left' | 'right') => void) {
    element.addEventListener('touchstart', (e) => {
      this.touchStartData = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now()
      };
    }, { passive: true });

    element.addEventListener('touchend', (e) => {
      if (!this.touchStartData) return;
      
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - this.touchStartData.x;
      const deltaY = touch.clientY - this.touchStartData.y;
      const deltaTime = Date.now() - this.touchStartData.time;
      
      // Check if it's a valid swipe (horizontal movement > vertical, fast enough)
      if (Math.abs(deltaX) > Math.abs(deltaY) && 
          Math.abs(deltaX) > this.touchConfig.swipeThreshold &&
          deltaTime < 500) {
        
        const direction = deltaX > 0 ? 'right' : 'left';
        callback(direction);
      }
      
      this.touchStartData = null;
    }, { passive: true });
  }

  private addLongPressHandling(element: HTMLElement, callback: (element: HTMLElement) => void) {
    let pressTimer: number;
    
    element.addEventListener('touchstart', (e) => {
      pressTimer = window.setTimeout(() => {
        callback(element);
      }, this.touchConfig.longPressDelay);
    }, { passive: true });

    element.addEventListener('touchend', () => {
      clearTimeout(pressTimer);
    }, { passive: true });

    element.addEventListener('touchmove', () => {
      clearTimeout(pressTimer);
    }, { passive: true });
  }

  private addPinchZoomHandling(element: HTMLElement) {
    let initialDistance = 0;
    let initialScale = 1;
    
    element.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        initialDistance = this.getDistance(e.touches[0], e.touches[1]);
        initialScale = parseFloat(element.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1');
      }
    }, { passive: true });

    element.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        
        const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
        const scale = initialScale * (currentDistance / initialDistance);
        const clampedScale = Math.min(Math.max(scale, 1), 3);
        
        element.style.transform = `scale(${clampedScale})`;
        element.style.transformOrigin = 'center center';
        
        // Add zoom out gesture area
        if (clampedScale > 1 && !element.querySelector('.zoom-out-area')) {
          this.addZoomOutArea(element);
        }
      }
    });
  }

  private addDoubleTapHandling(element: HTMLElement, callback: () => void) {
    element.addEventListener('touchend', (e) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - this.lastTapTime;
      
      if (timeDiff < this.touchConfig.doubleTapDelay && timeDiff > 50) {
        e.preventDefault();
        callback();
      }
      
      this.lastTapTime = currentTime;
    }, { passive: false });
  }

  // Helper methods
  private getDistance(touch1: Touch, touch2: Touch): number {
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  }

  private switchToImage(gallery: Element, index: number) {
    gallery.setAttribute('data-current-index', index.toString());
    
    const images = gallery.querySelectorAll('.gallery-image');
    images.forEach((img, i) => {
      img.classList.toggle('active', i === index);
    });
    
    // Update indicators if present
    const indicators = gallery.querySelectorAll('.gallery-indicator');
    indicators.forEach((indicator, i) => {
      indicator.classList.toggle('active', i === index);
    });
  }

  private showVariationTooltip(element: HTMLElement, name: string | null, details: string | null) {
    const tooltip = document.createElement('div');
    tooltip.className = 'variation-tooltip';
    tooltip.innerHTML = `
      <div class="tooltip-content">
        <h4>${name || 'Variation'}</h4>
        <p>${details || 'Additional information'}</p>
      </div>
    `;
    
    document.body.appendChild(tooltip);
    
    // Position tooltip
    const rect = element.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 10}px`;
    tooltip.style.transform = 'translate(-50%, -100%)';
    tooltip.style.zIndex = '1000';
    
    // Auto-remove after delay
    setTimeout(() => {
      tooltip.remove();
    }, 2000);
  }

  private triggerAddToCart() {
    const addToCartEvent = new CustomEvent('mobile:addToCart', {
      detail: { source: 'doubleTap', timestamp: Date.now() }
    });
    document.dispatchEvent(addToCartEvent);
  }

  private showQuickConfirmation(message: string) {
    const confirmation = document.createElement('div');
    confirmation.className = 'quick-confirmation';
    confirmation.textContent = message;
    confirmation.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #10b981;
      color: white;
      padding: 12px 24px;
      border-radius: 24px;
      z-index: 1000;
      animation: slideInOut 2s ease-in-out forwards;
    `;
    
    document.body.appendChild(confirmation);
    
    setTimeout(() => confirmation.remove(), 2000);
  }

  private triggerHapticFeedback(type: 'light' | 'medium' | 'heavy') {
    if (!this.touchConfig.hapticFeedback || !navigator.vibrate) return;
    
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30, 10, 30]
    };
    
    navigator.vibrate(patterns[type]);
  }

  private addZoomOutArea(element: HTMLElement) {
    const zoomOutArea = document.createElement('div');
    zoomOutArea.className = 'zoom-out-area';
    zoomOutArea.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      width: 40px;
      height: 40px;
      background: rgba(0,0,0,0.5);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 18px;
      z-index: 10;
      cursor: pointer;
    `;
    zoomOutArea.innerHTML = '×';
    
    zoomOutArea.addEventListener('touchend', (e) => {
      e.preventDefault();
      element.style.transform = 'scale(1)';
      zoomOutArea.remove();
    });
    
    element.appendChild(zoomOutArea);
  }

  private optimizeScrolling() {
    // Momentum scrolling for iOS
    (document.body.style as any).webkitOverflowScrolling = 'touch';
    
    // Smooth scrolling for navigation
    document.documentElement.style.scrollBehavior = 'smooth';
    
    // Prevent zoom on double tap for buttons (but allow for images)
    const style = document.createElement('style');
    style.textContent = `
      button, input, select, textarea {
        touch-action: manipulation;
      }
      
      .product-image, .zoomable {
        touch-action: pinch-zoom;
      }
      
      .product-variation-selector {
        -webkit-overflow-scrolling: touch;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
      }
      
      .variation-option {
        scroll-snap-align: start;
      }
    `;
    document.head.appendChild(style);
  }

  private setupMobileNavigation() {
    // Add mobile-specific navigation enhancements
    const navigation = document.querySelector('.main-navigation');
    if (navigation && this.isMobile()) {
      navigation.classList.add('mobile-optimized');
      
      // Add swipe to go back gesture
      this.addSwipeHandling(document.body, (direction) => {
        if (direction === 'right' && window.history.length > 1) {
          window.history.back();
        }
      });
    }
  }

  private initializeViewportObserver() {
    // Optimize content based on viewport visibility
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const element = entry.target as HTMLElement;
        
        if (entry.isIntersecting) {
          element.classList.add('visible');
          
          // Load deferred content for mobile
          if (this.isMobile() && element.hasAttribute('data-mobile-defer')) {
            this.loadDeferredContent(element);
          }
        }
      });
    }, { 
      rootMargin: '100px 0px',
      threshold: 0.1 
    });

    // Observe product sections for progressive loading
    const productSections = document.querySelectorAll('.product-section');
    productSections.forEach(section => observer.observe(section));
    
    this.observers.set('viewport', observer);
  }

  private loadDeferredContent(element: HTMLElement) {
    const deferredSrc = element.getAttribute('data-mobile-defer');
    if (deferredSrc) {
      // Load deferred images or content for mobile
      const img = element.querySelector('img[data-src]') as HTMLImageElement;
      if (img && img.dataset.src) {
        img.src = img.dataset.src;
        delete img.dataset.src;
      }
    }
  }

  private detectPerformanceMode(): 'standard' | 'lite' {
    // Detect device capabilities and connection speed
    const connection = (navigator as any).connection;
    if (connection) {
      const slowConnection = connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g';
      const saveData = connection.saveData;
      
      if (slowConnection || saveData) {
        return 'lite';
      }
    }
    
    // Check device memory (if available)
    const deviceMemory = (navigator as any).deviceMemory;
    if (deviceMemory && deviceMemory < 4) {
      return 'lite';
    }
    
    return 'standard';
  }

  private isMobile(): boolean {
    return window.innerWidth <= 767 || 'ontouchstart' in window;
  }

  // Public methods
  updateConfiguration(config: Partial<MobileOptimizationConfig>) {
    this.config = { ...this.config, ...config };
  }

  getPerformanceMode(): 'standard' | 'lite' {
    return this.config.performanceMode;
  }
}

interface TouchStartData {
  x: number;
  y: number;
  time: number;
}

// Export singleton instance
export const mobileExperience = new MobileExperienceManager();
