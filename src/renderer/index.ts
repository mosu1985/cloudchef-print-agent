import { AppSettings, ConnectionStatus, PrinterInfo, PrintJob } from '../shared/types';

// 📱 Класс управления приложением
class PrintAgentApp {
  private settings: AppSettings | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private printers: PrinterInfo[] = [];
  private selectedPrinter: string = '';
  private printLabels: Array<{
    id: string;
    labelData: any;
    status: 'received' | 'printing' | 'completed' | 'error';
    timestamp: Date;
    jobId: string;
    errorMessage?: string;
  }> = [];
  private autoScroll: boolean = true;
  
  // 🖨️ Настройки сдвига печати
  private horizontalOffset: number = 0; // + вправо, - влево (в мм)
  private verticalOffset: number = 0;   // + вверх, - вниз (в мм)

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // Загрузка версии приложения
    await this.loadAppVersion();
    
    // Загрузка настроек
    await this.loadSettings();
    
    // Загрузка статуса подключения
    await this.loadConnectionStatus();
    
    // Загрузка принтеров
    await this.loadPrinters();
    
    // Инициализация монитора этикеток
    this.initLabelMonitor();
    
    // Настройка обработчиков событий
    this.setupEventListeners();
    
    // Настройка слушателей от main процесса
    this.setupMainProcessListeners();
  }

  private async loadAppVersion(): Promise<void> {
    try {
      const version = await window.electronAPI.getAppVersion();
      const versionElement = document.getElementById('app-version');
      if (versionElement) {
        versionElement.textContent = `v${version}`;
      }
      
      // 📦 Отображаем версию во вкладке "Обновления"
      const currentVersionElement = document.getElementById('current-version');
      if (currentVersionElement) {
        currentVersionElement.textContent = `v${version}`;
      }
    } catch (error) {
      // Используем alert для ошибок в renderer процессе
      this.showNotification('Ошибка загрузки версии', 'error');
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      this.settings = await window.electronAPI.getSettings();
      this.updateSettingsUI();
    } catch (error) {
      this.showNotification('Ошибка загрузки настроек', 'error');
    }
  }

  private async loadConnectionStatus(): Promise<void> {
    try {
      const status = await window.electronAPI.getConnectionStatus();
      this.connectionStatus = status.status;
      this.updateConnectionStatusUI();
    } catch (error) {
      this.showNotification('Ошибка загрузки статуса подключения', 'error');
    }
  }

  private async loadPrinters(): Promise<void> {
    try {
      this.printers = await window.electronAPI.getPrinters();
      this.updatePrintersUI();
    } catch (error) {
      this.showNotification('Ошибка загрузки принтеров', 'error');
    }
  }

  private setupEventListeners(): void {
    // Навигация по вкладкам
    document.querySelectorAll('[data-tab]').forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const tabName = target.getAttribute('data-tab');
        if (tabName) {
          this.switchTab(tabName);
        }
      });
    });

    // Управление окном
    const minimizeBtn = document.getElementById('minimize-btn');
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        window.electronAPI.minimizeToTray();
      });
    }

    // Подключение
    const connectBtn = document.getElementById('connect-btn');
    if (connectBtn) {
      connectBtn.addEventListener('click', () => this.handleConnect());
    }

    const disconnectBtn = document.getElementById('disconnect-btn');
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', () => this.handleDisconnect());
    }

    // Принтеры
    const refreshPrintersBtn = document.getElementById('refresh-printers-btn');
    if (refreshPrintersBtn) {
      refreshPrintersBtn.addEventListener('click', () => this.loadPrinters());
    }

    // Настройки
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => this.handleSaveSettings());
    }

    // Обновления
    const checkUpdatesBtn = document.getElementById('check-updates-btn');
    if (checkUpdatesBtn) {
      checkUpdatesBtn.addEventListener('click', () => this.handleCheckUpdates());
    }

    // Логи
    const openLogsBtn = document.getElementById('open-logs-btn');
    if (openLogsBtn) {
      openLogsBtn.addEventListener('click', () => {
        window.electronAPI.openLogs();
      });
    }

    const clearLogsBtn = document.getElementById('clear-logs-btn');
    if (clearLogsBtn) {
      clearLogsBtn.addEventListener('click', async () => {
        if (confirm('Вы уверены, что хотите очистить все логи?')) {
          try {
            const result = await window.electronAPI.clearLogs();
            if (result && result.success) {
              alert('✅ Логи успешно очищены');
            } else {
              alert('❌ Ошибка при очистке логов: ' + (result.error || 'Неизвестная ошибка'));
            }
          } catch (error) {
            alert('❌ Ошибка при очистке логов: ' + error);
          }
        }
      });
    }

    // Код ресторана - автоформатирование
    const restaurantCodeInput = document.getElementById('restaurant-code') as HTMLInputElement;
    if (restaurantCodeInput) {
      restaurantCodeInput.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const cleaned = target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        target.value = cleaned.substring(0, 8);

        const helper = document.getElementById('restaurant-code-helper');
        if (helper) {
          helper.textContent = cleaned.length === 8
            ? 'Код выглядит корректно'
            : `Осталось символов: ${Math.max(0, 8 - cleaned.length)}`;
        }
      });
    }

    // 🔑 Токен агента - обработка вставки
    const agentTokenInput = document.getElementById('agent-token') as HTMLInputElement;
    if (agentTokenInput) {
      agentTokenInput.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const token = target.value.trim();
        
        // Сохраняем токен автоматически при вставке
        if (token && token.startsWith('agent_')) {
          this.saveSettings({ agentToken: token });
          
          const helper = document.getElementById('agent-token-helper');
          if (helper) {
            helper.textContent = '✅ Токен сохранён!';
            helper.style.color = '#48bb78';
          }
        }
      });
      
      // Разрешаем редактирование для вставки токена
      agentTokenInput.removeAttribute('readonly');
    }

    // Монитор этикеток
    const autoScrollBtn = document.getElementById('auto-scroll-btn');
    if (autoScrollBtn) {
      autoScrollBtn.addEventListener('click', () => this.toggleAutoScroll());
    }

    const clearLabelsBtn = document.getElementById('clear-labels-btn');
    if (clearLabelsBtn) {
      clearLabelsBtn.addEventListener('click', () => this.clearLabelHistory());
    }
    
    // 🖨️ Кнопки настройки сдвига
    const horizontalDecreaseBtn = document.getElementById('horizontal-decrease-btn');
    if (horizontalDecreaseBtn) {
      horizontalDecreaseBtn.addEventListener('click', () => this.adjustOffset('horizontal', -0.2));
    }
    
    const horizontalIncreaseBtn = document.getElementById('horizontal-increase-btn');
    if (horizontalIncreaseBtn) {
      horizontalIncreaseBtn.addEventListener('click', () => this.adjustOffset('horizontal', 0.2));
    }
    
    const verticalDecreaseBtn = document.getElementById('vertical-decrease-btn');
    if (verticalDecreaseBtn) {
      verticalDecreaseBtn.addEventListener('click', () => this.adjustOffset('vertical', -0.2));
    }
    
    const verticalIncreaseBtn = document.getElementById('vertical-increase-btn');
    if (verticalIncreaseBtn) {
      verticalIncreaseBtn.addEventListener('click', () => this.adjustOffset('vertical', 0.2));
    }
  }

  private setupMainProcessListeners(): void {
    // Изменение статуса подключения
    window.electronAPI.onConnectionStatusChanged((status) => {
      this.connectionStatus = status;
      this.updateConnectionStatusUI();
    });

    // Получение задания на печать
    console.log('🔧 RENDERER: Настройка обработчика onPrintJobReceived...');
    document.title = '🔧 RENDERER: Обработчик настроен';
    
    window.electronAPI.onPrintJobReceived((job) => {
      console.log('📨 RENDERER: IPC событие получено!', job);
      document.title = `📨 RENDERER: Получен job ${job.jobId}`;
      
      // Показываем уведомление с правильными полями (автоматически закрывается)
      this.showNotification(
        `🖨️ Получена этикетка "${job.labelData.category}" от ${job.labelData.preparerName}`,
        'info'
      );
      
      this.handlePrintJob(job);
    });

    // Обновления приложения
    window.electronAPI.onUpdateAvailable(() => {
      this.showNotification('Найдено обновление! Начинается загрузка...', 'info');
      const updateStatus = document.getElementById('update-status');
      if (updateStatus) {
        updateStatus.innerHTML = `
          <div class="status-indicator" style="background: rgba(54, 162, 235, 0.1); color: #3498db; border-color: rgba(54, 162, 235, 0.2);">
            <span>🔍</span>
            <span>Найдено обновление. Начинается загрузка...</span>
          </div>
        `;
      }
      
      // Показываем прогресс-бар
      const progressContainer = document.getElementById('download-progress-container');
      if (progressContainer) {
        progressContainer.style.display = 'block';
      }
    });

    // 📊 Прогресс загрузки обновления
    window.electronAPI.onDownloadProgress((progress) => {
      const progressBar = document.getElementById('download-progress-bar');
      const progressText = document.getElementById('download-progress-text');
      const speedText = document.getElementById('download-speed');
      
      if (progressBar) {
        progressBar.style.width = `${progress.percent}%`;
      }
      
      if (progressText) {
        progressText.textContent = `${progress.percent}%`;
      }
      
      if (speedText) {
        const speedMB = (progress.bytesPerSecond / 1024 / 1024).toFixed(2);
        const transferredMB = (progress.transferred / 1024 / 1024).toFixed(2);
        const totalMB = (progress.total / 1024 / 1024).toFixed(2);
        speedText.textContent = `${transferredMB} МБ из ${totalMB} МБ (${speedMB} МБ/с)`;
      }
    });

    window.electronAPI.onUpdateDownloaded(() => {
      this.showNotification('Обновление загружено! Перезапустите приложение для установки.', 'success');
      
      // Скрываем прогресс-бар
      const progressContainer = document.getElementById('download-progress-container');
      if (progressContainer) {
        progressContainer.style.display = 'none';
      }
      
      const updateStatus = document.getElementById('update-status');
      if (updateStatus) {
        updateStatus.innerHTML = `
          <div class="status-indicator status-connected">
            <span>✅</span>
            <span>Обновление загружено и готово к установке</span>
          </div>
          <button class="btn btn-primary" id="restart-and-update-btn" style="margin-top: 12px;">
            <span>🔄</span>
            Перезапустить и обновить
          </button>
        `;
        
        const restartBtn = document.getElementById('restart-and-update-btn');
        if (restartBtn) {
          restartBtn.addEventListener('click', () => {
            window.electronAPI.restartAndUpdate();
          });
        }
      }
    });
    
    // 🔍 Обновление не найдено
    window.electronAPI.onUpdateNotAvailable(() => {
      const updateStatus = document.getElementById('update-status');
      if (updateStatus) {
        updateStatus.innerHTML = `
          <div class="status-indicator status-connected">
            <span>✅</span>
            <span>Вы используете последнюю версию</span>
          </div>
        `;
      }
    });
  }

  private switchTab(tabName: string): void {
    // Убираем активный класс со всех вкладок
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });

    // Добавляем активный класс к выбранной вкладке
    const activeLink = document.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(`${tabName}-tab`);
    
    if (activeLink && activeContent) {
      activeLink.classList.add('active');
      activeContent.classList.add('active');
    }
  }

  private updateSettingsUI(): void {
    if (!this.settings) return;

    // Код ресторана
    const restaurantCodeInput = document.getElementById('restaurant-code') as HTMLInputElement;
    if (restaurantCodeInput) {
      const formatted = (this.settings.restaurantCode || '').toUpperCase();
      restaurantCodeInput.value = formatted;
      const helper = document.getElementById('restaurant-code-helper');
      if (helper) {
        helper.textContent = formatted.length === 8
          ? 'Код выглядит корректно'
          : `Осталось символов: ${Math.max(0, 8 - formatted.length)}`;
      }
    }

    // 🔑 Токен агента
    const agentTokenInput = document.getElementById('agent-token') as HTMLInputElement;
    if (agentTokenInput) {
      const tokenValue = this.settings.agentToken || '';
      agentTokenInput.value = tokenValue;
      const helper = document.getElementById('agent-token-helper');
      if (helper) {
        if (this.settings.agentToken) {
          helper.textContent = '✅ Токен установлен';
          helper.style.color = '#48bb78';
        } else {
          helper.textContent = '⚠️ Токен не установлен. Сгенерируйте токен в веб-приложении CloudChef.';
          helper.style.color = '#f6ad55';
        }
      }
    }

    // Чекбоксы
    const autoLaunchCheckbox = document.getElementById('auto-launch') as HTMLInputElement;
    if (autoLaunchCheckbox) {
      autoLaunchCheckbox.checked = this.settings.autoLaunch;
    }

    const minimizeToTrayCheckbox = document.getElementById('minimize-to-tray') as HTMLInputElement;
    if (minimizeToTrayCheckbox) {
      minimizeToTrayCheckbox.checked = this.settings.minimizeToTray;
    }

    const notificationsCheckbox = document.getElementById('notifications') as HTMLInputElement;
    if (notificationsCheckbox) {
      notificationsCheckbox.checked = this.settings.notifications;
    }

    // Выбранный принтер
    this.selectedPrinter = this.settings.selectedPrinter;
    
    // 🖨️ Настройки сдвига
    this.horizontalOffset = this.settings.labelOffsetHorizontal || 0;
    this.verticalOffset = this.settings.labelOffsetVertical || 0;
    this.updateOffsetInputs();
  }

  private updateConnectionStatusUI(): void {
    const statusElement = document.getElementById('connection-status');
    if (!statusElement) return;

    // Очищаем предыдущие классы
    statusElement.className = 'status-indicator';
    
    let icon = '';
    let text = '';
    let statusClass = '';

    switch (this.connectionStatus) {
      case 'connected':
        icon = '🟢';
        text = 'Подключено к ресторану';
        statusClass = 'status-connected';
        break;
      case 'server-connected':
        icon = '🟢';
        text = 'Подключено к серверу';
        statusClass = 'status-connected';
        break;
      case 'reconnecting':
        icon = '🟡';
        text = 'Переподключение к серверу…';
        statusClass = 'status-disconnected';
        break;
      case 'disconnected':
        icon = '🔴';
        text = 'Отключено';
        statusClass = 'status-disconnected';
        break;
      case 'error':
        icon = '❌';
        text = 'Ошибка подключения';
        statusClass = 'status-error';
        break;
      default:
        icon = '⚪';
        text = 'Неизвестный статус';
        statusClass = 'status-disconnected';
    }

    statusElement.className = `status-indicator ${statusClass}`;
    statusElement.innerHTML = `<span>${icon}</span><span>${text}</span>`;
  }

  private updatePrintersUI(): void {
    const printerList = document.getElementById('printer-list');
    if (!printerList) return;

    printerList.innerHTML = '';

    if (this.printers.length === 0) {
      printerList.innerHTML = `
        <li style="text-align: center; padding: 20px; color: #718096;">
          Принтеры не найдены. Убедитесь, что принтеры установлены и включены.
        </li>
      `;
      return;
    }

    this.printers.forEach(printer => {
      const li = document.createElement('li');
      li.className = `printer-item ${printer.name === this.selectedPrinter ? 'selected' : ''}`;
      li.addEventListener('click', () => this.selectPrinter(printer.name));

      const statusIcon = this.getPrinterStatusIcon(printer.status);
      const typeText = this.getPrinterTypeText(printer.type);
      const defaultText = printer.isDefault ? ' (по умолчанию)' : '';

      li.innerHTML = `
        <div class="printer-info">
          <h4>${printer.displayName}${defaultText}</h4>
          <p>${typeText}</p>
        </div>
        <div class="printer-actions">
          <div class="printer-status status-${printer.status}">
            <span>${statusIcon}</span>
            <span>${this.getStatusText(printer.status)}</span>
          </div>
        </div>
      `;

      printerList.appendChild(li);
    });
  }

  private selectPrinter(printerName: string): void {
    this.selectedPrinter = printerName;
    this.updatePrintersUI();
    
    // Сохраняем выбор
    this.saveSettings({ selectedPrinter: printerName });
    
    this.showNotification(`Выбран принтер: ${printerName}`, 'success');
  }

  private async testPrinter(printerName: string): Promise<void> {
    const testBtn = document.querySelector(`[data-printer="${printerName}"]`) as HTMLButtonElement;
    if (testBtn) {
      testBtn.innerHTML = '<span class="spinner"></span> Тестирование...';
      testBtn.disabled = true;
    }

    try {
      const result = await window.electronAPI.testPrinter(printerName);
      
      if (result.success) {
        this.showNotification(`Тест печати выполнен успешно`, 'success');
      } else {
        this.showNotification(`Ошибка тестирования: ${result.error}`, 'error');
      }
    } catch (error) {
      this.showNotification(`Ошибка тестирования: ${error}`, 'error');
    } finally {
      if (testBtn) {
        testBtn.innerHTML = '<span>🧪</span> Тест';
        testBtn.disabled = false;
      }
    }
  }

  private async handleConnect(): Promise<void> {
    const restaurantCodeInput = document.getElementById('restaurant-code') as HTMLInputElement;
    const agentTokenInput = document.getElementById('agent-token') as HTMLInputElement;
    const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
    
    if (!restaurantCodeInput || !connectBtn || !agentTokenInput) return;

    const rawCode = restaurantCodeInput.value.trim().toUpperCase();
    const agentToken = agentTokenInput.value.trim();
    restaurantCodeInput.value = rawCode;

    if (!/^[A-Z0-9]{8}$/.test(rawCode)) {
      this.showNotification('Введите корректный 8-символьный код ресторана (буквы и цифры)', 'error');
      return;
    }

    // 🔑 Проверяем наличие токена
    if (!agentToken || !agentToken.startsWith('agent_')) {
      this.showNotification('⚠️ Введите токен агента. Получите его в веб-приложении CloudChef во вкладке "Агенты"', 'error');
      return;
    }

    connectBtn.innerHTML = '<span class="spinner"></span> Подключение...';
    connectBtn.disabled = true;

    try {
      // Сохраняем код и токен перед подключением
      await this.saveSettings({ 
        restaurantCode: rawCode,
        agentToken: agentToken 
      });
      
      const result = await window.electronAPI.connectToRestaurant(rawCode);
      
      if (result.success) {
        this.showNotification('Подключение к ресторану...', 'info');
      } else {
        this.showNotification(`Ошибка подключения: ${result.message}`, 'error');
      }
    } catch (error) {
      this.showNotification(`Ошибка подключения: ${error}`, 'error');
    } finally {
      connectBtn.innerHTML = '<span>🔗</span> Подключиться';
      connectBtn.disabled = false;
    }
  }

  private async handleDisconnect(): Promise<void> {
    const disconnectBtn = document.getElementById('disconnect-btn') as HTMLButtonElement;
    
    if (!disconnectBtn) return;

    disconnectBtn.innerHTML = '<span class="spinner"></span> Отключение...';
    disconnectBtn.disabled = true;

    try {
      await window.electronAPI.disconnect();
      this.showNotification('Отключено от сервера', 'info');
    } catch (error) {
      this.showNotification(`Ошибка отключения: ${error}`, 'error');
    } finally {
      disconnectBtn.innerHTML = '<span>🚫</span> Отключиться';
      disconnectBtn.disabled = false;
    }
  }

  private async handleSaveSettings(): Promise<void> {
    const saveBtn = document.getElementById('save-settings-btn') as HTMLButtonElement;
    
    if (!saveBtn) return;

    const autoLaunch = (document.getElementById('auto-launch') as HTMLInputElement).checked;
    const minimizeToTray = (document.getElementById('minimize-to-tray') as HTMLInputElement).checked;
    const notifications = (document.getElementById('notifications') as HTMLInputElement).checked;

    const settingsToSave: Partial<AppSettings> = {
      autoLaunch,
      minimizeToTray,
      notifications,
      selectedPrinter: this.selectedPrinter,
      labelOffsetHorizontal: this.horizontalOffset, // 🖨️ Сохраняем сдвиг
      labelOffsetVertical: this.verticalOffset      // 🖨️ Сохраняем сдвиг
    };

    saveBtn.innerHTML = '<span class="spinner"></span> Сохранение...';
    saveBtn.disabled = true;

    try {
      await this.saveSettings(settingsToSave);
      this.showNotification('Настройки сохранены', 'success');
    } catch (error) {
      this.showNotification(`Ошибка сохранения: ${error}`, 'error');
    } finally {
      saveBtn.innerHTML = '<span>💾</span> Сохранить настройки';
      saveBtn.disabled = false;
    }
  }

  private async handleCheckUpdates(): Promise<void> {
    const checkBtn = document.getElementById('check-updates-btn') as HTMLButtonElement;
    
    if (!checkBtn) return;

    checkBtn.innerHTML = '<span class="spinner"></span> Проверка обновлений...';
    checkBtn.disabled = true;

    // Очищаем предыдущий статус
    const updateStatus = document.getElementById('update-status');
    if (updateStatus) {
      updateStatus.innerHTML = `
        <div class="status-indicator" style="background: rgba(102, 126, 234, 0.1); color: #667eea; border-color: rgba(102, 126, 234, 0.2);">
          <span>🔍</span>
          <span>Проверка доступных обновлений...</span>
        </div>
      `;
    }

    try {
      await window.electronAPI.checkForUpdates();
      // Не показываем преждевременное сообщение "последняя версия"
      // Ждём события update-available или update-not-available от autoUpdater
    } catch (error) {
      this.showNotification(`Ошибка проверки обновлений: ${error}`, 'error');
      if (updateStatus) {
        updateStatus.innerHTML = `
          <div class="status-indicator status-error">
            <span>❌</span>
            <span>Ошибка проверки обновлений</span>
          </div>
        `;
      }
    } finally {
      checkBtn.innerHTML = '<span>🔍</span> Проверить обновления';
      checkBtn.disabled = false;
    }
  }

  private handlePrintJob(job: PrintJob): void {
    console.log('🖨️ RENDERER: Получена команда печати!', job);
    console.log('🖨️ RENDERER: Job ID:', job.jobId);
    console.log('🖨️ RENDERER: Label Data:', job.labelData);
    
    // Добавляем этикетку в монитор
    this.addLabelToMonitor(job);
    
    // Показываем уведомление с правильными полями
    this.showNotification(`Новое задание: ${job.labelData.category}`, 'info');
    
    // Симулируем процесс печати
    this.simulatePrinting(job.jobId);
  }

  private async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    await window.electronAPI.saveSettings(settings);
    
    // Обновляем локальные настройки
    if (this.settings) {
      this.settings = { ...this.settings, ...settings };
    }
  }

  private getPrinterStatusIcon(status: string): string {
    switch (status) {
      case 'ready': return '✅';
      case 'busy': return '🟡';
      case 'error': return '❌';
      case 'offline': return '⚪';
      default: return '❓';
    }
  }

  private getPrinterTypeText(type: string): string {
    switch (type) {
      case 'thermal': return 'Термопринтер';
      case 'inkjet': return 'Струйный принтер';
      case 'laser': return 'Лазерный принтер';
      default: return 'Принтер';
    }
  }

  private getStatusText(status: string): string {
    switch (status) {
      case 'ready': return 'Готов';
      case 'busy': return 'Занят';
      case 'error': return 'Ошибка';
      case 'offline': return 'Отключен';
      default: return 'Неизвестно';
    }
  }

  private showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 5000);
  }

  // 📄 Методы монитора этикеток
  private initLabelMonitor(): void {
    this.updateLabelCountBadge();
    this.updateAutoScrollButton();
  }

  private addLabelToMonitor(job: PrintJob): void {
    console.log('📄 RENDERER: Добавление этикетки в монитор...', job);
    
    const labelItem = {
      id: `label_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      labelData: job.labelData,
      status: 'received' as const,
      timestamp: new Date(),
      jobId: job.jobId,
    };

    console.log('📄 RENDERER: Создан labelItem:', labelItem);
    
    this.printLabels.unshift(labelItem); // Добавляем в начало для показа последних сверху
    
    console.log('📄 RENDERER: Общее количество этикеток:', this.printLabels.length);
    
    // Ограничиваем историю 50 этикетками
    if (this.printLabels.length > 50) {
      this.printLabels = this.printLabels.slice(0, 50);
    }

    this.updateLabelMonitorUI();
    this.updateLabelCountBadge();
    
    console.log('📄 RENDERER: UI обновлен!');
  }

  private updateLabelStatus(jobId: string, status: 'received' | 'printing' | 'completed' | 'error', errorMessage?: string): void {
    const labelIndex = this.printLabels.findIndex(label => label.jobId === jobId);
    if (labelIndex !== -1 && this.printLabels[labelIndex]) {
      this.printLabels[labelIndex].status = status;
      if (errorMessage && this.printLabels[labelIndex]) {
        this.printLabels[labelIndex].errorMessage = errorMessage;
      }
      this.updateLabelMonitorUI();
    }
  }

  private updateLabelMonitorUI(): void {
    const monitor = document.getElementById('label-monitor');
    const noLabelsMessage = document.getElementById('no-labels-message');
    
    if (!monitor || !noLabelsMessage) return;

    if (this.printLabels.length === 0) {
      noLabelsMessage.style.display = 'block';
      return;
    }

    noLabelsMessage.style.display = 'none';
    
    // Очищаем старые элементы, кроме сообщения "нет этикеток"
    const existingLabels = monitor.querySelectorAll('.label-item');
    existingLabels.forEach(item => item.remove());

    // Добавляем новые элементы этикеток
    this.printLabels.forEach(label => {
      const labelElement = this.createLabelElement(label);
      monitor.appendChild(labelElement);
    });

    // Автоскролл к последней этикетке
    if (this.autoScroll && this.printLabels.length > 0) {
      const firstLabel = monitor.querySelector('.label-item');
      if (firstLabel) {
        firstLabel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  private createLabelElement(label: any): HTMLElement {
    const div = document.createElement('div');
    div.className = `label-item ${label.status}`;
    div.id = `label-${label.id}`;

    const statusIcon = this.getLabelStatusIcon(label.status);
    const statusText = this.getLabelStatusText(label.status);
    const timeString = label.timestamp.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });

    // Используем правильные поля из обновленного интерфейса
    const productName = label.labelData.category || 'Неизвестный продукт';
    const chefName = label.labelData.preparerName || 'Неизвестный повар';
    
    // Форматируем дату срока годности
    let expiryDateText = 'Не указано';
    if (label.labelData.expiryDate) {
      try {
        const expiryDate = new Date(label.labelData.expiryDate);
        expiryDateText = expiryDate.toLocaleDateString('ru-RU');
      } catch (error) {
        expiryDateText = label.labelData.expiryDate;
      }
    }

    div.innerHTML = `
      <div class="label-header">
        <div class="label-info">
          <div class="label-name">${productName}</div>
          <div class="label-details">
            <span>👨‍🍳 ${chefName}</span>
            <span>📅 до ${expiryDateText}</span>
            ${label.labelData.temperature ? `<span>🌡️ ${label.labelData.temperature}</span>` : ''}
            ${label.labelData.labelId ? `<span>🏷️ ${label.labelData.labelId}</span>` : ''}
          </div>
          <div class="label-job-id">ID: ${label.jobId}</div>
        </div>
        <div>
          <div class="label-status ${label.status}">
            <span>${statusIcon}</span>
            <span>${statusText}</span>
          </div>
          <div class="label-timestamp">${timeString}</div>
        </div>
      </div>
      ${label.errorMessage ? `<div style="color: #f56565; font-size: 12px; margin-top: 8px;">❌ ${label.errorMessage}</div>` : ''}
    `;

    return div;
  }

  private getLabelStatusIcon(status: string): string {
    switch (status) {
      case 'received': return '📨';
      case 'printing': return '🖨️';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '❓';
    }
  }

  private getLabelStatusText(status: string): string {
    switch (status) {
      case 'received': return 'Получено';
      case 'printing': return 'Печатается';
      case 'completed': return 'Готово';
      case 'error': return 'Ошибка';
      default: return 'Неизвестно';
    }
  }

  private updateLabelCountBadge(): void {
    const badge = document.getElementById('label-count-badge');
    if (badge) {
      badge.textContent = this.printLabels.length.toString();
    }
  }

  private toggleAutoScroll(): void {
    this.autoScroll = !this.autoScroll;
    this.updateAutoScrollButton();
  }

  private updateAutoScrollButton(): void {
    const btn = document.getElementById('auto-scroll-btn');
    const text = document.getElementById('auto-scroll-text');
    
    if (btn && text) {
      if (this.autoScroll) {
        text.textContent = 'Авто-скролл вкл';
        btn.className = 'btn btn-primary';
      } else {
        text.textContent = 'Авто-скролл выкл';
        btn.className = 'btn btn-secondary';
      }
    }
  }

  private clearLabelHistory(): void {
    if (this.printLabels.length === 0) {
      this.showNotification('История этикеток уже пуста', 'info');
      return;
    }

    if (confirm(`Очистить историю из ${this.printLabels.length} этикеток?`)) {
      this.printLabels = [];
      this.updateLabelMonitorUI();
      this.updateLabelCountBadge();
      this.showNotification('История этикеток очищена', 'success');
    }
  }

  private simulatePrinting(jobId: string): void {
    // Симулируем процесс печати для демонстрации
    setTimeout(() => {
      this.updateLabelStatus(jobId, 'printing');
    }, 500);

    setTimeout(() => {
      // Симулируем успешную или ошибочную печать
      const success = Math.random() > 0.1; // 90% успеха
      if (success) {
        this.updateLabelStatus(jobId, 'completed');
      } else {
        this.updateLabelStatus(jobId, 'error', 'Принтер недоступен');
      }
    }, 2000 + Math.random() * 3000); // 2-5 секунд
  }
  
  // 🖨️ Методы настройки сдвига печати
  private adjustOffset(type: 'horizontal' | 'vertical', delta: number): void {
    if (type === 'horizontal') {
      this.horizontalOffset = Math.round((this.horizontalOffset + delta) * 10) / 10;
    } else {
      this.verticalOffset = Math.round((this.verticalOffset + delta) * 10) / 10;
    }
    this.updateOffsetInputs();
  }
  
  private updateOffsetInputs(): void {
    // Обновляем input значения
    const horizontalInput = document.getElementById('horizontal-offset-input') as HTMLInputElement;
    if (horizontalInput) {
      horizontalInput.value = this.horizontalOffset.toFixed(1);
    }
    
    const verticalInput = document.getElementById('vertical-offset-input') as HTMLInputElement;
    if (verticalInput) {
      verticalInput.value = this.verticalOffset.toFixed(1);
    }
    
    // Обновляем подсказки (hints)
    const horizontalHint = document.getElementById('horizontal-offset-hint');
    if (horizontalHint) {
      if (this.horizontalOffset > 0) {
        horizontalHint.textContent = '(вправо)';
      } else if (this.horizontalOffset < 0) {
        horizontalHint.textContent = '(влево)';
      } else {
        horizontalHint.textContent = '(центр)';
      }
    }
    
    const verticalHint = document.getElementById('vertical-offset-hint');
    if (verticalHint) {
      if (this.verticalOffset > 0) {
        verticalHint.textContent = '(вверх)';
      } else if (this.verticalOffset < 0) {
        verticalHint.textContent = '(вниз)';
      } else {
        verticalHint.textContent = '(центр)';
      }
    }
  }
}

// Запуск приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
  new PrintAgentApp();
});
