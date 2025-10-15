import { AppSettings, ConnectionStatus, PrinterInfo, PrintJob, PrintResult } from '../shared/types';

declare global {
  interface Window {
    electronAPI: {
      // App
      getAppVersion: () => Promise<string>;
      openLogs: () => Promise<void>;
      clearLogs: () => Promise<{ success: boolean; error?: string }>;
      
      // Settings
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: Partial<AppSettings>) => Promise<{ success: boolean }>;
      
      // Connection
      connectToRestaurant: (code: string) => Promise<{ success: boolean; message?: string }>;
      disconnect: () => Promise<{ success: boolean }>;
      getConnectionStatus: () => Promise<{ status: ConnectionStatus; serverUrl: string; restaurantCode: string }>;
      
      // Printers
      getPrinters: () => Promise<PrinterInfo[]>;
      testPrinter: (printerName: string) => Promise<PrintResult>;
      
      // Window
      minimizeToTray: () => Promise<void>;
      showWindow: () => Promise<void>;
      
      // Updates
      checkForUpdates: () => Promise<void>;
      restartAndUpdate: () => Promise<void>;
      
      // Listeners
      onConnectionStatusChanged: (callback: (status: ConnectionStatus) => void) => () => void;
      onPrintJobReceived: (callback: (job: PrintJob) => void) => () => void;
      onUpdateAvailable: (callback: () => void) => () => void;
      onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void) => () => void;
      onUpdateDownloaded: (callback: () => void) => () => void;
      onUpdateNotAvailable: (callback: () => void) => () => void;
    };
  }
}

export {};

