"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// 🔐 Безопасное API для рендер процесса
const electronAPI = {
    // 📱 Приложение
    getAppVersion: () => electron_1.ipcRenderer.invoke('get-app-version'),
    openLogs: () => electron_1.ipcRenderer.invoke('open-logs'),
    clearLogs: () => electron_1.ipcRenderer.invoke('clear-logs'),
    // ⚙️ Настройки
    getSettings: () => electron_1.ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => electron_1.ipcRenderer.invoke('save-settings', settings),
    // 🔗 Подключение
    connectToRestaurant: (code) => electron_1.ipcRenderer.invoke('connect-to-restaurant', code),
    disconnect: () => electron_1.ipcRenderer.invoke('disconnect'),
    getConnectionStatus: () => electron_1.ipcRenderer.invoke('get-connection-status'),
    // 🖨️ Принтеры
    getPrinters: () => electron_1.ipcRenderer.invoke('get-printers'),
    testPrinter: (printerName) => electron_1.ipcRenderer.invoke('test-printer', printerName),
    // 🪟 Окно
    minimizeToTray: () => electron_1.ipcRenderer.invoke('minimize-to-tray'),
    showWindow: () => electron_1.ipcRenderer.invoke('show-window'),
    // 🔄 Автообновления
    checkForUpdates: () => electron_1.ipcRenderer.invoke('check-for-updates'),
    restartAndUpdate: () => electron_1.ipcRenderer.invoke('restart-and-update'),
    // 📡 Слушатели событий
    onConnectionStatusChanged: (callback) => {
        const handler = (_, status) => callback(status);
        electron_1.ipcRenderer.on('connection-status-changed', handler);
        // Возвращаем функцию для отписки
        return () => electron_1.ipcRenderer.removeListener('connection-status-changed', handler);
    },
    onPrintJobReceived: (callback) => {
        const handler = (_, job) => callback(job);
        electron_1.ipcRenderer.on('print-job-received', handler);
        return () => electron_1.ipcRenderer.removeListener('print-job-received', handler);
    },
    onUpdateAvailable: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on('update-available', handler);
        return () => electron_1.ipcRenderer.removeListener('update-available', handler);
    },
    onDownloadProgress: (callback) => {
        const handler = (_, progress) => callback(progress);
        electron_1.ipcRenderer.on('download-progress', handler);
        return () => electron_1.ipcRenderer.removeListener('download-progress', handler);
    },
    onUpdateDownloaded: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on('update-downloaded', handler);
        return () => electron_1.ipcRenderer.removeListener('update-downloaded', handler);
    },
    onUpdateNotAvailable: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on('update-not-available', handler);
        return () => electron_1.ipcRenderer.removeListener('update-not-available', handler);
    }
};
// Экспорт API в глобальную область видимости
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
//# sourceMappingURL=preload.js.map