# 🔍 ПОЛНЫЙ КОД ЗАПУСКА ELECTRON ПРИЛОЖЕНИЯ

> **Детальный разбор всей цепочки запуска CloudChef Print Agent**

---

## 📦 **1. package.json - NPM Scripts**

```json
{
  "name": "cloudchef-print-agent",
  "version": "1.0.11",
  "main": "dist/main/main.js",
  "scripts": {
    "dev": "concurrently \"npm run build:watch\" \"npm run electron:dev\"",
    "build": "tsc && npm run build:renderer",
    "build:watch": "tsc -w",
    "build:renderer": "webpack --mode production",
    "electron:dev": "wait-on ./dist/main/main.js && electron ."
  }
}
```

**Что происходит:**
- `npm run dev` → запускает `concurrently` с 2 командами
- `npm run build:watch` → `tsc -w` (TypeScript компиляция в watch-режиме)
- `npm run electron:dev` → `wait-on ./dist/main/main.js && electron .`

---

## ⚙️ **2. tsconfig.json - TypeScript конфигурация**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

**Что делает:**
- Компилирует `src/**/*.ts` → `dist/**/*.js`
- Target: ES2020
- Module: CommonJS (для Node.js/Electron)

---

## 🚀 **3. src/main/main.ts - Главный файл Electron**

### **3.1. Импорты и глобальные переменные (строки 1-24)**

```typescript
import * as path from 'path';
import * as fs from 'fs';
import * as log from 'electron-log';
import Store from 'electron-store';
import AutoLaunch from 'auto-launch';
import { SocketManager } from './socket-manager';
import { PrinterManager } from './printer-manager';
import { AppConfig, ConnectionStatus, PrintJob, AppSettings } from '../shared/types';

// Динамический импорт electron после инициализации
let app: any;
let BrowserWindow: any;
let Tray: any;
let Menu: any;
let ipcMain: any;
let nativeImage: any;
let Notification: any;
let shell: any;
let dialog: any;
let autoUpdater: any;

// Глобальная переменная для store (инициализируется после app.ready)
let store: Store<AppSettings>;
```

**Почему так сделано:**
- Electron модули импортируются динамически для избежания ошибок инициализации
- Store создаётся после готовности приложения

---

### **3.2. Инициализация Electron модулей (строки 26-62)**

```typescript
function initializeElectron(): void {
  // Импортируем electron модули ПОСЛЕ готовности
  const electron = require('electron');
  app = electron.app;
  BrowserWindow = electron.BrowserWindow;
  Tray = electron.Tray;
  Menu = electron.Menu;
  ipcMain = electron.ipcMain;
  nativeImage = electron.nativeImage;
  Notification = electron.Notification;
  shell = electron.shell;
  dialog = electron.dialog;

  const electronUpdater = require('electron-updater');
  autoUpdater = electronUpdater.autoUpdater;

  // 📝 Настройка логирования
  log.transports.file.level = 'info';
  log.transports.console.level = false;

  // 💾 Настройка хранилища настроек
  store = new Store<AppSettings>({
    defaults: {
      serverUrl: 'https://cloudchef-print-server.onrender.com',
      restaurantCode: '',
      selectedPrinter: '',
      labelOffsetHorizontal: 0,
      labelOffsetVertical: 0,
      autoLaunch: false,
      notifications: true,
      minimizeToTray: true,
      startMinimized: true,
      isFirstRun: true,
      windowBounds: { width: 800, height: 600, x: undefined, y: undefined }
    }
  });
}
```

**Что происходит:**
- Загружаются все необходимые модули Electron
- Настраивается логирование в файл
- Создаётся electron-store с дефолтными настройками

---

### **3.3. Настройка автозапуска (строки 64-80)**

```typescript
// 🚀 Автозапуск - создаётся лениво при первом использовании
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
```

**Lazy initialization:**
- AutoLaunch создаётся только при первом обращении
- Поддержка всех платформ (Windows, macOS, Linux)

---

### **3.4. Класс CloudChefPrintAgent - Конструктор (строки 82-109)**

