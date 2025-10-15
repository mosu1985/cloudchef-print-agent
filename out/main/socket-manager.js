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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketManager = void 0;
const socket_io_client_1 = require("socket.io-client");
const log = __importStar(require("electron-log"));
class SocketManager {
    socket = null;
    serverUrl;
    restaurantCode = '';
    agentToken = ''; // 🔑 Токен аутентификации агента
    onConnectionChange;
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    heartbeatInterval = null;
    isRegistered = false;
    registrationTimeout = null;
    registrationRetryInterval = null;
    registrationRetries = 0;
    maxRegistrationRetries = 5;
    constructor(serverUrl, onConnectionChange) {
        this.serverUrl = serverUrl;
        this.onConnectionChange = onConnectionChange;
    }
    updateServerUrl(url) {
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
    setRestaurantCode(code) {
        this.restaurantCode = code;
    }
    setAgentToken(token) {
        this.agentToken = token;
        // 🔍 Извлекаем код ресторана из токена
        // Формат токена: agent_<restaurantCode>_<randomKey>
        const tokenPattern = /^agent_([A-Z0-9]{8})_[a-f0-9]{32}$/;
        const match = token.match(tokenPattern);
        if (match && match[1]) {
            const restaurantCode = match[1];
            this.restaurantCode = restaurantCode;
            log.info('🔑 Код ресторана извлечен из токена', { restaurantCode });
        }
        else {
            log.warn('⚠️ Не удалось извлечь код ресторана из токена - неверный формат');
        }
    }
    async connectToRestaurant(code) {
        this.restaurantCode = code;
        try {
            await this.connect();
            return { success: true };
        }
        catch (error) {
            log.error('Ошибка подключения к ресторану:', error);
            return { success: false, message: String(error) };
        }
    }
    async connect() {
        if (this.socket?.connected) {
            this.disconnect();
        }
        log.info(`Подключение к серверу: ${this.serverUrl}`);
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Таймаут подключения к серверу'));
            }, 10000);
            this.socket = (0, socket_io_client_1.io)(this.serverUrl, {
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
            this.socket.on('print_job', (data) => {
                log.info('🖨️ *** ПОЛУЧЕНА КОМАНДА ПЕЧАТИ ***', data);
                const printJob = {
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
    registerAsAgent() {
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
    startHeartbeat() {
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
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    clearRegistrationTimers() {
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
    startRegistrationRetry() {
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
    sendPrintResult(jobId, status, message) {
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
    checkConnection() {
        log.info('🔍 DEBUG: checkConnection - restaurantCode:', this.restaurantCode, 'socket connected:', this.socket?.connected);
        if (this.socket?.connected) {
            log.info('Подключение активно');
            if (this.restaurantCode && !this.isRegistered) {
                log.info('Агент не зарегистрирован, выполняем регистрацию');
                this.registerAsAgent();
            }
            else if (this.isRegistered) {
                log.info('Агент уже зарегистрирован, пропускаем повторную регистрацию');
            }
        }
        else {
            log.info('Подключение отсутствует, попытка подключения...');
            if (this.restaurantCode) {
                log.info('🔍 DEBUG: Автоматическое подключение к ресторану:', this.restaurantCode);
                this.connectToRestaurant(this.restaurantCode);
            }
        }
    }
    disconnect() {
        if (this.socket) {
            log.info('Отключение от сервера');
            this.stopHeartbeat();
            this.clearRegistrationTimers();
            this.socket.disconnect();
            this.socket = null;
        }
        this.onConnectionChange('disconnected');
    }
    isConnected() {
        return this.socket?.connected || false;
    }
    getConnectionInfo() {
        return {
            connected: this.isConnected(),
            serverUrl: this.serverUrl,
            restaurantCode: this.restaurantCode
        };
    }
    onPrintJob(printJob) {
        // Этот метод будет переопределен в main.ts через bind
        log.info('Print job received:', printJob);
    }
}
exports.SocketManager = SocketManager;
//# sourceMappingURL=socket-manager.js.map