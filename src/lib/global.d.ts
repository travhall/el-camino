// src/types/global.d.ts
/* eslint-disable @typescript-eslint/no-explicit-any -- ambient declarations for untyped third-party globals (gtag, Square SDK) */
declare global {
  // Declare gtag globally for analytics
  function gtag(...args: any[]): void;

  interface Navigator {
    deviceMemory?: number; // Device Memory API
  }

  interface Window {
    squareLoaded: boolean;
    loadSquareScript: () => Promise<void>;
    Square: any;
    ElCaminoSquareAPI: any; // Required for Phase 1-Enhanced
    gtag: (...args: any[]) => void; // Required for Analytics
    showNotification: (
      message: string,
      type?: 'success' | 'error' | 'info' | 'warning',
      duration?: number,
      action?: { label: string; href: string }
    ) => void;
    newsData?: {
      allPosts: any[];
      searchIndex: any;
      filterOptions: any;
    };
    responsiveFiltersInitialized?: boolean;
    dismissRecommendation?: (button: HTMLButtonElement) => void;
    applyRecommendation?: (button: HTMLButtonElement) => void;
    toggleRecommendationDetails?: (button: HTMLButtonElement) => void;
  }
}

export {};