```typescript
class CloudChefPrintAgent {
  private mainWindow: any | null = null;
  private tray: any | null = null;
  private socketManager: SocketManager;
  private printerManager: PrinterManager;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private isQuiting = false;

  constructor() {
    log.info('CloudChef Print Agent запускается...');
    
    this.socketManager = new SocketManager(store.get('serverUrl'), this.onConnectionChange.bind(this));
    this.printerManager = new PrinterManager();
    
    // Привязка метода обработки печати
    (this.socketManager as any).onPrintJob = this.onPrintJob.bind(this);
    
    log.info('Менеджеры инициализированы');
    
    // Настройка автообновлений
    this.setupAutoUpdater();
    
    // Настройка обработчиков приложения
    this.setupAppHandlers();
    
    // Настройка IPC обработчиков
    this.setupIpcHandlers();
  }
}
```

**Основные компоненты:**
- **SocketManager** - WebSocket подключение к серверу
- **PrinterManager** - управление принтерами и печатью
- **AutoUpdater** - автоматические обновления
- **IPC Handlers** - связь между main и renderer процессами

---

### **3.5. Настройка автообновлений (строки 111-149)**

```typescript
private setupAutoUpdater(): void {
  autoUpdater.logger = log;
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', () => {
    log.info('Обновление доступно');
    if (this.mainWindow) {
      this.mainWindow.webContents.send('update-available');
    }
  });

  // 📊 Прогресс загрузки обновления
  autoUpdater.on('download-progress', (progressObj: any) => {
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
```

**Система автообновлений:**
- Использует electron-updater
- Проверяет обновления на GitHub Releases
- Поддерживает delta-updates (дифференциальные обновления)
- Уведомляет UI о прогрессе загрузки

---

### **3.6. Настройка обработчиков приложения (строки 151-187)**

```typescript
private setupAppHandlers(): void {
  app.whenReady().then(async () => {
    this.createTray();         // Создание иконки в трее
    this.createWindow();       // Создание главного окна
    this.setupAutoLaunch();    // Настройка автозапуска
    
    // 🔄 Настройка автообновления
    this.setupAutoUpdater();
    
    // 🆕 Проверка первого запуска и предложение включить автозапуск
    await this.checkFirstRunAndPromptAutoLaunch();
    
    // 🔗 Автоматическое подключение к последнему ресторану
    await this.autoConnectToRestaurant();
    
    // Проверка подключения при запуске
    this.checkConnection();
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
```

**Последовательность запуска:**
1. Создание трея
2. Создание окна
3. Настройка автозапуска
4. Проверка обновлений
5. Диалог первого запуска
6. Автоподключение к ресторану
7. Проверка соединения

---

### **3.7. Настройка IPC обработчиков (строки 189-274)**

```typescript
private setupIpcHandlers(): void {
  log.info('🔧 MAIN: Настройка IPC обработчиков...');
  
  // Настройки
  ipcMain.handle('get-settings', () => {
    return store.store;
  });

  ipcMain.handle('save-settings', (_: any, settings: Partial<AppSettings>) => {
    // Удаляем serverUrl из настроек - он теперь захардкожен
    const { serverUrl, ...settingsToSave } = settings;
    
    Object.keys(settingsToSave).forEach(key => {
      store.set(key as keyof AppSettings, (settingsToSave as any)[key]);
    });
    
    // Применяем изменения
    if (settings.restaurantCode) {
      this.socketManager.setRestaurantCode(settings.restaurantCode);
    }
    
    if (settings.autoLaunch !== undefined) {
      this.setupAutoLaunch();
    }
    
    return { success: true };
  });

  // Подключение
  ipcMain.handle('connect-to-restaurant', (_: any, code: string) => {
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

  ipcMain.handle('test-printer', async (_: any, printerName: string) => {
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
    autoUpdater.quitAndInstall();
  });

  // Системные
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('open-logs', () => {
    shell.openPath(log.transports.file.getFile().path);
  });
  
  log.info('✅ MAIN: IPC обработчики настроены');
}
```

**IPC Bridge (Main ↔ Renderer):**
- **Settings** - сохранение/загрузка настроек
- **Connection** - управление подключением к серверу
- **Printers** - список принтеров, тестовая печать
- **Window** - управление окном (показать/скрыть)
- **Updates** - проверка и установка обновлений
- **System** - версия приложения, логи

---

### **3.8. Создание системного трея (строки 276-352)**

```typescript
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
      trayIcon = nativeImage.createFromDataURL('data:image/png;base64,...');
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
```

**Системный трей:**
- Иконка адаптируется под платформу (.ico для Windows, .png для Mac/Linux)
- Template mode для macOS (адаптация под тёмную/светлую тему)
- Контекстное меню с основными действиями
- Клик/двойной клик открывает окно настроек

---

