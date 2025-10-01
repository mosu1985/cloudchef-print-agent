import { contextBridge, ipcRenderer } from 'electron';
import { AppSettings, ConnectionStatus, PrinterInfo, PrintResult, PrintJob } from '../shared/types';

// 🔐 Безопасное API для рендер процесса
const electronAPI = {
  // 📱 Приложение
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  openLogs: (): Promise<void> => ipcRenderer.invoke('open-logs'),
  
  // ⚙️ Настройки
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Partial<AppSettings>): Promise<{ success: boolean }> => 
    ipcRenderer.invoke('save-settings', settings),
  
  // 🔗 Подключение
  connectToRestaurant: (code: string): Promise<{ success: boolean; message?: string }> => 
    ipcRenderer.invoke('connect-to-restaurant', code),
  disconnect: (): Promise<{ success: boolean }> => ipcRenderer.invoke('disconnect'),
  getConnectionStatus: (): Promise<{ status: ConnectionStatus; serverUrl: string; restaurantCode: string }> => 
    ipcRenderer.invoke('get-connection-status'),
  
  // 🖨️ Принтеры
  getPrinters: (): Promise<PrinterInfo[]> => ipcRenderer.invoke('get-printers'),
  testPrinter: (printerName: string): Promise<PrintResult> => ipcRenderer.invoke('test-printer', printerName),
  
  // 🪟 Окно
  minimizeToTray: (): Promise<void> => ipcRenderer.invoke('minimize-to-tray'),
  showWindow: (): Promise<void> => ipcRenderer.invoke('show-window'),
  
  // 🔄 Автообновления
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('check-for-updates'),
  restartAndUpdate: (): Promise<void> => ipcRenderer.invoke('restart-and-update'),
  
  // 📡 Слушатели событий
  onConnectionStatusChanged: (callback: (status: ConnectionStatus) => void) => {
    const handler = (_: any, status: ConnectionStatus) => callback(status);
    ipcRenderer.on('connection-status-changed', handler);
    
    // Возвращаем функцию для отписки
    return () => ipcRenderer.removeListener('connection-status-changed', handler);
  },
  
  onPrintJobReceived: (callback: (job: PrintJob) => void) => {
    const handler = (_: any, job: PrintJob) => callback(job);
    ipcRenderer.on('print-job-received', handler);
    
    return () => ipcRenderer.removeListener('print-job-received', handler);
  },
  
  onUpdateAvailable: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('update-available', handler);
    
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  
  onUpdateDownloaded: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('update-downloaded', handler);
    
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  }
};

// Экспорт API в глобальную область видимости
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Типизация для глобального объекта window
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}



