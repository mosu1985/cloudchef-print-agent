import { io, Socket } from 'socket.io-client';
import * as log from 'electron-log';
import { ConnectionStatus, PrintJob, LabelData } from '../shared/types';

export class SocketManager {
  private socket: Socket | null = null;
  private serverUrl: string;
  private restaurantCode: string = '';
  private agentToken: string = ''; // 🔑 Токен аутентификации агента
  private onConnectionChange: (status: ConnectionStatus) => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isRegistered: boolean = false;
  private registrationTimeout: NodeJS.Timeout | null = null;
  private registrationRetryInterval: NodeJS.Timeout | null = null;
  private registrationRetries: number = 0;
  private maxRegistrationRetries: number = 5;

  constructor(serverUrl: string, onConnectionChange: (status: ConnectionStatus) => void) {
    this.serverUrl = serverUrl;
    this.onConnectionChange = onConnectionChange;
  }

  public updateServerUrl(url: string): void {
    if (this.serverUrl !== url) {
      this.serverUrl = url;
      if (this.socket) {
        this.disconnect();
        if (this.restaurantCode) {
          this.connectToRestaurant(this.restaurantCode);
        }
      }
    }
  }

  public setRestaurantCode(code: string): void {
    this.restaurantCode = code;
  }

  public setAgentToken(token: string): void {
    this.agentToken = token;
    
    // 🔍 Извлекаем код ресторана из токена
    // Формат токена: agent_<restaurantCode>_<randomKey>
    const tokenPattern = /^agent_([A-Z0-9]{8})_[a-f0-9]{32}$/;
    const match = token.match(tokenPattern);
    
    if (match && match[1]) {
      const restaurantCode = match[1];
      this.restaurantCode = restaurantCode;
      log.info('🔑 Код ресторана извлечен из токена', { restaurantCode });
    } else {
      log.warn('⚠️ Не удалось извлечь код ресторана из токена - неверный формат');
    }
  }

  public async connectToRestaurant(code: string): Promise<{ success: boolean; message?: string }> {
    this.restaurantCode = code;
    
    try {
      await this.connect();
      return { success: true };
    } catch (error) {
      log.error('Ошибка подключения к ресторану:', error);
      return { success: false, message: String(error) };
    }
  }

