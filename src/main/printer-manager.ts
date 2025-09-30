import { execSync, exec } from 'child_process';
import * as log from 'electron-log';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LabelData, PrinterInfo, PrintResult } from '../shared/types';

export class PrinterManager {
  private cachedPrinters: PrinterInfo[] = [];
  private lastCacheTime = 0;
  private cacheTimeout = 30000; // 30 секунд

  public async getPrinters(): Promise<PrinterInfo[]> {
    const now = Date.now();
    
    // Возвращаем кешированные принтеры, если кеш свежий
    if (this.cachedPrinters.length > 0 && (now - this.lastCacheTime) < this.cacheTimeout) {
      return this.cachedPrinters;
    }

    try {
      const printers = await this.discoverPrinters();
      this.cachedPrinters = printers;
      this.lastCacheTime = now;
      return printers;
    } catch (error) {
      log.error('Ошибка получения списка принтеров:', error);
      return this.cachedPrinters; // Возвращаем старый кеш при ошибке
    }
  }

  private async discoverPrinters(): Promise<PrinterInfo[]> {
    const platform = process.platform;
    
    switch (platform) {
      case 'win32':
        return this.getWindowsPrinters();
      case 'darwin':
        return this.getMacOSPrinters();
      case 'linux':
        return this.getLinuxPrinters();
      default:
        throw new Error(`Неподдерживаемая платформа: ${platform}`);
    }
  }

  private async getWindowsPrinters(): Promise<PrinterInfo[]> {
    return new Promise((resolve, reject) => {
      // PowerShell команда для получения принтеров
      const command = `Get-Printer | ConvertTo-Json`;
      
      exec(`powershell -Command "${command}"`, { encoding: 'utf8' }, (error, stdout, stderr) => {
        if (error) {
          log.error('Ошибка выполнения PowerShell:', error);
          reject(error);
          return;
        }

        if (stderr) {
          log.warn('PowerShell stderr:', stderr);
        }

        try {
          const printersData = JSON.parse(stdout);
          const printers = Array.isArray(printersData) ? printersData : [printersData];
          
          const printerInfos: PrinterInfo[] = printers
            .filter(p => p && p.Name)
            .map(p => ({
              name: p.Name || '',
              displayName: p.Name || '',
              description: p.Comment || p.Name || '',
              status: this.mapWindowsStatus(p.PrinterStatus || 0),
              isDefault: p.Default === true,
              type: this.detectPrinterType(p.Name || '', p.Comment || '')
            }));

          log.info(`Найдено принтеров Windows: ${printerInfos.length}`);
          resolve(printerInfos);
        } catch (parseError) {
          log.error('Ошибка парсинга данных принтеров:', parseError);
          reject(parseError);
        }
      });
    });
  }

  private async getMacOSPrinters(): Promise<PrinterInfo[]> {
    return new Promise((resolve, reject) => {
      exec('lpstat -p -d', { encoding: 'utf8' }, (error, stdout, stderr) => {
        if (error && error.code !== 1) { // lpstat может возвращать код 1, если нет принтеров
          log.error('Ошибка выполнения lpstat:', error);
          reject(error);
          return;
        }

        if (stderr && !stderr.includes('no default destination')) {
          log.warn('lpstat stderr:', stderr);
        }

        try {
          const printerInfos: PrinterInfo[] = [];
          const lines = stdout.split('\\n');
          let defaultPrinter = '';

          // Ищем принтер по умолчанию
          const defaultLine = lines.find(line => line.startsWith('system default destination:'));
          if (defaultLine) {
            defaultPrinter = defaultLine.split(': ')[1] || '';
          }

          // Парсим принтеры
          lines.forEach(line => {
            const match = line.match(/^printer (.*?) (.*)/);
            if (match && match[1]) {
              const name = match[1];
              const status = match[2] || '';
              
              printerInfos.push({
                name: name,
                displayName: name,
                description: name,
                status: status.includes('idle') ? 'ready' : 'busy',
                isDefault: name === defaultPrinter,
                type: this.detectPrinterType(name, '')
              });
            }
          });

          log.info(`Найдено принтеров macOS: ${printerInfos.length}`);
          resolve(printerInfos);
        } catch (parseError) {
          log.error('Ошибка парсинга данных принтеров macOS:', parseError);
          reject(parseError);
        }
      });
    });
  }

