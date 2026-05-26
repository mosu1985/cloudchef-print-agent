import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification, shell, dialog, Event, powerMonitor } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as log from 'electron-log';
import Store from 'electron-store';
import AutoLaunch from 'auto-launch';
import { SocketManager } from './socket-manager';
import { PrinterManager } from './printer-manager';
import { AppConfig, ConnectionStatus, PrintJob, AppSettings } from '../shared/types';

// 📝 Настройка логирования - ИСПРАВЛЕНИЕ EPIPE ОШИБКИ
log.transports.file.level = 'info';
log.transports.console.level = false; // Отключаем консольный вывод для исправления EPIPE

// 💾 Настройка хранилища настроек
const store = new Store<AppSettings>({
  defaults: {
    serverUrl: 'https://cloudchef-print-server.onrender.com',
    restaurantCode: '',
    agentToken: '', // 🔑 Токен аутентификации агента (будет сгенерирован на сервере)
    selectedPrinter: '',
    labelOffsetHorizontal: 0, // 🖨️ Горизонтальное смещение в мм
    labelOffsetVertical: 0,    // 🖨️ Вертикальное смещение в мм
    autoLaunch: false,
    notifications: true,
    minimizeToTray: true,
    startMinimized: true, // 🚀 Запускаться свёрнутым в трей при автозапуске
    isFirstRun: true, // 🆕 По умолчанию считаем первым запуском
    windowBounds: { width: 800, height: 600, x: undefined, y: undefined }
  }
});

// 🚀 Автозапуск - конфигурация для всех ОС (lazy initialization)
let autoLauncher: AutoLaunch | null = null;

function getAutoLauncher(): AutoLaunch {
  if (!autoLauncher) {
    autoLauncher = new AutoLaunch({
      name: 'CloudChef Print Agent',
      path: app.getPath('exe')
    });
    log.info(`Автозапуск настроен для ${process.platform}:`, {
      name: 'CloudChef Print Agent',
      path: app.getPath('exe'),
      platform: process.platform
    });
  }
  return autoLauncher;
}

class CloudChefPrintAgent {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private socketManager: SocketManager;
  private printerManager: PrinterManager;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private isQuiting = false;

  constructor() {
    log.info('CloudChef Print Agent запускается...');
    
    this.socketManager = new SocketManager(store.get('serverUrl'), this.onConnectionChange.bind(this));
    this.printerManager = new PrinterManager();
    
    // 🔑 Загружаем токен из настроек
    const savedToken = store.get('agentToken');
    if (savedToken) {
      this.socketManager.setAgentToken(savedToken);
      log.info('🔑 Токен агента загружен из настроек');
    } else {
      log.warn('⚠️ Токен агента не найден - требуется настройка');
    }
    
    // Привязка метода обработки печати
    (this.socketManager as any).onPrintJob = this.onPrintJob.bind(this);
    
    log.info('Менеджеры инициализированы');

    // Настройка обработчиков приложения
    this.setupAppHandlers();

    // Настройка IPC обработчиков
    this.setupIpcHandlers();
  }

  private setupAutoUpdater(): void {
    autoUpdater.logger = log;
    
    // 🔄 Проверка обновлений при старте
    autoUpdater.checkForUpdatesAndNotify();

    // ⏰ Периодическая проверка обновлений каждые 3 часа
    setInterval(() => {
      log.info('🔍 Периодическая проверка обновлений...');
      autoUpdater.checkForUpdatesAndNotify();
    }, 3 * 60 * 60 * 1000); // 3 часа

    autoUpdater.on('update-available', (info) => {
      log.info('🎉 Обновление доступно:', info.version);
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-available');
      }
    });

