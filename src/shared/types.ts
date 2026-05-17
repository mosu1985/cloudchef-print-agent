// 🏷️ Данные этикетки (обновлено для соответствия веб-приложению)
export interface LabelData {
  // Основные поля этикетки
  id: string;
  labelId: string;
  category: string; // Название продукта (было name)
  temperature: string;
  shelfLifeDays: number;
  productionDate: string; // ISO строка
  expiryDate: string; // ISO строка (было expiry)
  preparerName: string; // Имя повара (было chef)
  copies: number;
  method?: string;
  comment?: string;
  purpose?: string;
  workshop?: string; // Название цеха/зоны
  
  // HTML и поля для печати
  html?: string; // HTML для печати
  fields?: any; // Поля для печати
  
  // Обратная совместимость (deprecated)
  name?: string; // = category
  chef?: string; // = preparerName
  expiry?: string; // = expiryDate
  description?: string; // = comment
}

// 🖨️ Информация о принтере
export interface PrinterInfo {
  name: string;
  displayName: string;
  description: string;
  status: 'ready' | 'busy' | 'error' | 'offline';
  isDefault: boolean;
  type: 'thermal' | 'inkjet' | 'laser' | 'unknown';
}

// 📄 Результат печати
export interface PrintResult {
  success: boolean;
  error?: string;
  message?: string;
}

// 🎯 Задание на печать
export interface PrintJob {
  jobId: string;
  labelData: LabelData;
  timestamp: Date;
}

// 📡 Статус подключения
export type ConnectionStatus = 'connected' | 'server-connected' | 'disconnected' | 'error' | 'reconnecting';

// ⚙️ Настройки приложения
export interface AppSettings {
  // Сервер и подключение
  serverUrl: string;
  restaurantCode: string;
  agentToken: string; // 🔑 Токен аутентификации агента
  
  // Принтер
  selectedPrinter: string;
  
  // 🖨️ Настройки печати (смещение)
  labelOffsetHorizontal: number; // Горизонтальное смещение в мм (+ вправо, - влево)
  labelOffsetVertical: number;   // Вертикальное смещение в мм (+ вверх, - вниз)
  
  // Поведение приложения
  autoLaunch: boolean;
  minimizeToTray: boolean;
  startMinimized: boolean; // 🚀 Запускаться свёрнутым в трей при автозапуске
  notifications: boolean;
  isFirstRun: boolean; // 🆕 Флаг первого запуска для показа popup автозапуска
  
  // Окно
  windowBounds: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
}

// 🏗️ Конфигурация приложения
export interface AppConfig {
  version: string;
  serverUrl: string;
  updateServer?: string;
}

// 📊 Статистика подключения
export interface ConnectionStats {
  connected: boolean;
  serverUrl: string;
  restaurantCode: string;
  connectedAt?: Date;
  lastHeartbeat?: Date;
  reconnectAttempts: number;
}

// 📈 Статистика печати
export interface PrintStats {
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  lastPrintJob?: Date;
}

// 🔔 Уведомление
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
}

// 🗂️ Вкладки настроек
export type SettingsTab = 'connection' | 'printer' | 'general' | 'updates' | 'logs';

// 🎨 Тема приложения
export type AppTheme = 'light' | 'dark' | 'system';

// 📱 Состояние UI
export interface UIState {
  activeTab: SettingsTab;
  theme: AppTheme;
  loading: boolean;
  notifications: AppNotification[];
}

// 🔧 Действия приложения
export type AppAction = 
  | { type: 'SET_CONNECTION_STATUS'; payload: ConnectionStatus }
  | { type: 'SET_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'SET_PRINTERS'; payload: PrinterInfo[] }
  | { type: 'ADD_NOTIFICATION'; payload: AppNotification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'SET_ACTIVE_TAB'; payload: SettingsTab }
  | { type: 'SET_THEME'; payload: AppTheme }
  | { type: 'SET_LOADING'; payload: boolean };

// 🌐 WebSocket события
export interface WebSocketEvents {
  // Клиент -> Сервер
  register_agent: {
    pairingCode: string;
    printerInfo: {
      name: string;
      type: string;
      status: string;
    };
  };
  
  agent_heartbeat: {
    status: string;
    timestamp: number;
    printerStatus: string;
  };
  
  print_result: {
    jobId: string;
    status: 'success' | 'error';
    message: string;
    timestamp: number;
  };
  
  // Сервер -> Клиент
  agent_registered: void;
  registration_error: string;
  print_command: {
    jobId: string;
    labelData: LabelData;
  };
  server_stats: {
    connections: number;
    agents: number;
    browsers: number;
  };
}