  private async connect(): Promise<void> {
    if (this.socket?.connected) {
      this.disconnect();
    }

    log.info(`Подключение к серверу: ${this.serverUrl}`);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Таймаут подключения к серверу'));
      }, 10000);

      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: this.maxReconnectAttempts,
        auth: {
          token: this.agentToken, // 🔑 Передаём токен для аутентификации
        },
        query: {
          clientType: 'agent' // Указываем тип клиента
        }
      });

      // 🔗 Подключение установлено
      this.socket.on('connect', () => {
        clearTimeout(timeout);
        log.info('Подключение к серверу установлено');
        this.reconnectAttempts = 0;
        this.onConnectionChange('server-connected');
        
        // Регистрация происходит только при первом подключении
        // При переподключении используется событие 'reconnect'
        if (this.restaurantCode && !this.isRegistered) {
          // Очищаем предыдущие таймеры если есть
          this.clearRegistrationTimers();
          this.registrationRetries = 0;
          
          // Даём серверу время обработать middleware и настроить обработчики (5 секунд для Render.com cold start)
          log.info('⏰ Ожидание 5 секунд перед регистрацией агента (Render.com cold start)...');
          this.registrationTimeout = setTimeout(() => {
            if (this.socket?.connected && !this.isRegistered) {
              log.info('⏰ Задержка завершена, отправляем регистрацию агента (попытка 1)');
              this.registerAsAgent();
              // Запускаем retry механизм
              this.startRegistrationRetry();
            }
          }, 5000); // 5000ms задержка для Render.com cold start
        }
        
        this.startHeartbeat();
        resolve();
      });

      // ❌ Ошибка подключения
      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        log.error('Ошибка подключения к серверу:', error.message);
        this.onConnectionChange('error');
        reject(error);
      });

      // 🔄 Переподключение
      this.socket.on('reconnect', (attemptNumber) => {
        log.info(`Переподключение выполнено (попытка ${attemptNumber})`);
        this.onConnectionChange('server-connected');
        
        // Регистрация уже произошла в событии 'connect'
        // Здесь дополнительная регистрация не нужна
        log.info('Переподключение завершено, регистрация уже выполнена');
      });

      this.socket.on('reconnect_attempt', (attemptNumber) => {
        log.info(`Попытка переподключения ${attemptNumber}/${this.maxReconnectAttempts}`);
      });

      this.socket.on('reconnect_error', (error) => {
        log.error('Ошибка переподключения:', error.message);
        this.onConnectionChange('error');
      });

      this.socket.on('reconnect_failed', () => {
        log.error('Переподключение не удалось');
        this.onConnectionChange('error');
      });

      // 📡 Отключение
      this.socket.on('disconnect', (reason) => {
        log.info('Отключен от сервера:', reason);
        this.onConnectionChange('disconnected');
        this.stopHeartbeat();
        this.clearRegistrationTimers(); // Очищаем таймеры регистрации
        this.isRegistered = false; // Сбрасываем флаг при отключении
        
        if (reason === 'io server disconnect') {
          // Сервер принудительно отключил - переподключаемся
          this.socket?.connect();
        }
      });

      // 📥 Регистрация агента
      this.socket.on('agent_registered', () => {
        log.info('✅ Агент зарегистрирован в ресторане');
        this.isRegistered = true;
        this.clearRegistrationTimers(); // Останавливаем retry после успешной регистрации
        this.onConnectionChange('connected');
      });

      this.socket.on('registration_error', (error) => {
        log.error('❌ ОШИБКА РЕГИСТРАЦИИ АГЕНТА:', error);
        log.error('🔍 Проверьте, что код ресторана совпадает с кодом в токене агента!');
        log.error('🔍 Токен:', this.agentToken?.substring(0, 30) + '...');
        log.error('🔍 Код из токена:', this.agentToken?.split('_')[1]);
        log.error('🔍 Код для регистрации:', this.restaurantCode);
        this.onConnectionChange('error');
      });

      // 🔐 Ошибка аутентификации токена (критическая - останавливаем переподключение)
      this.socket.on('authentication_error', (error) => {
        log.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Токен агента недействителен:', error.message);
        this.onConnectionChange('error');
        
        // Останавливаем все попытки переподключения
        this.socket?.removeAllListeners();
        this.socket?.disconnect();
        this.socket = null;
        
        // Уведомляем пользователя через главный процесс
        log.error('⚠️ Подключение невозможно. Проверьте токен агента в настройках.');
      });

      // 🖨️ Получение команды печати
      this.socket.on('print_job', (data) => { // ВЕРНУЛ ОБРАТНО НА 'print_job' - СЕРВЕР ОТПРАВЛЯЕТ ИМЕННО ЭТО!
        log.info('🖨️ *** ПОЛУЧЕНА КОМАНДА ПЕЧАТИ ***', data);
        const printJob: PrintJob = {
          jobId: data.jobId,
          labelData: data.labelData,
          timestamp: new Date()
        };
        
        // Эмитируем событие для главного процесса
        this.onPrintJob(printJob);
      });
      
      // 🔍 ОТЛАДКА: Слушаем ВСЕ события для диагностики
      this.socket.onAny((eventName, ...args) => {
        log.info(`🔍 DEBUG: Получено событие "${eventName}"`, args);
      });

      // 📊 Статистика сервера
      this.socket.on('server_stats', (stats) => {
        log.debug('Статистика сервера:', stats);
      });
    });
  }

  private registerAsAgent(): void {
    if (!this.socket || !this.restaurantCode) {
      log.error('Не удается зарегистрировать агент: нет подключения или кода');
      return;
    }

    // Предотвращаем повторную регистрацию
    if (this.isRegistered) {
      log.info('✅ Агент уже зарегистрирован, пропускаем повторную регистрацию');
      return;
    }

    log.info(`🔗 Регистрация агента с кодом: ${this.restaurantCode}`);
    
    const printerInfo = {
      name: 'CloudChef Print Agent',
      type: 'Thermal Label Printer',
      status: 'ready'
    };

    const registrationData = {
      code: this.restaurantCode,
      printerInfo: printerInfo
    };
    
    log.info('🚀 Отправка данных регистрации агента:', registrationData);
    this.socket.emit('register_agent', registrationData);
    // isRegistered устанавливается в true после получения agent_registered
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('agent_heartbeat', {
          status: 'active',
          timestamp: Date.now(),
          printerStatus: 'ready'
        });
      }
    }, 30000); // Каждые 30 секунд
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private clearRegistrationTimers(): void {
    if (this.registrationTimeout) {
      clearTimeout(this.registrationTimeout);
      this.registrationTimeout = null;
    }
    if (this.registrationRetryInterval) {
      clearInterval(this.registrationRetryInterval);
      this.registrationRetryInterval = null;
    }
    this.registrationRetries = 0;
  }

  private startRegistrationRetry(): void {
    // Повторяем попытку регистрации каждые 3 секунды, максимум 5 раз
    this.registrationRetryInterval = setInterval(() => {
      if (this.isRegistered) {
        // Уже зарегистрированы, останавливаем retry
        this.clearRegistrationTimers();
        return;
      }

      if (this.registrationRetries >= this.maxRegistrationRetries) {
        log.error(`❌ Не удалось зарегистрировать агента после ${this.maxRegistrationRetries} попыток`);
        log.error('🔍 Проверьте подключение к серверу и попробуйте перезапустить агент');
        this.clearRegistrationTimers();
        return;
      }

      if (this.socket?.connected && !this.isRegistered) {
        this.registrationRetries++;
        log.info(`🔄 Повторная попытка регистрации агента (попытка ${this.registrationRetries + 1}/${this.maxRegistrationRetries + 1})`);
        this.registerAsAgent();
      }
    }, 3000); // Повторяем каждые 3 секунды
  }

  public sendPrintResult(jobId: string, status: 'success' | 'error', message: string): void {
    if (!this.socket?.connected) {
      log.error('Не удается отправить результат печати: нет подключения');
      return;
    }

    log.info(`Отправка результата печати: ${jobId} - ${status}`);
    
    this.socket.emit('print_result', {
      jobId: jobId,
      status: status,
      message: message,
      timestamp: Date.now()
    });
  }

  public checkConnection(): void {
    if (this.socket?.connected) {
      log.info('Подключение активно');
      if (this.restaurantCode && !this.isRegistered) {
        log.info('Агент не зарегистрирован, выполняем регистрацию');
        this.registerAsAgent();
      } else if (this.isRegistered) {
        log.info('Агент уже зарегистрирован, пропускаем повторную регистрацию');
      }
    } else {
      log.info('Подключение отсутствует, попытка подключения...');
      if (this.restaurantCode) {
        this.connectToRestaurant(this.restaurantCode);
      }
    }
  }

  public disconnect(): void {
    if (this.socket) {
      log.info('Отключение от сервера');
      this.stopHeartbeat();
      this.clearRegistrationTimers();
      this.socket.disconnect();
      this.socket = null;
    }
    this.onConnectionChange('disconnected');
  }

  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  public getConnectionInfo(): { connected: boolean; serverUrl: string; restaurantCode: string } {
    return {
      connected: this.isConnected(),
      serverUrl: this.serverUrl,
      restaurantCode: this.restaurantCode
    };
  }

  public onPrintJob(printJob: PrintJob): void {
    // Этот метод будет переопределен в main.ts через bind
    log.info('Print job received:', printJob);
  }
}