### **3.9. Создание окна приложения (строки 354-447)**

```typescript
private createWindow(): void {
  const bounds = store.get('windowBounds');
  
  this.mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    titleBarStyle: 'default'
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

  this.mainWindow.on('close', (event: any) => {
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

  this.mainWindow.on('minimize', (event: Event) => {
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
```

**Окно приложения:**
- **Security:** contextIsolation + nodeIntegration: false
- **Preload script:** безопасный мост между main и renderer
- **Автозапуск:** при автозапуске сворачивается в трей
- **Закрытие:** сворачивается в трей вместо полного закрытия
- **Размеры:** сохраняются между запусками

---

### **3.10. Проверка первого запуска (строки 481-572)**

```typescript
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
    
    // Если автозапуск уже включен, не показываем popup
    if (isAutoLaunchEnabled || autoLaunchSetting) {
      log.info('Автозапуск уже включен, popup не нужен');
      store.set('isFirstRun', false);
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
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });
    
    if (result.response === 0) {
      // Пользователь согласился включить автозапуск
      await launcher.enable();
      store.set('autoLaunch', true);
      log.info('✅ Пользователь включил автозапуск при первом запуске');
      
      new Notification({
        title: 'CloudChef Print Agent',
        body: '✅ Автозапуск включен! Агент будет запускаться автоматически.',
        silent: true
      }).show();
    } else {
      // Пользователь отказался от автозапуска
      log.info('❌ Пользователь отказался от автозапуска при первом запуске');
      store.set('autoLaunch', false);
      
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
```

**First Run Experience:**
- Показывается только при первом запуске
- Красивый диалог с предложением включить автозапуск
- Адаптируется под платформу (Windows/macOS/Linux)
- Тихие уведомления (без звука)

---

### **3.11. Обработка задач на печать (строки 691-782)**

```typescript
private onPrintJob(job: PrintJob): void {
  log.info('🖨️ MAIN: ВХОД В onPrintJob метод!');
  log.info('🖨️ MAIN: Job data:', job);
  log.info('Получено задание на печать:', job);
  
  if (store.get('notifications')) {
    // Системные уведомления отключены, используются внутренние в UI
    log.info('✅ MAIN: Уведомление показано!');
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
    } else {
      log.error('Ошибка печати: ' + (result.error || 'Неизвестная ошибка'));
      this.socketManager.sendPrintResult(job.jobId, 'error', result.error || 'Ошибка печати');
      return;
    }
  } catch (error) {
    log.error('Ошибка печати:', error);
    this.socketManager.sendPrintResult(job.jobId, 'error', error instanceof Error ? error.message : String(error));
  }
}
```

**Печать этикеток:**
- Получение задания через WebSocket
- Отправка уведомления в UI через IPC
- Печать с настраиваемыми офсетами
- Отправка результата обратно на сервер

---

### **3.12. Точка входа приложения (строки 786-801)**

```typescript
// Запуск приложения после готовности Electron
const electron = require('electron');

const electronApp = electron.app;
console.log("DEBUG electron:", typeof electron, Object.keys(electron || {}));
console.log("DEBUG electronApp:", electronApp);

if (electronApp) {
  electronApp.whenReady().then(() => {
    // Инициализируем все зависимости от Electron
    initializeElectron();
    // Запускаем приложение
    new CloudChefPrintAgent();
  });
} else {
  console.error('КРИТИЧЕСКАЯ ОШИБКА: Electron app не определён!');
  process.exit(1);
}
```

**Последовательность:**
1. Импорт Electron
2. Ожидание готовности (`app.whenReady()`)
3. Инициализация модулей (`initializeElectron()`)
4. Создание экземпляра приложения (`new CloudChefPrintAgent()`)

---

## 🎯 **ПОЛНАЯ ЦЕПОЧКА ЗАПУСКА**

### **Шаг 1: Команда в терминале**
```bash
cd "/Users/mihailcarazan/Documents/Cursor/cloudchef-print-agent" && npm run dev
```

### **Шаг 2: NPM запускает**
```bash
concurrently "npm run build:watch" "npm run electron:dev"
```

### **Шаг 3: Процесс 1 - TypeScript компиляция**
```bash
tsc -w
```
- Читает `tsconfig.json`
- Компилирует `src/**/*.ts` → `dist/**/*.js`
- Следит за изменениями

