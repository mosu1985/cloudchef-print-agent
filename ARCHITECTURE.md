# 🏗️ CloudChef Print Agent - Архитектура

**Версия:** 1.1.2
**Платформа:** Electron Desktop Application
**Язык:** TypeScript (→ мигрируется на JavaScript)
**Дата создания:** 2025-01-09

---

## 📋 Оглавление
- [Общий обзор](#общий-обзор)
- [Структура проекта](#структура-проекта)
- [Основные компоненты](#основные-компоненты)
- [Процессы Electron](#процессы-electron)
- [Потоки данных](#потоки-данных)
- [Зависимости](#зависимости)

---

## 🎯 Общий обзор

CloudChef Print Agent - десктопное приложение для автоматической печати этикеток для продуктов питания. Работает как мост между веб-приложением CloudChef и локальными принтерами.

### Основные функции:
- 🖨️ **Печать этикеток** - прием заданий по WebSocket и печать на локальный принтер
- 🔐 **Аутентификация** - токен-based авторизация с сервером
- 🔄 **Автообновление** - проверка и установка обновлений через GitHub
- 💾 **Настройки** - хранение конфигурации в electron-store
- 📊 **Логирование** - детальные логи всех операций
- 🚀 **Автозапуск** - запуск при старте системы

---

## 📁 Структура проекта

```
cloudchef-print-agent/
├── src/
│   ├── main/                    # Main Process (Electron)
│   │   ├── main.ts             # Главный файл приложения
│   │   ├── socket-manager.ts   # Управление WebSocket подключением
│   │   └── printer-manager.ts  # Управление принтерами
│   │
│   ├── preload/                 # Preload Scripts
│   │   └── preload.ts          # Мост между main и renderer
│   │
│   ├── renderer/                # Renderer Process (UI)
│   │   ├── index.html          # Главная страница
│   │   └── index.ts            # React UI приложения
│   │
│   └── shared/                  # Общие типы и утилиты
│       └── types.ts            # TypeScript интерфейсы
│
├── assets/                      # Иконки и ресурсы
├── dist/                        # Скомпилированные файлы (генерируется)
├── release/                     # Production builds (генерируется)
├── package.json                 # Зависимости и скрипты
├── tsconfig.json               # Конфигурация TypeScript
└── electron.vite.config.ts     # Конфигурация сборки
```

---

## 🧩 Основные компоненты

### 1. **CloudChefPrintAgent** (main.ts)
Главный класс приложения, координирует все компоненты.

**Ответственность:**
- Создание окна приложения (BrowserWindow)
- Управление tray icon в системном трее
- Обработка IPC сообщений от renderer процесса
- Координация SocketManager и PrinterManager
- Настройка автообновлений
- Управление настройками через electron-store

**Ключевые методы:**
```typescript
constructor()                    // Инициализация всех менеджеров
setupAppHandlers()              // Настройка Electron app handlers
createWindow()                  // Создание главного окна
createTray()                    // Создание иконки в трее
setupIpcHandlers()              // Настройка IPC обработчиков
setupAutoUpdater()              // Настройка обновлений
onPrintJob(job: PrintJob)       // Обработка задания на печать
executePrint(job: PrintJob)     // Выполнение печати
```

**Состояние:**
- `mainWindow: BrowserWindow` - главное окно
- `tray: Tray` - иконка в трее
- `socketManager: SocketManager` - менеджер подключения
- `printerManager: PrinterManager` - менеджер принтеров
- `connectionStatus: ConnectionStatus` - статус подключения
- `isQuiting: boolean` - флаг завершения приложения

---

### 2. **SocketManager** (socket-manager.ts)
Управляет WebSocket подключением к серверу CloudChef.

**Ответственность:**
- Подключение к серверу печати
- Регистрация агента с токеном
- Получение заданий на печать
- Отправка результатов печати
- Heartbeat (пинг сервера)
- Автоматическое переподключение

**Ключевые методы:**
```typescript
connectToRestaurant(code: string)   // Подключение к ресторану
disconnect()                        // Отключение
setAgentToken(token: string)        // Установка токена
sendPrintResult(jobId, status, msg) // Отправка результата
```

**События WebSocket:**
- `register_agent` - регистрация агента на сервере
- `agent_registered` - подтверждение регистрации
- `print_command` - задание на печать
- `agent_heartbeat` - ping сервера
- `print_result` - результат печати

**Состояние:**
- `socket: Socket` - WebSocket соединение
- `serverUrl: string` - URL сервера
- `restaurantCode: string` - код ресторана
- `agentToken: string` - токен аутентификации
- `reconnectAttempts: number` - попытки переподключения
- `isRegistered: boolean` - флаг регистрации

---

### 3. **PrinterManager** (printer-manager.ts)
Управляет локальными принтерами и печатью этикеток.

**Ответственность:**
- Получение списка доступных принтеров
- Определение типа принтера (thermal/inkjet/laser)
- Генерация HTML этикетки из данных
- Печать через системные команды (Windows/macOS/Linux)
- Кеширование списка принтеров

**Ключевые методы:**
```typescript
getPrinters()                         // Список принтеров
printLabel(printer, data, offsetX, offsetY) // Печать этикетки
generateLabelHTML(data)               // Генерация HTML
```

**Платформы:**
- **Windows**: PowerShell команды
- **macOS**: `lpstat`, `lpr`
- **Linux**: CUPS команды

**Кеширование:**
- Кеш принтеров на 30 секунд
- Автообновление при запросе после истечения

---

## ⚙️ Процессы Electron

### Main Process
**Файл:** `src/main/main.ts`

**Задачи:**
- Создание и управление окнами
- Доступ к файловой системе
- Управление системными ресурсами (принтеры, автозапуск)
- WebSocket подключение
- Хранение настроек
- Логирование

**Технологии:**
- Node.js APIs (fs, path, child_process)
- Electron APIs (app, BrowserWindow, Tray, Menu, ipcMain)
- Socket.IO Client
- electron-store
- electron-log
- electron-updater
- auto-launch
- pdf-to-printer

---

### Renderer Process
**Файл:** `src/renderer/index.ts`

**Задачи:**
- Отображение UI настроек
- Взаимодействие с пользователем
- Отправка команд в main process через IPC

**Технологии:**
- React (UI библиотека)
- Radix UI (компоненты)
- IPC коммуникация с main process

---

### Preload Script
**Файл:** `src/preload/preload.ts`

**Задачи:**
- Безопасный мост между main и renderer
- Экспонирование IPC API в renderer через `window.api`

**Exposed API:**
```typescript
window.api = {
  // Settings
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings) => Promise<void>

  // Printers
  getPrinters: () => Promise<PrinterInfo[]>

  // Connection
  connect: (code) => Promise<void>
  disconnect: () => Promise<void>
  onConnectionStatus: (callback) => void

  // Updates
  checkForUpdates: () => Promise<void>
  onUpdateAvailable: (callback) => void
  onDownloadProgress: (callback) => void
  installUpdate: () => Promise<void>
}
```

---

## 🔄 Потоки данных

### 1. Подключение к серверу
```
User Input (код ресторана)
  → Renderer (IPC)
    → Main Process
      → SocketManager.connectToRestaurant()
        → WebSocket.connect(serverUrl)
          → emit('register_agent', { token, printerInfo })
            ← on('agent_registered')
              → Update UI status
```

### 2. Печать этикетки
```
CloudChef Server
  → WebSocket.emit('print_command', { jobId, labelData })
    → SocketManager.onPrintJob()
      → CloudChefPrintAgent.onPrintJob()
        → Send to Renderer (IPC notification)
        → PrinterManager.printLabel()
          → Generate HTML
          → Save to temp file
          → Execute print command
            → Send result back via WebSocket
```

### 3. Получение списка принтеров
```
Renderer
  → IPC: getPrinters
    → Main Process
      → PrinterManager.getPrinters()
        → Execute system command (lpstat/PowerShell)
        → Parse output
        → Return list
      ← IPC response
    ← Update UI
```

---

## 📦 Зависимости

### Production Dependencies
```json
{
  "@radix-ui/*": "UI компоненты для настроек",
  "auto-launch": "Автозапуск при старте системы",
  "electron-log": "Логирование в файл",
  "electron-store": "Хранение настроек",
  "electron-updater": "Автообновления через GitHub",
  "pdf-to-printer": "Печать PDF на Windows",
  "socket.io-client": "WebSocket клиент"
}
```

### Dev Dependencies
```json
{
  "electron": "Electron framework",
  "electron-builder": "Сборка production приложения",
  "electron-vite": "Dev сервер и bundler",
  "typescript": "Типизация кода",
  "vite": "Bundler для renderer процесса",
  "webpack": "Bundler (старый)",
  "concurrently": "Запуск нескольких команд"
}
```

---

## 🔐 Безопасность

### Токен аутентификации
Формат: `agent_<RESTAURANT_CODE>_<32-char-hex>`

Пример: `agent_ABCD1234_a1b2c3d4e5f6...`

**Хранение:**
- electron-store (зашифровано на диске)
- Путь: `~/Library/Application Support/cloudchef-print-agent/config.json` (macOS)

**Использование:**
- Отправляется при регистрации агента
- Включается в каждый heartbeat
- Извлекается код ресторана из токена

---

## 🚀 Жизненный цикл приложения

### Запуск
1. `app.whenReady()` - Electron готов
2. Создание `CloudChefPrintAgent` instance
3. Инициализация `SocketManager` и `PrinterManager`
4. Создание window и tray icon
5. Загрузка настроек из electron-store
6. Подключение к серверу (если есть токен)
7. Проверка обновлений

### Работа
1. Ожидание заданий на печать через WebSocket
2. Heartbeat каждые 30 секунд
3. Обработка IPC команд от UI
4. Автоматическое переподключение при разрыве

### Завершение
1. `app.on('before-quit')` - сохранение настроек
2. Отключение от сервера
3. Закрытие окон
4. Выход из приложения

---

## 📊 Настройки (electron-store)

```typescript
{
  serverUrl: 'https://cloudchef-print-server.onrender.com',
  restaurantCode: 'ABCD1234',
  agentToken: 'agent_ABCD1234_...',
  selectedPrinter: 'Zebra ZD420',
  labelOffsetHorizontal: 0,  // мм
  labelOffsetVertical: 0,    // мм
  autoLaunch: true,
  minimizeToTray: true,
  startMinimized: true,
  notifications: true,
  isFirstRun: false,
  windowBounds: { width: 800, height: 600, x: 100, y: 100 }
}
```

---

## 🐛 Логирование

**Библиотека:** electron-log

**Уровни:**
- `log.info()` - информация
- `log.warn()` - предупреждения
- `log.error()` - ошибки

**Пути логов:**
- macOS: `~/Library/Logs/cloudchef-print-agent/main.log`
- Windows: `%USERPROFILE%\AppData\Roaming\cloudchef-print-agent\logs\main.log`
- Linux: `~/.config/cloudchef-print-agent/logs/main.log`

**Ротация:**
- Максимальный размер: 5MB
- Хранится: последние 5 файлов

---

## 🔄 Автообновления

**Провайдер:** GitHub Releases

**Процесс:**
1. Проверка обновлений при старте
2. Периодическая проверка каждые 3 часа
3. Уведомление пользователя о доступном обновлении
4. Загрузка в фоне
5. Установка при следующем запуске

**События:**
- `update-available` - доступно обновление
- `download-progress` - прогресс загрузки
- `update-downloaded` - обновление готово
- `update-not-available` - обновлений нет

---

## 🎨 UI Архитектура

### Вкладки настроек:
1. **Connection** - подключение к серверу, код ресторана
2. **Printer** - выбор принтера, настройка смещения
3. **General** - автозапуск, уведомления
4. **Updates** - проверка и установка обновлений
5. **Logs** - просмотр логов

### Компоненты:
- Radix UI Dialog, Select, Switch, Separator
- Кастомные React компоненты
- Tailwind CSS стили

---

## 🔌 IPC API

### Main → Renderer
```typescript
mainWindow.webContents.send('connection-status', status)
mainWindow.webContents.send('print-job-received', job)
mainWindow.webContents.send('update-available')
mainWindow.webContents.send('download-progress', progress)
mainWindow.webContents.send('update-downloaded')
```

### Renderer → Main
```typescript
ipcRenderer.invoke('get-settings')
ipcRenderer.invoke('save-settings', settings)
ipcRenderer.invoke('get-printers')
ipcRenderer.invoke('connect-to-restaurant', code)
ipcRenderer.invoke('disconnect-from-server')
ipcRenderer.invoke('check-for-updates')
ipcRenderer.invoke('install-update')
ipcRenderer.invoke('open-logs')
ipcRenderer.invoke('quit-app')
```

---

## 📝 Типы данных (types.ts)

### Основные интерфейсы:
- `LabelData` - данные этикетки
- `PrinterInfo` - информация о принтере
- `PrintResult` - результат печати
- `PrintJob` - задание на печать
- `ConnectionStatus` - статус подключения
- `AppSettings` - настройки приложения
- `WebSocketEvents` - события WebSocket

---

## 🛠️ Текущие проблемы

### macOS Dev Mode Issue
**Проблема:** `require('electron')` возвращает string вместо API в dev режиме

**Причина:** TypeScript компиляция → Node.js context → Electron недоступен

**Решение:** Миграция на чистый JavaScript (в процессе)

---

## 🚀 Roadmap миграции TypeScript → JavaScript

### Этапы:
1. ✅ Создание архитектурной документации
2. 🔄 Переименование `.ts` → `.js`
3. 🔄 Удаление типов
4. 🔄 Замена `import` на `require`
5. 🔄 Обновление package.json
6. 🔄 Тестирование dev режима

**Цель:** Работающий dev режим на macOS без компиляции TypeScript

---

**Дата обновления:** 2025-01-09
**Автор:** CloudChef Team
**Версия документа:** 1.0
