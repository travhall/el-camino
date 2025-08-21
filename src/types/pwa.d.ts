/// Virtual module type definitions for PWA
/// File: src/types/pwa.d.ts

declare module 'virtual:pwa-register' {
  export function registerSW(options?: {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: any) => void;
  }): (reloadPage?: boolean) => Promise<void>;
}

declare module 'virtual:pwa-info' {
  interface PWAInfo {
    webManifest: {
      linkTag: string;
    };
  }
  export const pwaInfo: PWAInfo | undefined;
}

declare module 'virtual:pwa-register/vanilla' {
  export function registerSW(options?: {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: any) => void;
  }): (reloadPage?: boolean) => Promise<void>;
}