  private async getLinuxPrinters(): Promise<PrinterInfo[]> {
    return new Promise((resolve, reject) => {
      exec('lpstat -p -d', { encoding: 'utf8' }, (error, stdout, stderr) => {
        if (error && error.code !== 1) {
          log.error('Ошибка выполнения lpstat Linux:', error);
          reject(error);
          return;
        }

        if (stderr) {
          log.warn('lpstat Linux stderr:', stderr);
        }

        try {
          const printerInfos: PrinterInfo[] = [];
          const lines = stdout.split('\\n');
          let defaultPrinter = '';

          // Ищем принтер по умолчанию
          const defaultLine = lines.find(line => line.includes('default destination:'));
          if (defaultLine) {
            defaultPrinter = defaultLine.split(': ')[1] || '';
          }

          // Парсим принтеры
          lines.forEach(line => {
            const match = line.match(/^printer (.*?) (.*)/);
            if (match && match[1]) {
              const name = match[1];
              const status = match[2] || '';
              
              printerInfos.push({
                name: name,
                displayName: name,
                description: name,
                status: status.includes('idle') ? 'ready' : 'busy',
                isDefault: name === defaultPrinter,
                type: this.detectPrinterType(name, '')
              });
            }
          });

          log.info(`Найдено принтеров Linux: ${printerInfos.length}`);
          resolve(printerInfos);
        } catch (parseError) {
          log.error('Ошибка парсинга данных принтеров Linux:', parseError);
          reject(parseError);
        }
      });
    });
  }

  private mapWindowsStatus(status: number): 'ready' | 'busy' | 'error' | 'offline' {
    // Статусы Windows принтеров
    switch (status) {
      case 0: return 'ready';      // Idle
      case 1: return 'busy';       // Processing
      case 2: return 'busy';       // Printing
      case 3: return 'error';      // Error
      case 4: return 'offline';    // Offline
      case 5: return 'error';      // Paper jam
      case 6: return 'error';      // Out of paper
      case 7: return 'busy';       // Manual feed required
      default: return 'ready';
    }
  }

  private detectPrinterType(name: string, description: string): 'thermal' | 'inkjet' | 'laser' | 'unknown' {
    const text = (name + ' ' + description).toLowerCase();
    
    if (text.includes('thermal') || text.includes('zebra') || text.includes('label')) {
      return 'thermal';
    } else if (text.includes('laser') || text.includes('hp laser') || text.includes('brother laser')) {
      return 'laser';
    } else if (text.includes('inkjet') || text.includes('deskjet') || text.includes('officejet')) {
      return 'inkjet';
    }
    
    return 'unknown';
  }

