// src/types/global.d.ts
declare global {
  interface Window {
    squareLoaded: boolean;
    loadSquareScript: () => Promise<void>;
    Square: any;
    showNotification: (message: string, type?: "success" | "error" | "info", duration?: number) => void;
  }
}

export {};