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

  constructor() {
    this.state = {
      currentPath: typeof window !== 'undefined' ? window.location.pathname : '/',
      previousPath: '',
      navigationDirection: 'forward',
      pendingOperations: new Set(),
      isViewTransitionActive: false
    };
    
    if (typeof window !== 'undefined') {
      this.setupEventListeners();
      this.interceptHistoryMethods();
    }
  }

  private setupEventListeners(): void {
    // Track view transition state
    document.addEventListener('astro:before-preparation', (e: any) => {
      this.state.isViewTransitionActive = true;
      this.state.navigationDirection = e.direction === 'back' ? 'back' : 'forward';
      this.state.previousPath = this.state.currentPath;
      
      if (this.enabled && import.meta.env.DEV) {
        console.log(`[NavigationManager] View transition starting: ${e.direction}`);
      }
    });

    document.addEventListener('astro:after-swap', () => {
      this.state.isViewTransitionActive = false;
      this.state.currentPath = window.location.pathname;
      this.processQueuedOperations();
      
      if (this.enabled && import.meta.env.DEV) {
        console.log(`[NavigationManager] View transition complete, processed ${this.operationQueue.length} queued operations`);
      }
    });

    // Handle view transition errors
    document.addEventListener('astro:before-swap', (e: any) => {
      if (e.to && this.enabled && import.meta.env.DEV) {
        console.log(`[NavigationManager] Navigating to: ${e.to.pathname}`);
      }
    });
  }

  private interceptHistoryMethods(): void {
    if (!this.enabled) return;

    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = (state: any, title: string, url?: string | URL | null) => {
      this.queueOperation('pushState', () => {
        originalPushState(state, title, url);
      }, url?.toString() || '', state, title);
    };

    history.replaceState = (state: any, title: string, url?: string | URL | null) => {
      this.queueOperation('replaceState', () => {
        originalReplaceState(state, title, url);
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
      if (this.enabled && import.meta.env.DEV) {
        console.log(`[NavigationManager] Queuing ${operation} for ${url}`);
      }
      
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
    
    if (this.enabled && import.meta.env.DEV) {
      console.log(`[NavigationManager] Processing ${this.operationQueue.length} queued operations`);
    }
    
    // Process operations in order, but deduplicate similar URLs
    const uniqueOperations = this.deduplicateOperations(this.operationQueue);
    
    uniqueOperations.forEach(operation => {
      try {
        operation.callback();
      } catch (error) {
        console.error(`[NavigationManager] Error executing ${operation.type}:`, error);
      }
    });
    
    this.operationQueue = [];
    this.isProcessing = false;
  }

  private deduplicateOperations(operations: NavigationOperation[]): NavigationOperation[] {
    if (operations.length <= 1) return operations;
    
    // Keep only the last operation for each unique URL
    const urlMap = new Map<string, NavigationOperation>();
    
    operations.forEach(op => {
      urlMap.set(op.url, op);
    });
    
    return Array.from(urlMap.values());
  }

  // Public API for components
  public updateURL(url: string, replace: boolean = false, state: any = {}): void {
    if (!this.enabled) {
      // Fallback to direct history methods when disabled
      if (replace) {
        history.replaceState(state, '', url);
      } else {
        history.pushState(state, '', url);
      }
      return;
    }

    if (replace) {
      history.replaceState(state, '', url);
    } else {
      history.pushState(state, '', url);
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
    // Clear any queued operations
    this.operationQueue = [];
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