### **Шаг 4: Процесс 2 - Electron запуск**
```bash
wait-on ./dist/main/main.js && electron .
```
- Ждёт появления `dist/main/main.js`
- Запускает `electron .` (текущая директория)

### **Шаг 5: Electron читает package.json**
```json
{
  "main": "dist/main/main.js"
}
```

### **Шаг 6: Electron загружает dist/main/main.js**

**Строки 786-801:**
```typescript
const electron = require('electron');
const electronApp = electron.app;

if (electronApp) {
  electronApp.whenReady().then(() => {
    initializeElectron();
    new CloudChefPrintAgent();
  });
}
```

### **Шаг 7: Инициализация Electron модулей**
```typescript
function initializeElectron(): void {
  const electron = require('electron');
  app = electron.app;
  BrowserWindow = electron.BrowserWindow;
  Tray = electron.Tray;
  Menu = electron.Menu;
  // ... остальные модули

  store = new Store<AppSettings>({ defaults: {...} });
}
```

### **Шаг 8: Создание CloudChefPrintAgent**
```typescript
class CloudChefPrintAgent {
  constructor() {
    this.socketManager = new SocketManager(...);
    this.printerManager = new PrinterManager();
    this.setupAutoUpdater();
    this.setupAppHandlers();
    this.setupIpcHandlers();
  }
}
```

### **Шаг 9: Настройка обработчиков приложения**
```typescript
app.whenReady().then(async () => {
  this.createTray();         // Системный трей
  this.createWindow();       // Главное окно
  this.setupAutoLaunch();    // Автозапуск
  this.setupAutoUpdater();   // Обновления
  this.checkFirstRunAndPromptAutoLaunch(); // Диалог
  this.autoConnectToRestaurant(); // Автоподключение
  this.checkConnection();    // Проверка связи
});
```

### **Шаг 10: Создание системного трея**
```typescript
private createTray(): void {
  const iconPath = process.platform === 'win32' 
    ? path.join(__dirname, '../../assets/tray-icon.ico')
    : path.join(__dirname, '../../assets/tray-icon.png');
  
  let trayIcon = nativeImage.createFromPath(iconPath);
  this.tray = new Tray(trayIcon);
  
  const contextMenu = Menu.buildFromTemplate([...]);
  this.tray.setContextMenu(contextMenu);
}
```

### **Шаг 11: Создание окна приложения**
```typescript
private createWindow(): void {
  this.mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}
```

### **Шаг 12: Настройка IPC обработчиков**
```typescript
private setupIpcHandlers(): void {
  ipcMain.handle('get-settings', () => store.store);
  ipcMain.handle('save-settings', (_, settings) => {...});
  ipcMain.handle('connect-to-restaurant', (_, code) => {...});
  ipcMain.handle('get-printers', async () => {...});
  // ... другие обработчики
}
```

---

## 🎭 **ВИЗУАЛЬНАЯ СХЕМА ЗАПУСКА**

```
┌─────────────────────────────────────────────────────┐
│ 1. npm run dev                                      │
└───────────────────┬─────────────────────────────────┘
                    │
        ┌───────────┴──────────┐
        │   concurrently       │
        └───────┬──────────┬───┘
                │          │
    ┌───────────┴──┐   ┌──┴─────────────┐
    │  tsc -w      │   │  wait-on +     │
    │  (watch)     │   │  electron .    │
    └───────┬──────┘   └──┬─────────────┘
            │             │
    ┌───────▼──────┐      │
    │ src/*.ts →   │      │
    │ dist/*.js    │      │
    └───────┬──────┘      │
            │             │
            └─────────────┤
                          │
                ┌─────────▼──────────┐
                │ electron .         │
                │ читает package.json│
                └─────────┬──────────┘
                          │
                ┌─────────▼──────────┐
                │ main:              │
                │ dist/main/main.js  │
                └─────────┬──────────┘
                          │
        ┌─────────────────▼─────────────────┐
        │ require('electron').app.whenReady()│
        └─────────────────┬─────────────────┘
                          │
                ┌─────────▼──────────┐
                │ initializeElectron()│
                │ - app, BrowserWindow│
                │ - Tray, Menu, etc. │
                └─────────┬──────────┘
                          │
                ┌─────────▼──────────┐
                │ new CloudChefPrint-│
                │ Agent()            │
                └─────────┬──────────┘
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
┌───────▼─────────┐              ┌─────────▼────────┐
│ createTray()    │              │ createWindow()   │
│ - Системный трей│              │ - BrowserWindow  │
│ - Контекст меню │              │ - UI загрузка    │
└─────────────────┘              └──────────────────┘
        │                                   │
        │                                   │
┌───────▼─────────┐              ┌─────────▼────────┐
│ setupIpcHandlers│              │ loadFile()       │
│ - IPC bridge    │              │ index.html       │
│ - Связь UI↔Main │              │ renderer.js      │
└─────────────────┘              └──────────────────┘
```