  public async testPrint(printerName: string): Promise<PrintResult> {
    log.info(`Тестовая печать на принтере: ${printerName}`);
    
    try {
      const testLabel: LabelData = {
        // Обязательные поля (обновлено под новый интерфейс)
        id: 'test-' + Date.now(),
        labelId: 'TEST01',
        category: 'ТЕСТ ПЕЧАТИ', // Основное поле (было name)
        temperature: '+4°C',
        shelfLifeDays: 1,
        productionDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        preparerName: 'CloudChef Agent', // Обновлено: было chef
        copies: 1,
        
        // Дополнительные поля
        method: 'тестирование',
        comment: 'Тестовая этикетка для проверки работы принтера',
        purpose: 'test'
      };

      return await this.printLabel(printerName, testLabel);
    } catch (error) {
      log.error('Ошибка тестовой печати:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  public async printLabel(printerName: string, labelData: LabelData): Promise<PrintResult> {
    log.info(`Печать этикетки на принтере "${printerName}":`, labelData);
    
    try {
      // Генерируем содержимое этикетки
      const labelContent = this.generateLabelContent(labelData);
      
      // Создаем временный файл
      const tempFile = path.join(os.tmpdir(), `cloudchef-label-${Date.now()}.txt`);
      fs.writeFileSync(tempFile, labelContent, 'utf8');
      
      // Печатаем в зависимости от платформы
      const platform = process.platform;
      let success = false;
      
      switch (platform) {
        case 'win32':
          success = await this.printWindows(printerName, tempFile);
          break;
        case 'darwin':
          success = await this.printMacOS(printerName, tempFile);
          break;
        case 'linux':
          success = await this.printLinux(printerName, tempFile);
          break;
        default:
          throw new Error(`Печать не поддерживается на платформе: ${platform}`);
      }
      
      // Удаляем временный файл
      try {
        fs.unlinkSync(tempFile);
      } catch (cleanupError) {
        log.warn('Не удалось удалить временный файл:', cleanupError);
      }
      
      if (success) {
        log.info('Этикетка напечатана успешно');
        return { success: true };
      } else {
        throw new Error('Печать не удалась');
      }
      
    } catch (error) {
      log.error('Ошибка печати этикетки:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  private generateLabelContent(labelData: LabelData): string {
    // Если есть готовый HTML, используем его (в упрощенном виде для текста)
    if (labelData.html) {
      // Извлекаем основную информацию из HTML или используем поля напрямую
      log.info('🎨 Используем HTML контент для генерации этикетки');
    }
    
    // Форматируем даты для отображения
    const productionDate = labelData.productionDate ? 
      new Date(labelData.productionDate).toLocaleDateString('ru-RU') : 'Не указана';
    const expiryDate = labelData.expiryDate ? 
      new Date(labelData.expiryDate).toLocaleDateString('ru-RU') : 'Не указана';
    
    // Обновленный текстовый формат этикетки с новыми полями
    const lines = [
      '====================================',
      '         ЭТИКЕТКА ПРОДУКТА',
      '====================================',
      '',
      `ПРОДУКТ: ${labelData.category}`, // Обновлено: было name
      `ПОВАР: ${labelData.preparerName || 'Не указан'}`, // Обновлено: было chef
      `ТЕМПЕРАТУРА: ${labelData.temperature || 'Не указана'}`,
      `ИЗГОТОВЛЕНО: ${productionDate}`,
      `СРОК ГОДНОСТИ: ${expiryDate}`, // Обновлено: теперь форматируется правильно
      `СРОК ХРАНЕНИЯ: ${labelData.shelfLifeDays || 'Не указан'} дн.`,
      labelData.method ? `МЕТОД: ${labelData.method}` : '',
      labelData.comment ? `КОММЕНТАРИЙ: ${labelData.comment}` : '',
      labelData.labelId ? `ID ЭТИКЕТКИ: ${labelData.labelId}` : '',
      '',
      `ДАТА ПЕЧАТИ: ${new Date().toLocaleString('ru-RU')}`,
      `КОПИЙ: ${labelData.copies || 1}`,
      '',
      '====================================',
      ''
    ];
    
    const result = lines.filter(line => line !== undefined && line !== '').join('\\n');
    log.info('📄 Сгенерированный контент этикетки:', result.substring(0, 200) + '...');
    return result;
  }

  private async printWindows(printerName: string, filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Используем notepad /p для печати текстового файла
      const command = `notepad /p "${filePath}"`;
      
      exec(command, (error) => {
        if (error) {
          log.error('Ошибка печати Windows:', error);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  private async printMacOS(printerName: string, filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const command = `lp -d "${printerName}" "${filePath}"`;
      
      exec(command, (error) => {
        if (error) {
          log.error('Ошибка печати macOS:', error);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  private async printLinux(printerName: string, filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const command = `lp -d "${printerName}" "${filePath}"`;
      
      exec(command, (error) => {
        if (error) {
          log.error('Ошибка печати Linux:', error);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  public clearCache(): void {
    this.cachedPrinters = [];
    this.lastCacheTime = 0;
    log.info('Кеш принтеров очищен');
  }
}
