"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electron_updater_1 = require("electron-updater");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const fs_1 = require("fs");
const log = __importStar(require("electron-log"));
const electron_store_1 = __importDefault(require("electron-store"));
const auto_launch_1 = __importDefault(require("auto-launch"));
const socket_manager_1 = require("./socket-manager");
const printer_manager_1 = require("./printer-manager");
// 📝 Настройка логирования - ИСПРАВЛЕНИЕ EPIPE ОШИБКИ
log.transports.file.level = 'info';
log.transports.console.level = false; // Отключаем консольный вывод для исправления EPIPE
// 💾 Настройка хранилища настроек
const store = new electron_store_1.default({
    defaults: {
        serverUrl: 'https://cloudchef-print-server.onrender.com',
        restaurantCode: '',
        agentToken: '', // 🔑 Токен аутентификации агента (будет сгенерирован на сервере)
        selectedPrinter: '',
        labelOffsetHorizontal: 0, // 🖨️ Горизонтальное смещение в мм
        labelOffsetVertical: 0, // 🖨️ Вертикальное смещение в мм
        autoLaunch: false,
        notifications: true,
        minimizeToTray: true,
        startMinimized: true, // 🚀 Запускаться свёрнутым в трей при автозапуске
        isFirstRun: true, // 🆕 По умолчанию считаем первым запуском
        windowBounds: { width: 800, height: 600, x: undefined, y: undefined }
    }
});
// 🚀 Автозапуск - конфигурация для всех ОС (lazy initialization)
let autoLauncher = null;
function getAutoLauncher() {
    if (!autoLauncher) {
        autoLauncher = new auto_launch_1.default({
            name: 'CloudChef Print Agent',
            path: electron_1.app.getPath('exe')
        });
        log.info(`Автозапуск настроен для ${process.platform}:`, {
            name: 'CloudChef Print Agent',
            path: electron_1.app.getPath('exe'),
            platform: process.platform
        });
    }
    return autoLauncher;
}
class CloudChefPrintAgent {
    mainWindow = null;
    tray = null;
    socketManager;
    printerManager;
    connectionStatus = 'disconnected';
    isQuiting = false;
    constructor() {
        log.info('CloudChef Print Agent запускается...');
        this.socketManager = new socket_manager_1.SocketManager(store.get('serverUrl'), this.onConnectionChange.bind(this));
        this.printerManager = new printer_manager_1.PrinterManager();
        // 🔑 Загружаем токен из настроек
        const savedToken = store.get('agentToken');
        if (savedToken) {
            this.socketManager.setAgentToken(savedToken);
            log.info('🔑 Токен агента загружен из настроек');
        }
        else {
            log.warn('⚠️ Токен агента не найден - требуется настройка');
        }
        // Привязка метода обработки печати
        this.socketManager.onPrintJob = this.onPrintJob.bind(this);
        log.info('Менеджеры инициализированы');
        // Настройка обработчиков приложения
        this.setupAppHandlers();
        // Настройка IPC обработчиков
        this.setupIpcHandlers();
    }
    setupAutoUpdater() {
        electron_updater_1.autoUpdater.logger = log;
        // 🔄 Проверка обновлений при старте
        electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
        // ⏰ Периодическая проверка обновлений каждые 3 часа
        setInterval(() => {
            log.info('🔍 Периодическая проверка обновлений...');
            electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
        }, 3 * 60 * 60 * 1000); // 3 часа
        electron_updater_1.autoUpdater.on('update-available', (info) => {
            log.info('🎉 Обновление доступно:', info.version);
            if (this.mainWindow) {
                this.mainWindow.webContents.send('update-available');
            }
        });
        // 📊 Прогресс загрузки обновления
        electron_updater_1.autoUpdater.on('download-progress', (progressObj) => {
            log.info(`Прогресс загрузки: ${progressObj.percent}%`);
            if (this.mainWindow) {
                this.mainWindow.webContents.send('download-progress', {
                    percent: Math.round(progressObj.percent),
                    transferred: progressObj.transferred,
                    total: progressObj.total,
                    bytesPerSecond: progressObj.bytesPerSecond
                });
            }
        });
        electron_updater_1.autoUpdater.on('update-downloaded', () => {
            log.info('Обновление загружено');
            if (this.mainWindow) {
                this.mainWindow.webContents.send('update-downloaded');
            }
        });
        // 🔍 Обновление не найдено
        electron_updater_1.autoUpdater.on('update-not-available', () => {
            log.info('Обновление не найдено - используется последняя версия');
            if (this.mainWindow) {
                this.mainWindow.webContents.send('update-not-available');
            }
        });
    }
    setupAppHandlers() {
        electron_1.app.whenReady().then(async () => {
            this.createTray();
            this.createWindow();
            this.setupAutoLaunch();
            // 🔄 Настройка автообновления
            this.setupAutoUpdater();
            // 🆕 Проверка первого запуска и предложение включить автозапуск
            await this.checkFirstRunAndPromptAutoLaunch();
            // 🔗 Автоматическое подключение к последнему ресторану
            await this.autoConnectToRestaurant();
            // Проверка подключения при запуске
            this.checkConnection();
        });
        electron_1.app.on('window-all-closed', () => {
            // На macOS приложения обычно остаются активными
            if (process.platform !== 'darwin') {
                electron_1.app.quit();
            }
        });
        electron_1.app.on('activate', () => {
            if (electron_1.BrowserWindow.getAllWindows().length === 0) {
                this.createWindow();
            }
        });
        electron_1.app.on('before-quit', () => {
            this.isQuiting = true;
            this.socketManager.disconnect();
        });
    }
    setupIpcHandlers() {
        log.info('🔧 MAIN: Настройка IPC обработчиков...');
        // Настройки
        electron_1.ipcMain.handle('get-settings', () => {
            return store.store;
        });
        electron_1.ipcMain.handle('save-settings', (_, settings) => {
            // Удаляем serverUrl из настроек - он теперь захардкожен
            const { serverUrl, ...settingsToSave } = settings;
            Object.keys(settingsToSave).forEach(key => {
                store.set(key, settingsToSave[key]);
            });
            // Применяем изменения
            if (settings.restaurantCode) {
                this.socketManager.setRestaurantCode(settings.restaurantCode);
            }
            // 🔑 Обновляем токен в socket manager
            if (settings.agentToken !== undefined) {
                this.socketManager.setAgentToken(settings.agentToken);
            }
            if (settings.autoLaunch !== undefined) {
                this.setupAutoLaunch();
            }
            return { success: true };
        });
        // Подключение
        electron_1.ipcMain.handle('connect-to-restaurant', (_, code) => {
            return this.socketManager.connectToRestaurant(code);
        });
        electron_1.ipcMain.handle('disconnect', () => {
            this.socketManager.disconnect();
            return { success: true };
        });
        electron_1.ipcMain.handle('get-connection-status', () => {
            return {
                status: this.connectionStatus,
                serverUrl: store.get('serverUrl'),
                restaurantCode: store.get('restaurantCode')
            };
        });
        // Принтеры
        electron_1.ipcMain.handle('get-printers', async () => {
            return this.printerManager.getPrinters();
        });
        electron_1.ipcMain.handle('test-printer', async (_, printerName) => {
            return this.printerManager.testPrint(printerName);
        });
        // Окно
        electron_1.ipcMain.handle('minimize-to-tray', () => {
            if (this.mainWindow) {
                this.mainWindow.hide();
            }
        });
        electron_1.ipcMain.handle('show-window', () => {
            this.showWindow();
        });
        // Автообновления
        electron_1.ipcMain.handle('check-for-updates', () => {
            electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
        });
        electron_1.ipcMain.handle('restart-and-update', () => {
            electron_updater_1.autoUpdater.quitAndInstall();
        });
        // Системные
        electron_1.ipcMain.handle('get-app-version', () => {
            // Возвращаем версию приложения из package.json, а не версию Electron
            return process.env.npm_package_version || '1.1.2';
        });
        electron_1.ipcMain.handle('open-logs', () => {
            electron_1.shell.openPath(log.transports.file.getFile().path);
        });
        electron_1.ipcMain.handle('clear-logs', async () => {
            try {
                const logFilePath = log.transports.file.getFile().path;
                const dir = path.dirname(logFilePath);
                // Временно отключаем file transport
                const originalLevel = log.transports.file.level;
                log.transports.file.level = false;
                // Очищаем файл
                await fs_1.promises.writeFile(logFilePath, '');
                // Включаем обратно
                log.transports.file.level = originalLevel;
                log.info('🗑️ Логи очищены пользователем');
                return { success: true };
            }
            catch (error) {
                log.error('❌ Ошибка при очистке логов:', error);
                return { success: false, error: String(error) };
            }
        });
        log.info('✅ MAIN: IPC обработчики настроены');
    }
    createTray() {
        // Используем иконку из файла для лучшей совместимости с Windows
        const iconPath = process.platform === 'win32'
            ? path.join(__dirname, '../../assets/tray-icon.ico') // Windows: .ico
            : path.join(__dirname, '../../assets/tray-icon.png'); // Mac/Linux: .png
        let trayIcon;
        try {
            if (fs.existsSync(iconPath)) {
                trayIcon = electron_1.nativeImage.createFromPath(iconPath);
                log.info(`✅ Иконка трея загружена из: ${iconPath}`);
            }
            else {
                // Fallback: простая белая точка для template mode
                log.warn(`⚠️ Файл иконки не найден: ${iconPath}, использую fallback`);
                trayIcon = electron_1.nativeImage.createEmpty();
                trayIcon = electron_1.nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAB1SURBVDiNY/z//z8DJYCJgUIwqmFUw6gGdA0MZIDXgGzEBqgCRg0PMNAP////H4/m////M0DYIDYIg/gM////ZwTxQXwYBtFgNogN4jPAwMAAYoP4IDaIzcBAAw1gMoiPT8NoBaNgFIyCUTAKRsEooD4AABm1Ky6D/o8vAAAAAElFTkSuQmCC');
            }
        }
        catch (error) {
            log.error('Ошибка загрузки иконки трея:', error);
            trayIcon = electron_1.nativeImage.createEmpty();
        }
        // ВАЖНО: Template режим только для macOS (для автоадаптации к теме)
        if (process.platform === 'darwin') {
            trayIcon.setTemplateImage(true);
        }
        this.tray = new electron_1.Tray(trayIcon);
        const contextMenu = electron_1.Menu.buildFromTemplate([
            {
                label: 'CloudChef Print Agent',
                type: 'normal',
                enabled: false
            },
            { type: 'separator' },
            {
                label: `Статус: ${this.getStatusText()}`,
                type: 'normal',
                enabled: false
            },
            { type: 'separator' },
            {
                label: 'Показать настройки',
                type: 'normal',
                click: () => this.showWindow()
            },
            {
                label: 'Проверить подключение',
                type: 'normal',
                click: () => this.checkConnection()
            },
            { type: 'separator' },
            {
                label: 'Выход',
                type: 'normal',
                click: () => {
                    this.isQuiting = true;
                    electron_1.app.quit();
                }
            }
        ]);
        this.tray.setContextMenu(contextMenu);
        this.tray.setToolTip('CloudChef Print Agent');
        this.tray.on('click', () => {
            this.showWindow();
        });
        this.tray.on('double-click', () => {
            this.showWindow();
        });
    }
    createWindow() {
        const bounds = store.get('windowBounds');
        this.mainWindow = new electron_1.BrowserWindow({
            width: bounds.width,
            height: bounds.height,
            x: bounds.x,
            y: bounds.y,
            minWidth: 600,
            minHeight: 500,
            // icon: path.join(__dirname, '../../assets/icon.png'), // Отключаем пока иконку
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../preload/preload.js')
            },
            show: false,
            titleBarStyle: 'default' // Нормальный заголовок для всех платформ
        });
        // Загрузка UI
        if (process.env.NODE_ENV === 'development') {
            this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
            this.mainWindow.webContents.openDevTools();
        }
        else {
            this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
        }
        // Обработчики окна
        this.mainWindow.on('ready-to-show', () => {
            if (this.mainWindow) {
                // 🚀 При автозапуске сворачиваем в трей, иначе показываем окно
                const isAutoLaunched = electron_1.app.getLoginItemSettings().wasOpenedAtLogin;
                const shouldStartMinimized = store.get('startMinimized');
                if (isAutoLaunched && shouldStartMinimized) {
                    log.info('🚀 Автозапуск: окно свернуто в трей');
                    this.mainWindow.hide();
                    if (store.get('notifications')) {
                        new electron_1.Notification({
                            title: 'CloudChef Print Agent',
                            body: '🚀 Агент запущен и свёрнут в трей',
                            silent: true
                        }).show();
                    }
                }
                else {
                    log.info('👤 Обычный запуск: показываем окно');
                    this.mainWindow.show();
                }
            }
        });
        this.mainWindow.on('close', (event) => {
            if (!this.isQuiting) {
                // При обычном закрытии (не через "Выход") всегда сворачиваем в трей
                event.preventDefault();
                this.mainWindow?.hide();
                if (store.get('notifications')) {
                    new electron_1.Notification({
                        title: 'CloudChef Print Agent',
                        body: 'Приложение свернуто в системный трей. Используйте "Выход" в трее для полного закрытия.',
                        silent: true
                    }).show();
                }
            }
            else {
                // Сохранение размеров окна при полном выходе
                if (this.mainWindow) {
                    const bounds = this.mainWindow.getBounds();
                    store.set('windowBounds', bounds);
                }
            }
        });
        this.mainWindow.on('minimize', (event) => {
            if (store.get('minimizeToTray') && this.tray) {
                event.preventDefault();
                this.mainWindow?.hide();
                if (store.get('notifications')) {
                    new electron_1.Notification({
                        title: 'CloudChef Print Agent',
                        body: 'Приложение свернуто в системный трей',
                        silent: true
                    }).show();
                }
            }
        });
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });
    }
    showWindow() {
        if (this.mainWindow) {
            if (this.mainWindow.isMinimized()) {
                this.mainWindow.restore();
            }
            this.mainWindow.show();
            this.mainWindow.focus();
        }
        else {
            this.createWindow();
        }
    }
    async setupAutoLaunch() {
        const shouldAutoLaunch = store.get('autoLaunch');
        try {
            const launcher = getAutoLauncher();
            const isEnabled = await launcher.isEnabled();
            if (shouldAutoLaunch) {
                // 🔧 ИСПРАВЛЕНИЕ: Принудительно пересоздаём запись для обновления пути
                // Это важно после обновления приложения или переустановки
                if (isEnabled) {
                    log.info('⚙️ Обнаружена существующая запись автозапуска, обновляем путь...');
                    await launcher.disable(); // Удаляем старую запись
                }
                await launcher.enable(); // Создаём новую с актуальным путём
                log.info('✅ Автозапуск включен (путь обновлён)');
            }
            else if (isEnabled) {
                await launcher.disable();
                log.info('❌ Автозапуск отключен');
            }
        }
        catch (error) {
            log.error('❌ Ошибка настройки автозапуска:', error);
        }
    }
    // 🆕 Проверка первого запуска и предложение включить автозапуск
    async checkFirstRunAndPromptAutoLaunch() {
        const isFirstRun = store.get('isFirstRun');
        // Если это не первый запуск, выходим
        if (!isFirstRun) {
            return;
        }
        log.info(`🆕 Первый запуск агента на ${process.platform} - проверяем автозапуск`);
        try {
            // Проверяем текущее состояние автозапуска в системе
            const launcher = getAutoLauncher();
            const isAutoLaunchEnabled = await launcher.isEnabled();
            const autoLaunchSetting = store.get('autoLaunch');
            log.info('Состояние автозапуска:', {
                systemAutoLaunch: isAutoLaunchEnabled,
                settingAutoLaunch: autoLaunchSetting,
                platform: process.platform
            });
            // Если автозапуск уже включен (в системе или настройках), не показываем popup
            if (isAutoLaunchEnabled || autoLaunchSetting) {
                log.info('Автозапуск уже включен, popup не нужен');
                store.set('isFirstRun', false); // Больше не первый запуск
                return;
            }
            // Определяем название ОС для диалога
            const osName = process.platform === 'win32' ? 'Windows' :
                process.platform === 'darwin' ? 'macOS' :
                    'Linux';
            // Показываем диалог с предложением включить автозапуск
            const result = await electron_1.dialog.showMessageBox({
                type: 'question',
                title: 'CloudChef Print Agent - Автозапуск',
                message: `🚀 Включить автозапуск с ${osName}?`,
                detail: `CloudChef Print Agent может автоматически запускаться при включении компьютера и работать в фоне в системном трее.\n\nЭто обеспечит постоянную готовность агента к получению команд печати от веб-приложения.`,
                buttons: ['✅ Да, включить автозапуск', '❌ Нет, запускать вручную'],
                defaultId: 0, // Первая кнопка по умолчанию
                cancelId: 1,
                noLink: true,
                icon: electron_1.nativeImage.createFromPath(path.join(__dirname, '../../../assets/icon.png'))
            });
            if (result.response === 0) {
                // Пользователь согласился включить автозапуск
                try {
                    await launcher.enable();
                    store.set('autoLaunch', true);
                    log.info('✅ Пользователь включил автозапуск при первом запуске');
                    // Показываем тихое уведомление об успехе (без звука)
                    new electron_1.Notification({
                        title: 'CloudChef Print Agent',
                        body: '✅ Автозапуск включен! Агент будет запускаться автоматически.',
                        silent: true
                    }).show();
                }
                catch (error) {
                    log.error('Ошибка включения автозапуска:', error);
                    // Показываем тихое уведомление об ошибке (без звука)
                    new electron_1.Notification({
                        title: 'CloudChef Print Agent',
                        body: '❌ Не удалось включить автозапуск. Можно настроить в настройках.',
                        silent: true
                    }).show();
                }
            }
            else {
                // Пользователь отказался от автозапуска
                log.info('❌ Пользователь отказался от автозапуска при первом запуске');
                store.set('autoLaunch', false);
                // Показываем информационное уведомление
                new electron_1.Notification({
                    title: 'CloudChef Print Agent',
                    body: 'ℹ️ Автозапуск отключен. Можно включить в настройках агента.',
                    silent: true
                }).show();
            }
        }
        catch (error) {
            log.error('Ошибка проверки автозапуска при первом запуске:', error);
        }
        finally {
            // В любом случае помечаем, что первый запуск завершен
            store.set('isFirstRun', false);
            log.info('🏁 Первый запуск завершен');
        }
    }
    updateTrayMenu() {
        // Обновляем только меню без пересоздания tray
        if (!this.tray)
            return;
        const contextMenu = electron_1.Menu.buildFromTemplate([
            {
                label: 'CloudChef Print Agent',
                type: 'normal',
                enabled: false
            },
            { type: 'separator' },
            {
                label: `Статус: ${this.getStatusText()}`,
                type: 'normal',
                enabled: false
            },
            { type: 'separator' },
            {
                label: 'Показать настройки',
                type: 'normal',
                click: () => this.showWindow()
            },
            {
                label: 'Проверить подключение',
                type: 'normal',
                click: () => this.checkConnection()
            },
            { type: 'separator' },
            {
                label: 'Выход',
                type: 'normal',
                click: () => {
                    this.isQuiting = true;
                    electron_1.app.quit();
                }
            }
        ]);
        this.tray.setContextMenu(contextMenu);
    }
    onConnectionChange(status) {
        this.connectionStatus = status;
        // Обновление tray меню (БЕЗ пересоздания tray)
        this.updateTrayMenu();
        // Отправка статуса в рендер процесс
        if (this.mainWindow) {
            this.mainWindow.webContents.send('connection-status-changed', status);
        }
        // Уведомления
        if (store.get('notifications')) {
            let title = 'CloudChef Print Agent';
            let body = '';
            switch (status) {
                case 'connected':
                    body = 'Подключено к ресторану';
                    break;
                case 'server-connected':
                    body = 'Подключено к серверу';
                    break;
                case 'disconnected':
                    body = 'Отключено';
                    break;
                case 'error':
                    body = 'Ошибка подключения';
                    break;
            }
            if (body) {
                new electron_1.Notification({ title, body, silent: true }).show();
            }
        }
    }
    async autoConnectToRestaurant() {
        const savedCode = store.get('restaurantCode');
        if (savedCode) {
            log.info(`🔗 Автоматическое подключение к ресторану: ${savedCode}`);
            try {
                await this.socketManager.connectToRestaurant(savedCode);
                log.info('✅ Автоматически подключено к ресторану');
                if (store.get('notifications')) {
                    new electron_1.Notification({
                        title: 'CloudChef Print Agent',
                        body: `Подключено к ресторану (код: ${savedCode})`,
                        silent: true
                    }).show();
                }
            }
            catch (error) {
                log.error('❌ Ошибка автоматического подключения:', error);
            }
        }
        else {
            log.info('ℹ️ Нет сохранённого кода ресторана для автоподключения');
        }
    }
    checkConnection() {
        this.socketManager.checkConnection();
    }
    getStatusText() {
        switch (this.connectionStatus) {
            case 'connected': return '🟢 Подключено';
            case 'server-connected': return '🟡 Сервер подключен';
            case 'disconnected': return '🔴 Отключено';
            case 'error': return '❌ Ошибка';
            default: return '⚪ Неизвестно';
        }
    }
    onPrintJob(job) {
        log.info('🖨️ MAIN: ВХОД В onPrintJob метод!');
        log.info('🖨️ MAIN: Job data:', job);
        log.info('Получено задание на печать:', job);
        log.info('🔔 MAIN: Проверка уведомлений...');
        if (store.get('notifications')) {
            log.info('🔔 MAIN: Показываю внутреннее уведомление...');
            // Отключено: Системные уведомления заменены внутренними в UI
            // new Notification({
            //   title: 'Новое задание на печать',
            //   body: `Продукт: ${job.labelData.category}\\nПовар: ${job.labelData.preparerName}`,
            //   silent: true
            // }).show();
            log.info('✅ MAIN: Уведомление показано!');
        }
        else {
            log.info('⚪ MAIN: Уведомления отключены');
        }
        // Отправка в рендер процесс
        log.info('🔗 MAIN: Отправка IPC в renderer процесс...');
        if (this.mainWindow) {
            log.info('🔗 MAIN: mainWindow найден, отправляю print-job-received');
            this.mainWindow.webContents.send('print-job-received', job);
            log.info('✅ MAIN: IPC отправлен в renderer!');
        }
        else {
            log.error('❌ MAIN: mainWindow НЕ НАЙДЕН! Не могу отправить IPC');
        }
        // Печать
        this.executePrint(job);
    }
    async executePrint(job) {
        const selectedPrinter = store.get('selectedPrinter');
        log.info('🖨️ MAIN: Запуск executePrint', {
            jobId: job.jobId,
            labelId: job.labelData?.labelId,
            selectedPrinter
        });
        if (!selectedPrinter) {
            log.error('Принтер не выбран');
            this.socketManager.sendPrintResult(job.jobId, 'error', 'Принтер не выбран');
            return;
        }
        try {
            // Получаем офсеты из настроек
            const offsetHorizontal = store.get('labelOffsetHorizontal') || 0;
            const offsetVertical = store.get('labelOffsetVertical') || 0;
            log.info('🖨️ MAIN: Используем офсеты печати', { offsetHorizontal, offsetVertical });
            const result = await this.printerManager.printLabel(selectedPrinter, job.labelData, offsetHorizontal, offsetVertical);
            if (result.success) {
                log.info(`Этикетка напечатана успешно: ${job.jobId}`);
                this.socketManager.sendPrintResult(job.jobId, 'success', 'Этикетка напечатана успешно');
                // Отключено: Используются только внутренние уведомления в UI
                // if (store.get('notifications')) {
                //   new Notification({
                //     title: 'Печать завершена',
                //     body: `Этикетка "${job.labelData.category}" напечатана`,
                //     silent: true
                //   }).show();
                // }
            }
            else {
                log.error('Ошибка печати: ' + (result.error || 'Неизвестная ошибка'));
                this.socketManager.sendPrintResult(job.jobId, 'error', result.error || 'Ошибка печати');
                return;
            }
        }
        catch (error) {
            log.error('Ошибка печати:', error);
            this.socketManager.sendPrintResult(job.jobId, 'error', error instanceof Error ? error.message : String(error));
            // Отключено: Используются только внутренние уведомления в UI
            // if (store.get('notifications')) {
            //   new Notification({
            //     title: 'Ошибка печати',
            //     body: `Не удалось напечатать этикетку: ${error}`,
            //     silent: true
            //   }).show();
            // }
        }
    }
}
// Запуск приложения
new CloudChefPrintAgent();
//# sourceMappingURL=main.js.map