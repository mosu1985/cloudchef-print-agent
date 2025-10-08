import { execSync, exec } from 'child_process';
import * as log from 'electron-log';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BrowserWindow } from 'electron';
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
      // Создаем простой текстовый файл для тестирования
      const testText = 'Hello World Bomond';
      const tempFile = path.join(os.tmpdir(), `test-print-${Date.now()}.txt`);
      fs.writeFileSync(tempFile, testText, 'utf8');
      
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
        log.info('Тестовая печать выполнена успешно');
        return { success: true };
      } else {
        throw new Error('Тестовая печать не удалась');
      }
    } catch (error) {
      log.error('Ошибка тестовой печати:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  public async printLabel(printerName: string, labelData: LabelData, offsetHorizontal = 0, offsetVertical = 0): Promise<PrintResult> {
    log.info(`Печать этикетки на принтере "${printerName}":`, labelData);
    
    try {
      // Если есть HTML - используем ПРЯМУЮ ПЕЧАТЬ (как в старой версии)
      if (labelData.html) {
        log.info('🎨 ПРЯМАЯ ПЕЧАТЬ HTML (без PDF, как в оригинальной версии)');
        const success = await this.printHTMLDirectly(
          printerName, 
          labelData.html, 
          offsetHorizontal, 
          offsetVertical,
          labelData.copies || 1
        );
        
        if (success) {
          log.info('✅ Этикетка напечатана успешно (прямая печать)');
          return { success: true };
        } else {
          throw new Error('Прямая печать не удалась');
        }
      } else {
        // Если нет HTML - используем текстовую версию (fallback)
        log.warn('⚠️ HTML не найден, используем текстовую этикетку');
        const labelContent = this.generateLabelContent(labelData);
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
          log.info('Этикетка напечатана успешно (текст)');
          return { success: true };
        } else {
          throw new Error('Печать не удалась');
        }
      }
      
    } catch (error) {
      log.error('Ошибка печати этикетки:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }
  
  private async printHTMLDirectly(printerName: string, html: string, offsetHorizontal: number, offsetVertical: number, copies: number = 1): Promise<boolean> {
    // 🔧 FIX: Печатаем по 1 копии N раз для правильной калибровки термопринтера
    log.info(`🖨️ ПРЯМАЯ ПЕЧАТЬ HTML: ${copies} копий`);
    
    for (let i = 1; i <= copies; i++) {
      log.info(`📄 Печать копии ${i}/${copies}`);
      
      const success = await this.printSingleLabelHTML(printerName, html, offsetHorizontal, offsetVertical);
      
      if (!success) {
        log.error(`❌ Ошибка печати копии ${i}/${copies}`);
        return false;
      }
      
      // ⏱️ Пауза между копиями для калибровки принтера (особенно важно для термопринтеров)
      if (i < copies) {
        log.info('⏸️ Пауза 500ms для калибровки принтера...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    log.info(`✅ Все ${copies} копий напечатаны успешно`);
    return true;
  }
  
  private async printSingleLabelHTML(printerName: string, html: string, offsetHorizontal: number, offsetVertical: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // Создаем невидимое окно для печати
      const printWindow = new BrowserWindow({
        show: false,
        frame: false,
        transparent: true,
        focusable: false,
        skipTaskbar: true,
        useContentSize: true,
        webPreferences: {
          backgroundThrottling: false,
          offscreen: true
        }
      });
      
      // Применяем офсеты к HTML и оборачиваем в полный HTML документ
      const fullHTML = this.wrapHTMLWithStyles(html, offsetHorizontal, offsetVertical);
      
      // Загружаем HTML
      printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHTML)}`);
      
      let loadDone = false;
      const finishLoad = (tag: string) => {
        if (loadDone) return;
        loadDone = true;
        log.info(`✅ HTML готов к печати: ${tag}`);
        
        // Печатаем сразу после загрузки
        setTimeout(() => printNow(), 100);
      };
      
      printWindow.webContents.once('did-finish-load', () => finishLoad('did-finish-load'));
      printWindow.webContents.once('dom-ready', () => finishLoad('dom-ready'));
      
      // Fallback timeout для загрузки
      const loadTimeout = setTimeout(() => finishLoad('timeout-500ms'), 500);
      
      const printNow = () => {
        clearTimeout(loadTimeout);
        
        const printOptions = {
          silent: true,                      // ✅ Без диалогов
          printBackground: true,              // ✅ Печатает фоны
          deviceName: printerName,
          copies: 1,                         // ✅ FIX: ВСЕГДА 1 копия для правильной калибровки
          margins: { marginType: 'none' as const },   // ✅ Без отступов
          dpi: {                             // ✅ КРИТИЧНО для термопринтеров!
            horizontal: 203,
            vertical: 203
          },
          pageSize: {                        // ✅ Точные размеры в микронах
            width: 60000,                    // 60mm
            height: 40000                    // 40mm
          }
        };
        
        log.info('📋 Опции печати:', JSON.stringify(printOptions));
        
        let printDone = false;
        const printTimeout = setTimeout(() => {
          if (!printDone) {
            log.error('⏱️ Таймаут печати (7 секунд)');
            if (!printWindow.isDestroyed()) printWindow.close();
            resolve(false);
          }
        }, 7000);
        
        printWindow.webContents.print(printOptions, (success, failureReason) => {
          printDone = true;
          clearTimeout(printTimeout);
          
          log.info(`✅ Результат печати: ${success ? 'УСПЕХ' : 'ОШИБКА'} ${failureReason || ''}`);
          
          if (!printWindow.isDestroyed()) printWindow.close();
          resolve(success);
        });
      };
    });
  }
  
  private wrapHTMLWithStyles(html: string, horizontal: number, vertical: number): string {
    // Создаем полноценный HTML документ с правильными размерами и офсетами
    const offsetTransform = (horizontal !== 0 || vertical !== 0) 
      ? `transform: translate(${horizontal}mm, ${vertical}mm);` 
      : '';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          @page {
            size: 60mm 40mm;
            margin: 0;
          }
          html, body {
            width: 60mm;
            height: 40mm;
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
          body {
            ${offsetTransform}
          }
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;
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
      // Экранируем имя принтера и путь для PowerShell
      const escapedPrinter = printerName.replace(/"/g, '`"');
      const escapedPath = filePath.replace(/"/g, '`"').replace(/\\/g, '\\\\');
      
      // Определяем тип файла
      const isPDF = filePath.toLowerCase().endsWith('.pdf');
      
      let command: string;
      
      if (isPDF) {
        // Для PDF используем SumatraPDF или Adobe Reader для печати
        // Альтернатива: использовать встроенную печать PDF через shell
        command = `powershell -Command "Start-Process -FilePath '${escapedPath}' -ArgumentList '/t','${escapedPrinter}' -Verb Print -WindowStyle Hidden -Wait"`;
        
        log.info(`Отправка PDF на печать (Windows): ${printerName}`);
      } else {
        // Для текстовых файлов используем Out-Printer
        command = `powershell -Command "Get-Content '${escapedPath}' | Out-Printer -Name '${escapedPrinter}'"`;
        
        log.info(`Отправка текста на печать (Windows): ${printerName}`);
      }
      
      exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
          log.error('Ошибка печати Windows:', error);
          log.error('stderr:', stderr);
          resolve(false);
        } else {
          log.info('✅ Успешно отправлено на печать Windows');
          if (stdout) log.info('stdout:', stdout);
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
