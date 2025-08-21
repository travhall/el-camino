/**
 * PWA Registration and Service Worker Management
 * File: src/pwa.ts
 */

import { registerSW } from 'virtual:pwa-register';

interface PWARegistrationOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: any) => void;
}

class PWAManager {
  private updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
  private registration: ServiceWorkerRegistration | undefined;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private init(): void {
    // Register service worker with enhanced options
    this.updateSW = registerSW({
      immediate: true,
      onNeedRefresh: () => {
        this.showUpdatePrompt();
      },
      onOfflineReady: () => {
        this.showOfflineReady();
        this.notifyServiceWorker('OFFLINE_READY');
      },
      onRegistered: (registration) => {
        this.registration = registration;
        console.log('[PWA] Service Worker registered successfully');
        this.checkForUpdates();
      },
      onRegisterError: (error) => {
        console.error('[PWA] Service Worker registration failed:', error);
      }
    });

    // Setup install prompt handling
    this.setupInstallPrompt();
    
    // Setup periodic update checks
    this.setupUpdateChecks();
    
    // Setup offline detection
    this.setupOfflineDetection();
  }

  private showUpdatePrompt(): void {
    // Create update notification
    const notification = document.createElement('div');
    notification.className = 'pwa-update-notification';
    notification.innerHTML = `
      <div class="bg-blue-600 text-white p-4 rounded-lg shadow-lg">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-semibold">App Update Available</h3>
            <p class="text-sm opacity-90">A new version is ready to install</p>
          </div>
          <div class="flex gap-2">
            <button id="pwa-update-dismiss" class="px-3 py-1 text-sm border border-white/30 rounded hover:bg-white/10">
              Later
            </button>
            <button id="pwa-update-install" class="px-3 py-1 text-sm bg-white text-blue-600 rounded hover:bg-gray-100">
              Update
            </button>
          </div>
        </div>
      </div>
    `;

    // Position notification
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      max-width: 400px;
    `;

    document.body.appendChild(notification);

    // Handle button clicks
    const dismissBtn = notification.querySelector('#pwa-update-dismiss');
    const installBtn = notification.querySelector('#pwa-update-install');

    dismissBtn?.addEventListener('click', () => {
      document.body.removeChild(notification);
    });

    installBtn?.addEventListener('click', async () => {
      if (this.updateSW) {
        await this.updateSW(true);
      }
      document.body.removeChild(notification);
    });

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 10000);
  }

  private showOfflineReady(): void {
    // Show offline ready notification
    const notification = document.createElement('div');
    notification.className = 'pwa-offline-notification';
    notification.innerHTML = `
      <div class="bg-green-600 text-white p-4 rounded-lg shadow-lg">
        <div class="flex items-center">
          <div class="mr-3">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <div>
            <h3 class="font-semibold">App Ready for Offline Use</h3>
            <p class="text-sm opacity-90">You can now use the app without internet connection</p>
          </div>
        </div>
      </div>
    `;

    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1000;
      max-width: 400px;
    `;

    document.body.appendChild(notification);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 5000);
  }

  private setupInstallPrompt(): void {
    let deferredPrompt: any = null;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      this.showInstallBanner();
    });

    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App was installed');
      deferredPrompt = null;
      this.hideInstallBanner();
    });
  }

  private showInstallBanner(): void {
    // Create install banner if it doesn't exist
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
      <div class="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 shadow-lg">
        <div class="flex items-center justify-between max-w-4xl mx-auto">
          <div class="flex items-center">
            <div class="mr-3">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold">Install El Camino Skate Shop</h3>
              <p class="text-sm opacity-90">Get the full app experience with offline access</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button id="pwa-install-dismiss" class="px-4 py-2 text-sm border border-white/30 rounded hover:bg-white/10">
              Not Now
            </button>
            <button id="pwa-install-app" class="px-4 py-2 text-sm bg-white text-purple-600 rounded hover:bg-gray-100 font-medium">
              Install
            </button>
          </div>
        </div>
      </div>
    `;

    banner.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 999;
      transform: translateY(100%);
      transition: transform 0.3s ease-in-out;
    `;

    document.body.appendChild(banner);

    // Animate in
    setTimeout(() => {
      banner.style.transform = 'translateY(0)';
    }, 100);

    // Handle install button
    document.getElementById('pwa-install-app')?.addEventListener('click', async () => {
      const deferredPrompt = (window as any).deferredPrompt;
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          console.log('[PWA] User accepted install prompt');
        }
        (window as any).deferredPrompt = null;
        this.hideInstallBanner();
      }
    });

    // Handle dismiss button
    document.getElementById('pwa-install-dismiss')?.addEventListener('click', () => {
      this.hideInstallBanner();
    });
  }

  private hideInstallBanner(): void {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
      banner.style.transform = 'translateY(100%)';
      setTimeout(() => {
        if (document.body.contains(banner)) {
          document.body.removeChild(banner);
        }
      }, 300);
    }
  }

  private setupUpdateChecks(): void {
    // Check for updates every 30 minutes
    setInterval(() => {
      if (this.registration) {
        this.registration.update();
      }
    }, 30 * 60 * 1000);

    // Check for updates when page becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.registration) {
        this.registration.update();
      }
    });
  }

  private setupOfflineDetection(): void {
    window.addEventListener('online', () => {
      this.showConnectionStatus(true);
    });

    window.addEventListener('offline', () => {
      this.showConnectionStatus(false);
    });
  }

  private showConnectionStatus(isOnline: boolean): void {
    const notification = document.createElement('div');
    notification.className = 'pwa-connection-notification';
    
    if (isOnline) {
      notification.innerHTML = `
        <div class="bg-green-600 text-white p-3 rounded-lg shadow-lg">
          <div class="flex items-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"></path>
            </svg>
            <span class="font-medium">Back Online</span>
          </div>
        </div>
      `;
    } else {
      notification.innerHTML = `
        <div class="bg-yellow-600 text-white p-3 rounded-lg shadow-lg">
          <div class="flex items-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-12.728 12.728m0 0L5.636 18.364m12.728-12.728L5.636 5.636"></path>
            </svg>
            <span class="font-medium">You're Offline</span>
          </div>
        </div>
      `;
    }

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
    `;

    document.body.appendChild(notification);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 3000);
  }

  private checkForUpdates(): void {
    if (this.registration) {
      this.registration.addEventListener('updatefound', () => {
        console.log('[PWA] Update found');
      });
    }
  }

  private notifyServiceWorker(message: string, data?: any): void {
    if (this.registration?.active) {
      this.registration.active.postMessage({
        type: message,
        data: data || {}
      });
    }
  }

  // Public API
  public async updateApp(): Promise<void> {
    if (this.updateSW) {
      await this.updateSW(true);
    }
  }

  public isInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }

  public getRegistration(): ServiceWorkerRegistration | undefined {
    return this.registration;
  }
}

// Initialize PWA Manager
export const pwaManager = new PWAManager();

// Export for external use
export default pwaManager;
