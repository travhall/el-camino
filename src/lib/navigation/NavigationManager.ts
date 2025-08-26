// src/lib/navigation/NavigationManager.ts
import { navigate } from 'astro:transitions/client';

export interface NavigationState {
  currentPath: string;
  previousPath: string;
  navigationDirection: 'forward' | 'back' | 'replace';
  pendingOperations: Set<string>;
  isViewTransitionActive: boolean;
}

export interface NavigationOperation {
  type: 'pushState' | 'replaceState';
  url: string;
  state: any;
  title: string;
  callback: () => void;
}

export class NavigationManager {
  private state: NavigationState;
  private operationQueue: NavigationOperation[] = [];
  private isProcessing = false;
  private enabled = true; // Feature flag
  private originalPushState: typeof history.pushState;
  private originalReplaceState: typeof history.replaceState;

  constructor() {
    this.state = {
      currentPath: typeof window !== 'undefined' ? window.location.pathname : '/',
      previousPath: '',
      navigationDirection: 'forward',
      pendingOperations: new Set(),
      isViewTransitionActive: false
    };
    
    this.enabled = true;
    
    if (typeof window !== 'undefined') {
      // Store original methods before interception
      this.originalPushState = history.pushState.bind(history);
      this.originalReplaceState = history.replaceState.bind(history);
      
      this.setupEventListeners();
      this.interceptHistoryMethods();
    } else {
      // Initialize as no-ops for SSR compatibility
      this.originalPushState = (() => {}) as any;
      this.originalReplaceState = (() => {}) as any;
    }
  }

  private setupEventListeners(): void {
    // Track view transition state
    document.addEventListener('astro:before-preparation', (e: any) => {
      this.state.isViewTransitionActive = true;
      this.state.navigationDirection = e.direction === 'back' ? 'back' : 'forward';
      this.state.previousPath = this.state.currentPath;
    });

    document.addEventListener('astro:after-swap', () => {
      this.state.isViewTransitionActive = false;
      this.state.currentPath = window.location.pathname;
      this.processQueuedOperations();
    });
  }

  private interceptHistoryMethods(): void {
    if (!this.enabled) return;

    history.pushState = (state: any, title: string, url?: string | URL | null) => {
      this.queueOperation('pushState', () => {
        this.originalPushState(state, title, url);
      }, url?.toString() || '', state, title);
    };

    history.replaceState = (state: any, title: string, url?: string | URL | null) => {
      this.queueOperation('replaceState', () => {
        this.originalReplaceState(state, title, url);
      }, url?.toString() || '', state, title);
    };
  }

  private queueOperation(
    operation: 'pushState' | 'replaceState',
    callback: () => void,
    url: string,
    state: any,
    title: string
  ): void {
    if (this.state.isViewTransitionActive || this.isProcessing) {
      this.operationQueue.push({
        type: operation,
        url,
        state,
        title,
        callback
      });
    } else {
      callback();
    }
  }

  private processQueuedOperations(): void {
    if (this.operationQueue.length === 0) return;
    
    this.isProcessing = true;
    
    // Process operations efficiently - just execute the last operation for each URL
    const lastOperationPerUrl = new Map<string, NavigationOperation>();
    this.operationQueue.forEach(op => {
      lastOperationPerUrl.set(op.url, op);
    });
    
    lastOperationPerUrl.forEach(operation => {
      try {
        operation.callback();
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error(`[NavigationManager] Error executing ${operation.type}:`, error);
        }
      }
    });
    
    this.operationQueue = [];
    this.isProcessing = false;
  }

  // Public API for components
  public updateURL(url: string, replace: boolean = false, state: any = {}): void {
    if (!this.enabled || typeof window === 'undefined') {
      // Fallback to direct history methods when disabled or not in browser
      if (typeof window !== 'undefined') {
        if (replace) {
          history.replaceState(state, '', url);
        } else {
          history.pushState(state, '', url);
        }
      }
      return;
    }

    // Use original methods to avoid double interception
    if (replace) {
      this.originalReplaceState(state, '', url);
    } else {
      this.originalPushState(state, '', url);
    }
  }

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

  public getQueueLength(): number {
    return this.operationQueue.length;
  }

  // Feature flag controls
  public enable(): void {
    this.enabled = true;
    if (typeof window !== 'undefined') {
      this.interceptHistoryMethods();
    }
  }

  public disable(): void {
    this.enabled = false;
    this.operationQueue = [];
    
    // Restore original methods
    if (typeof window !== 'undefined') {
      history.pushState = this.originalPushState;
      history.replaceState = this.originalReplaceState;
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  // Reset state for error recovery
  public resetState(): void {
    this.operationQueue = [];
    this.isProcessing = false;
    this.state.isViewTransitionActive = false;
    this.state.pendingOperations.clear();
    
    if (this.enabled && import.meta.env.DEV) {
      console.log('[NavigationManager] State reset');
    }
  }

  // Debug information
  public getDebugInfo(): any {
    return {
      state: { ...this.state },
      queueLength: this.operationQueue.length,
      isProcessing: this.isProcessing,
      enabled: this.enabled,
      operations: this.operationQueue.map(op => ({
        type: op.type,
        url: op.url
      }))
    };
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
