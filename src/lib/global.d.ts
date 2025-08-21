// src/types/global.d.ts
declare global {
  interface Window {
    squareLoaded: boolean;
    loadSquareScript: () => Promise<void>;
    Square: any;
    showNotification: (
      message: string,
      type?: "success" | "error" | "info",
      duration?: number
    ) => void;
    newsData?: {
      allPosts: any[];
      searchIndex: any;
      filterOptions: any;
    };
    responsiveFiltersInitialized?: boolean;
    handleBudgetAlertAction?: (button: HTMLButtonElement) => void;
    dismissRecommendation?: (button: HTMLButtonElement) => void;
    applyRecommendation?: (button: HTMLButtonElement) => void;
    toggleRecommendationDetails?: (button: HTMLButtonElement) => void;
  }
}

export {};
