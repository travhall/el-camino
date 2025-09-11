// src/lib/navigation/NavigationManager.ts - Simplified for performance
import { navigate } from 'astro:transitions/client';

export interface NavigationState {
  currentPath: string;
  previousPath: string;
  navigationDirection: 'forward' | 'back' | 'replace';
  isViewTransitionActive: boolean;
  lastTransitionStart?: number;
}

export class NavigationManager {
  private state: NavigationState;
  private enabled = true;

  constructor() {
    this.state = {
      currentPath: typeof window !== 'undefined' ? window.location.pathname : '/',
      previousPath: '',
      navigationDirection: 'forward',
      isViewTransitionActive: false,
      lastTransitionStart: undefined
    };
    
    if (typeof window !== 'undefined') {
      this.setupEventListeners();
    }
  }

  private setupEventListeners(): void {
    // Track view transition state - essential for coordination
    document.addEventListener('astro:before-preparation', (e: any) => {
      this.state.isViewTransitionActive = true;
      this.state.navigationDirection = e.direction === 'back' ? 'back' : 'forward';
      this.state.previousPath = this.state.currentPath;
      this.state.lastTransitionStart = Date.now();
    });

    document.addEventListener('astro:after-swap', () => {
      this.state.isViewTransitionActive = false;
      this.state.currentPath = window.location.pathname;
      this.state.lastTransitionStart = undefined;
    });
  }

  // Essential public API for components
  public getNavigationDirection(): 'forward' | 'back' | 'replace' {
    return this.state.navigationDirection;
  }

  public isBackNavigation(): boolean {
    return this.state.navigationDirection === 'back';
  }

  public getCurrentPath(): string {
    return this.state.currentPath;
  }

  public getPreviousPath(): string {
    return this.state.previousPath;
  }

  public isViewTransitionActive(): boolean {
    return this.state.isViewTransitionActive;
  }

  // Simplified feature flag controls
  public enable(): void {
    this.enabled = true;
  }

  public disable(): void {
    this.enabled = false;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  // Enhanced state reset with error recovery
  public resetState(): void {
    this.state.isViewTransitionActive = false;
    
    // Reset to current path in case of navigation errors
    if (typeof window !== 'undefined') {
      this.state.currentPath = window.location.pathname;
      this.state.previousPath = '';
      this.state.navigationDirection = 'forward';
    }
    
    if (this.enabled && import.meta.env.DEV) {
      console.log('[NavigationManager] State reset with error recovery');
    }
  }

  // Enhanced error recovery for navigation failures
  public recoverFromError(): void {
    try {
      this.resetState();
      
      // Re-establish event listeners if they were lost
      if (typeof window !== 'undefined' && this.enabled) {
        this.setupEventListeners();
      }
      
      if (import.meta.env.DEV) {
        console.log('[NavigationManager] Error recovery completed');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[NavigationManager] Error recovery failed:', error);
      }
    }
  }

  // Check if navigation is in a healthy state
  public isHealthy(): boolean {
    if (typeof window === 'undefined') return true;
    
    const pathMatches = this.state.currentPath === window.location.pathname;
    const noStuckTransition = !this.state.isViewTransitionActive || 
      (this.state.lastTransitionStart ? 
       Date.now() - this.state.lastTransitionStart < 10000 : true); // 10 second max
    
    return pathMatches && noStuckTransition;
  }
}

// Global singleton instance
export const navigationManager = typeof window !== 'undefined' 
  ? new NavigationManager() 
  : null;

// Safe accessor function
export function getNavigationManager(): NavigationManager | null {
  return navigationManager;
}