---

## 🚀 **РЕЗУЛЬТАТ ЗАПУСКА**

После выполнения всех шагов:

✅ **TypeScript скомпилирован** → `dist/main/main.js`  
✅ **Electron запущен** → загружает `main.js`  
✅ **Приложение инициализировано** → `CloudChefPrintAgent`  
✅ **Системный трей создан** → иконка в панели задач  
✅ **Окно создано** → UI готов к использованию  
✅ **IPC обработчики настроены** → связь renderer ↔ main  
✅ **Socket.IO подключён** → готов к получению задач на печать  
✅ **AutoUpdater активен** → проверяет обновления  
✅ **AutoLaunch настроен** → при необходимости запускается с системой  

---

## 📊 **АРХИТЕКТУРА ПРОЦЕССОВ**

### **Main Process (Node.js)**
- Управление окнами
- Системный трей
- Автообновления
- Socket.IO клиент
- Управление принтерами
- Файловая система
- Логирование

### **Renderer Process (Chromium)**
- React UI
- Формы настроек
- Отображение статуса
- Визуализация задач печати
- Взаимодействие с пользователем

### **Preload Script (Bridge)**
- Безопасный мост между процессами
- Exposed API для renderer
- Context isolation
- Security sandbox

### **IPC Communication**
```
Renderer Process        Main Process
      │                      │
      ├──get-settings────────>│
      │<─────────────settings─┤
      │                      │
      ├──save-settings───────>│
      │<──────────────success─┤
      │                      │
      │<──print-job-received──┤
      ├──confirm-print──────>│
      │                      │
```

---

## 🔧 **ЗАВИСИМОСТИ**

### **Production Dependencies**
```json
{
  "electron": "^28.1.0",
  "electron-store": "^8.2.0",
  "electron-log": "^5.0.3",
  "electron-updater": "^6.1.7",
  "auto-launch": "^5.0.6",
  "socket.io-client": "^4.7.5",
  "pdf-to-printer": "^5.6.1"
}
```

### **Dev Dependencies**
```json
{
  "typescript": "^5.3.3",
  "concurrently": "^8.2.2",
  "wait-on": "^7.2.0",
  "webpack": "^5.89.0",
  "electron-builder": "^24.9.1"
}
```

---

## 💡 **ПОЛЕЗНЫЕ КОМАНДЫ**

### **Разработка**
```bash
npm run dev                 # Запуск в режиме разработки
npm run build               # Полная сборка
npm run build:watch         # TypeScript watch-режим
npm run electron:dev        # Только Electron (требуется build)
```

### **Production Build**
```bash
npm run electron:dist       # Сборка дистрибутива
npm run electron:publish    # Сборка + публикация на GitHub
```

### **Версионирование**
```bash
npm run release:patch       # Bump patch (x.x.+1)
npm run release:minor       # Bump minor (x.+1.0)
npm run release:major       # Bump major (+1.0.0)
```

### **Отладка**
```bash
# Посмотреть логи
tail -f ~/Library/Logs/cloudchef-print-agent/main.log  # macOS
type %USERPROFILE%\AppData\Roaming\cloudchef-print-agent\logs\main.log  # Windows

# Проверить TypeScript ошибки
npx tsc --noEmit

# Очистить всё и переустановить
rm -rf node_modules dist package-lock.json
npm install
npm run build
```

---

## 🎉 **ИТОГ**

Теперь у тебя есть **полная документация** всего процесса запуска Electron приложения:

✅ Все скрипты NPM  
✅ Конфигурация TypeScript  
✅ Полный код main.ts с объяснениями  
✅ Визуальные схемы  
✅ Архитектура процессов  
✅ Зависимости  
✅ Команды для работы  

**Этот документ можно использовать для:**
- Онбординга новых разработчиков
- Понимания всей цепочки запуска
- Отладки проблем с запуском
- Портирования на другие платформы
- Обучения архитектуре Electron

---

*Последнее обновление: 2025-10-03*  
*Версия документа: 1.0*  
*Автор: CloudChef Team*



