/**
 * Connection Awareness System for Performance-First PWA
 * File: src/lib/connection/ConnectionManager.ts
 */

export interface ConnectionState {
  online: boolean;
  quality: 'fast' | 'slow' | 'offline';
  effectiveType: string;
  saveData: boolean;
  downlink?: number;
  rtt?: number;
}

export interface ConnectionAwareConfig {
  slowThreshold: number; // ms RTT threshold for slow connection
  preloadOnSlow: boolean;
  reduceQualityOnSlow: boolean;
  showConnectionIndicator: boolean;
}

export class ConnectionManager {
  private state: ConnectionState;
  private config: ConnectionAwareConfig;
  private listeners: ((state: ConnectionState) => void)[] = [];
  private connection: any;

  constructor(config: Partial<ConnectionAwareConfig> = {}) {
    this.config = {
      slowThreshold: 300,
      preloadOnSlow: false,
      reduceQualityOnSlow: true,
      showConnectionIndicator: true,
      ...config
    };

    this.connection = (navigator as any).connection;
    this.state = this.getCurrentState();
    this.init();
  }

  private init(): void {
    // Listen for online/offline events
    window.addEventListener('online', () => this.updateState());
    window.addEventListener('offline', () => this.updateState());

    // Listen for connection changes if available
    if (this.connection) {
      this.connection.addEventListener('change', () => this.updateState());
    }

    // Periodic connection quality checks
    this.startQualityMonitoring();
  }

  private getCurrentState(): ConnectionState {
    const online = navigator.onLine;
    const connection = this.connection;

    let quality: 'fast' | 'slow' | 'offline' = 'fast';
    
    if (!online) {
      quality = 'offline';
    } else if (connection) {
      const effectiveType = connection.effectiveType;
      const rtt = connection.rtt;
      
      if (effectiveType === 'slow-2g' || effectiveType === '2g' || 
          (rtt && rtt > this.config.slowThreshold)) {
        quality = 'slow';
      }
    }

    return {
      online,
      quality,
      effectiveType: connection?.effectiveType || 'unknown',
      saveData: connection?.saveData || false,
      downlink: connection?.downlink,
      rtt: connection?.rtt
    };
  }

  private updateState(): void {
    const newState = this.getCurrentState();
    const previousQuality = this.state.quality;
    
    this.state = newState;
    
    // Notify listeners of state change
    this.listeners.forEach(listener => listener(newState));
    
    // Show connection status if quality changed significantly
    if (previousQuality !== newState.quality && this.config.showConnectionIndicator) {
      this.showConnectionStatusNotification(newState);
    }
  }

  private startQualityMonitoring(): void {
    // Test connection speed periodically (every 30 seconds when online)
    setInterval(() => {
      if (this.state.online) {
        this.measureConnectionSpeed();
      }
    }, 30000);
  }

  private async measureConnectionSpeed(): Promise<void> {
    try {
      const startTime = performance.now();
      
      // Use a small image for speed test (1x1 pixel gif)
      const testUrl = `data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7?t=${Date.now()}`;
      
      await fetch(testUrl, { cache: 'no-cache' });
      
      const endTime = performance.now();
      const latency = endTime - startTime;
      
      // Update quality based on measured latency
      const currentQuality = this.state.quality;
      let newQuality: 'fast' | 'slow' | 'offline' = 'fast';
      
      if (latency > this.config.slowThreshold) {
        newQuality = 'slow';
      }
      
      if (newQuality !== currentQuality) {
        this.state.quality = newQuality;
        this.listeners.forEach(listener => listener(this.state));
      }
    } catch (error) {
      // If test fails, might be offline or very slow
      this.state.quality = 'offline';
      this.listeners.forEach(listener => listener(this.state));
    }
  }

  private showConnectionStatusNotification(state: ConnectionState): void {
    // Remove existing notification
    const existing = document.getElementById('connection-status-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.id = 'connection-status-notification';
    notification.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm font-medium transition-all duration-300';
    
    let message = '';
    let bgColor = '';
    
    switch (state.quality) {
      case 'fast':
        message = '🚀 Fast connection detected';
        bgColor = 'bg-green-600';
        break;
      case 'slow':
        message = '🐌 Slow connection - optimizing experience';
        bgColor = 'bg-yellow-600';
        break;
      case 'offline':
        message = '📡 You\'re offline - some features unavailable';
        bgColor = 'bg-red-600';
        break;
    }
    
    notification.className += ` ${bgColor}`;
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds for fast connections, 5 seconds for slow/offline
    const duration = state.quality === 'fast' ? 3000 : 5000;
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.style.opacity = '0';
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 300);
      }
    }, duration);
  }

  // Public API
  public getState(): ConnectionState {
    return { ...this.state };
  }

  public onStateChange(callback: (state: ConnectionState) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public adaptImageQuality(baseQuality: number = 85): number {
    if (!this.config.reduceQualityOnSlow) {
      return baseQuality;
    }

    switch (this.state.quality) {
      case 'slow':
        return Math.max(50, baseQuality - 20);
      case 'offline':
        return 30; // Very low quality for cached images
      default:
        return baseQuality;
    }
  }

  public shouldPreload(): boolean {
    if (this.state.quality === 'offline') return false;
    if (this.state.quality === 'slow') return this.config.preloadOnSlow;
    return true;
  }

  public getRecommendedImageFormat(): 'avif' | 'webp' | 'jpeg' {
    // Fast connections can handle AVIF
    if (this.state.quality === 'fast') return 'avif';
    
    // Slow connections should use WebP for balance
    if (this.state.quality === 'slow') return 'webp';
    
    // Offline or very slow should use JPEG (better cache/compression ratio)
    return 'jpeg';
  }

  public isEcommerceAvailable(): boolean {
    // Cart, checkout, and purchase actions require online connection
    return this.state.online;
  }

  public getPerformanceMode(): 'high' | 'medium' | 'low' {
    switch (this.state.quality) {
      case 'fast':
        return 'high';
      case 'slow':
        return 'medium';
      default:
        return 'low';
    }
  }
}

// Global instance
export const connectionManager = new ConnectionManager();

// Initialize immediately if in browser
if (typeof window !== 'undefined') {
  connectionManager;
}

export default ConnectionManager;