    // 📊 Прогресс загрузки обновления
    autoUpdater.on('download-progress', (progressObj) => {
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

    autoUpdater.on('update-downloaded', () => {
      log.info('Обновление загружено');
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-downloaded');
      }
    });
    
    // 🔍 Обновление не найдено
    autoUpdater.on('update-not-available', () => {
      log.info('Обновление не найдено - используется последняя версия');
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-not-available');
      }
    });
  }

  private setupAppHandlers(): void {
    app.whenReady().then(async () => {
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

      // 💤 Мгновенный реконнект при пробуждении системы / разблокировке экрана
      // (ноутбук ресторана засыпает на ночь, моргает Wi-Fi — не ждём таймер)
      powerMonitor.on('resume', () => {
        log.info('💤➡️ Система проснулась — проверяем подключение');
        this.checkConnection();
      });
      powerMonitor.on('unlock-screen', () => {
        log.info('🔓 Экран разблокирован — проверяем подключение');
        this.checkConnection();
      });
    });

    app.on('window-all-closed', () => {
      // На macOS приложения обычно остаются активными
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    app.on('before-quit', () => {
      this.isQuiting = true;
      this.socketManager.disconnect();
    });
  }

  private setupIpcHandlers(): void {
    log.info('🔧 MAIN: Настройка IPC обработчиков...');
    
    // Настройки
    ipcMain.handle('get-settings', () => {
      return store.store;
    });

    ipcMain.handle('save-settings', (_, settings: Partial<AppSettings>) => {
      // Удаляем serverUrl из настроек - он теперь захардкожен
      const { serverUrl, ...settingsToSave } = settings;
      
      Object.keys(settingsToSave).forEach(key => {
        store.set(key as keyof AppSettings, (settingsToSave as any)[key]);
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
    ipcMain.handle('connect-to-restaurant', (_, code: string) => {
      return this.socketManager.connectToRestaurant(code);
    });

    ipcMain.handle('disconnect', () => {
      this.socketManager.disconnect();
      return { success: true };
    });

    ipcMain.handle('get-connection-status', () => {
      return {
        status: this.connectionStatus,
        serverUrl: store.get('serverUrl'),
        restaurantCode: store.get('restaurantCode')
      };
    });

    // Принтеры
    ipcMain.handle('get-printers', async () => {
      return this.printerManager.getPrinters();
    });

    ipcMain.handle('test-printer', async (_, printerName: string) => {
      return this.printerManager.testPrint(printerName);
    });

    // Окно
    ipcMain.handle('minimize-to-tray', () => {
      if (this.mainWindow) {
        this.mainWindow.hide();
      }
    });

    ipcMain.handle('show-window', () => {
      this.showWindow();
    });

    // Автообновления
    ipcMain.handle('check-for-updates', () => {
      autoUpdater.checkForUpdatesAndNotify();
    });

    ipcMain.handle('restart-and-update', () => {
      // Полный выход, чтобы обработчик close не свернул окно в трей
      this.isQuiting = true;
      // Тихая установка (isSilent=true) — без диалога "закройте приложение";
      // isForceRunAfter=true — перезапустить агент после обновления
      autoUpdater.quitAndInstall(true, true);
    });

    // Системные
    ipcMain.handle('get-app-version', () => {
      // app.getVersion() читает версию из package.json внутри собранного
      // приложения — работает и в установленном агенте, и в разработке
      return app.getVersion();
    });

    ipcMain.handle('open-logs', () => {
      shell.openPath(log.transports.file.getFile().path);
    });

    ipcMain.handle('clear-logs', async () => {
      try {
        const logFilePath = log.transports.file.getFile().path;
        const dir = path.dirname(logFilePath);
        
        // Временно отключаем file transport
        const originalLevel = log.transports.file.level;
        log.transports.file.level = false;
        
        // Очищаем файл
        await fsPromises.writeFile(logFilePath, '');
        
        // Включаем обратно
        log.transports.file.level = originalLevel;
        
        log.info('🗑️ Логи очищены пользователем');
        return { success: true };
      } catch (error) {
        log.error('❌ Ошибка при очистке логов:', error);
        return { success: false, error: String(error) };
      }
    });
    
    log.info('✅ MAIN: IPC обработчики настроены');
  }

  private createTray(): void {
    // Используем иконку из файла для лучшей совместимости с Windows
    const iconPath = process.platform === 'win32' 
      ? path.join(__dirname, '../../assets/tray-icon.ico')  // Windows: .ico
      : path.join(__dirname, '../../assets/tray-icon.png'); // Mac/Linux: .png
    
    let trayIcon: Electron.NativeImage;
    
    try {
      if (fs.existsSync(iconPath)) {
        trayIcon = nativeImage.createFromPath(iconPath);
        log.info(`✅ Иконка трея загружена из: ${iconPath}`);
      } else {
        // Fallback: простая белая точка для template mode
        log.warn(`⚠️ Файл иконки не найден: ${iconPath}, использую fallback`);
        trayIcon = nativeImage.createEmpty();
        trayIcon = nativeImage.createFromDataURL(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAB1SURBVDiNY/z//z8DJYCJgUIwqmFUw6gGdA0MZIDXgGzEBqgCRg0PMNAP////H4/m////M0DYIDYIg/gM////ZwTxQXwYBtFgNogN4jPAwMAAYoP4IDaIzcBAAw1gMoiPT8NoBaNgFIyCUTAKRsEooD4AABm1Ky6D/o8vAAAAAElFTkSuQmCC'
        );
      }
    } catch (error) {
      log.error('Ошибка загрузки иконки трея:', error);
      trayIcon = nativeImage.createEmpty();
    }
    
    // ВАЖНО: Template режим только для macOS (для автоадаптации к теме)
    if (process.platform === 'darwin') {
      trayIcon.setTemplateImage(true);
    }
    
    this.tray = new Tray(trayIcon);
    
    const contextMenu = Menu.buildFromTemplate([
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
          app.quit();
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

  private createWindow(): void {
    const bounds = store.get('windowBounds');
    
    this.mainWindow = new BrowserWindow({
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
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    // Обработчики окна
    this.mainWindow.on('ready-to-show', () => {
      if (this.mainWindow) {
        // 🚀 При автозапуске сворачиваем в трей, иначе показываем окно
        const isAutoLaunched = app.getLoginItemSettings().wasOpenedAtLogin;
        const shouldStartMinimized = store.get('startMinimized');
        
        if (isAutoLaunched && shouldStartMinimized) {
          log.info('🚀 Автозапуск: окно свернуто в трей');
          this.mainWindow.hide();
          
          if (store.get('notifications')) {
            new Notification({
              title: 'CloudChef Print Agent',
              body: '🚀 Агент запущен и свёрнут в трей',
              silent: true
            }).show();
          }
        } else {
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
          new Notification({
            title: 'CloudChef Print Agent',
            body: 'Приложение свернуто в системный трей. Используйте "Выход" в трее для полного закрытия.',
            silent: true
          }).show();
        }
      } else {
        // Сохранение размеров окна при полном выходе
        if (this.mainWindow) {
          const bounds = this.mainWindow.getBounds();
          store.set('windowBounds', bounds);
        }
      }
    });

    (this.mainWindow as any).on('minimize', (event: Event) => {
      if (store.get('minimizeToTray') && this.tray) {
        event.preventDefault();
        this.mainWindow?.hide();
        
        if (store.get('notifications')) {
          new Notification({
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

  private showWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();
    } else {
      this.createWindow();
    }
  }

  private async setupAutoLaunch(): Promise<void> {
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
      } else if (isEnabled) {
        await launcher.disable();
        log.info('❌ Автозапуск отключен');
      }
    } catch (error) {
      log.error('❌ Ошибка настройки автозапуска:', error);
    }
  }

  // 🆕 Проверка первого запуска и предложение включить автозапуск
  private async checkFirstRunAndPromptAutoLaunch(): Promise<void> {
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
      const result = await dialog.showMessageBox({
        type: 'question',
        title: 'CloudChef Print Agent - Автозапуск',
        message: `🚀 Включить автозапуск с ${osName}?`,
        detail: `CloudChef Print Agent может автоматически запускаться при включении компьютера и работать в фоне в системном трее.\n\nЭто обеспечит постоянную готовность агента к получению команд печати от веб-приложения.`,
        buttons: ['✅ Да, включить автозапуск', '❌ Нет, запускать вручную'],
        defaultId: 0, // Первая кнопка по умолчанию
        cancelId: 1,
        noLink: true,
        icon: nativeImage.createFromPath(path.join(__dirname, '../../../assets/icon.png'))
      });
      
      if (result.response === 0) {
        // Пользователь согласился включить автозапуск
        try {
          await launcher.enable();
          store.set('autoLaunch', true);
          log.info('✅ Пользователь включил автозапуск при первом запуске');
          
          // Показываем тихое уведомление об успехе (без звука)
          new Notification({
            title: 'CloudChef Print Agent',
            body: '✅ Автозапуск включен! Агент будет запускаться автоматически.',
            silent: true
          }).show();
          
        } catch (error) {
          log.error('Ошибка включения автозапуска:', error);
          
          // Показываем тихое уведомление об ошибке (без звука)
          new Notification({
            title: 'CloudChef Print Agent',
            body: '❌ Не удалось включить автозапуск. Можно настроить в настройках.',
            silent: true
          }).show();
        }
      } else {
        // Пользователь отказался от автозапуска
        log.info('❌ Пользователь отказался от автозапуска при первом запуске');
        store.set('autoLaunch', false);
        
        // Показываем информационное уведомление
        new Notification({
          title: 'CloudChef Print Agent',
          body: 'ℹ️ Автозапуск отключен. Можно включить в настройках агента.',
          silent: true
        }).show();
      }
      
    } catch (error) {
      log.error('Ошибка проверки автозапуска при первом запуске:', error);
    } finally {
      // В любом случае помечаем, что первый запуск завершен
      store.set('isFirstRun', false);
      log.info('🏁 Первый запуск завершен');
    }
  }

  private updateTrayMenu(): void {
    // Обновляем только меню без пересоздания tray
    if (!this.tray) return;
    
    const contextMenu = Menu.buildFromTemplate([
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
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  private onConnectionChange(status: ConnectionStatus): void {
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
        new Notification({ title, body, silent: true }).show();
      }
    }
  }

  private async autoConnectToRestaurant(): Promise<void> {
    const savedCode = store.get('restaurantCode');
    
    if (savedCode) {
      log.info(`🔗 Автоматическое подключение к ресторану: ${savedCode}`);
      
      try {
        await this.socketManager.connectToRestaurant(savedCode);
        log.info('✅ Автоматически подключено к ресторану');
        
        if (store.get('notifications')) {
          new Notification({
            title: 'CloudChef Print Agent',
            body: `Подключено к ресторану (код: ${savedCode})`,
            silent: true
          }).show();
        }
      } catch (error) {
        log.error('❌ Ошибка автоматического подключения:', error);
      }
    } else {
      log.info('ℹ️ Нет сохранённого кода ресторана для автоподключения');
    }
  }

  private checkConnection(): void {
    this.socketManager.checkConnection();
  }

  private getStatusText(): string {
    switch (this.connectionStatus) {
      case 'connected': return '🟢 Подключено';
      case 'server-connected': return '🟡 Сервер подключен';
      case 'reconnecting': return '🟡 Переподключение...';
      case 'disconnected': return '🔴 Отключено';
      case 'error': return '❌ Ошибка';
      default: return '⚪ Неизвестно';
    }
  }

  private onPrintJob(job: PrintJob): void {
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
    } else {
      log.info('⚪ MAIN: Уведомления отключены');
    }
    
    // Отправка в рендер процесс
    log.info('🔗 MAIN: Отправка IPC в renderer процесс...');
    if (this.mainWindow) {
      log.info('🔗 MAIN: mainWindow найден, отправляю print-job-received');
      this.mainWindow.webContents.send('print-job-received', job);
      log.info('✅ MAIN: IPC отправлен в renderer!');
    } else {
      log.error('❌ MAIN: mainWindow НЕ НАЙДЕН! Не могу отправить IPC');
    }
    
    // Печать
    this.executePrint(job);
  }

  private async executePrint(job: PrintJob): Promise<void> {
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
      const offsetHorizontal = (store.get('labelOffsetHorizontal') as number) || 0;
      const offsetVertical = (store.get('labelOffsetVertical') as number) || 0;
      log.info('🖨️ MAIN: Используем офсеты печати', { offsetHorizontal, offsetVertical });
      
      const result = await this.printerManager.printLabel(
        selectedPrinter, 
        job.labelData,
        offsetHorizontal,
        offsetVertical
      );
      
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
      } else {
        log.error('Ошибка печати: ' + (result.error || 'Неизвестная ошибка'));
        this.socketManager.sendPrintResult(job.jobId, 'error', result.error || 'Ошибка печати');
        return;
      }
    } catch (error) {
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
