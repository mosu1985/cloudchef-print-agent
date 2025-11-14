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
exports.PrinterManager = void 0;
const child_process_1 = require("child_process");
const log = __importStar(require("electron-log"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const electron_1 = require("electron");
class PrinterManager {
    cachedPrinters = [];
    lastCacheTime = 0;
    cacheTimeout = 30000; // 30 секунд
    async getPrinters() {
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
        }
        catch (error) {
            log.error('Ошибка получения списка принтеров:', error);
            return this.cachedPrinters; // Возвращаем старый кеш при ошибке
        }
    }
    async discoverPrinters() {
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
    async getWindowsPrinters() {
        return new Promise((resolve, reject) => {
            // PowerShell команда для получения принтеров
            const command = `Get-Printer | ConvertTo-Json`;
            (0, child_process_1.exec)(`powershell -Command "${command}"`, { encoding: 'utf8' }, (error, stdout, stderr) => {
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
                    const printerInfos = printers
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
                }
                catch (parseError) {
                    log.error('Ошибка парсинга данных принтеров:', parseError);
                    reject(parseError);
                }
            });
        });
    }
    async getMacOSPrinters() {
        return new Promise((resolve, reject) => {
            (0, child_process_1.exec)('lpstat -p -d', { encoding: 'utf8' }, (error, stdout, stderr) => {
                if (error && error.code !== 1) { // lpstat может возвращать код 1, если нет принтеров
                    log.error('Ошибка выполнения lpstat:', error);
                    reject(error);
                    return;
                }
                if (stderr && !stderr.includes('no default destination')) {
                    log.warn('lpstat stderr:', stderr);
                }
                try {
                    const printerInfos = [];
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
                }
                catch (parseError) {
                    log.error('Ошибка парсинга данных принтеров macOS:', parseError);
                    reject(parseError);
                }
            });
        });
    }
    async getLinuxPrinters() {
        return new Promise((resolve, reject) => {
            (0, child_process_1.exec)('lpstat -p -d', { encoding: 'utf8' }, (error, stdout, stderr) => {
                if (error && error.code !== 1) {
                    log.error('Ошибка выполнения lpstat Linux:', error);
                    reject(error);
                    return;
                }
                if (stderr) {
                    log.warn('lpstat Linux stderr:', stderr);
                }
                try {
                    const printerInfos = [];
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
                }
                catch (parseError) {
                    log.error('Ошибка парсинга данных принтеров Linux:', parseError);
                    reject(parseError);
                }
            });
        });
    }
    mapWindowsStatus(status) {
        // Статусы Windows принтеров
        switch (status) {
            case 0: return 'ready'; // Idle
            case 1: return 'busy'; // Processing
            case 2: return 'busy'; // Printing
            case 3: return 'error'; // Error
            case 4: return 'offline'; // Offline
            case 5: return 'error'; // Paper jam
            case 6: return 'error'; // Out of paper
            case 7: return 'busy'; // Manual feed required
            default: return 'ready';
        }
    }
    detectPrinterType(name, description) {
        const text = (name + ' ' + description).toLowerCase();
        if (text.includes('thermal') || text.includes('zebra') || text.includes('label')) {
            return 'thermal';
        }
        else if (text.includes('laser') || text.includes('hp laser') || text.includes('brother laser')) {
            return 'laser';
        }
        else if (text.includes('inkjet') || text.includes('deskjet') || text.includes('officejet')) {
            return 'inkjet';
        }
        return 'unknown';
    }
    async testPrint(printerName) {
        log.info(`Тестовая печать на принтере: ${printerName}`);
        try {
            // Создаем простой текстовый файл для тестирования
            const testText = 'CloudChef Print Agent Test';
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
            }
            catch (cleanupError) {
                log.warn('Не удалось удалить временный файл:', cleanupError);
            }
            if (success) {
                log.info('Тестовая печать выполнена успешно');
                return { success: true };
            }
            else {
                throw new Error('Тестовая печать не удалась');
            }
        }
        catch (error) {
            log.error('Ошибка тестовой печати:', error);
            return {
                success: false,
                error: String(error)
            };
        }
    }
    async printLabel(printerName, labelData, offsetHorizontal = 0, offsetVertical = 0) {
        log.info(`Печать этикетки на принтере "${printerName}":`, labelData);
        try {
            // Если есть HTML - используем ПРЯМУЮ ПЕЧАТЬ (как в старой версии)
            if (labelData.html) {
                log.info('🎨 ПРЯМАЯ ПЕЧАТЬ HTML (без PDF, как в оригинальной версии)');
                const success = await this.printHTMLDirectly(printerName, labelData.html, offsetHorizontal, offsetVertical, labelData.copies || 1);
                if (success) {
                    log.info('✅ Этикетка напечатана успешно (прямая печать)');
                    return { success: true };
                }
                else {
                    throw new Error('Прямая печать не удалась');
                }
            }
            else {
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
                }
                catch (cleanupError) {
                    log.warn('Не удалось удалить временный файл:', cleanupError);
                }
                if (success) {
                    log.info('Этикетка напечатана успешно (текст)');
                    return { success: true };
                }
                else {
                    throw new Error('Печать не удалась');
                }
            }
        }
        catch (error) {
            log.error('Ошибка печати этикетки:', error);
            return {
                success: false,
                error: String(error)
            };
        }
    }
    async printHTMLDirectly(printerName, html, offsetHorizontal, offsetVertical, copies = 1) {
        // 🔧 FIX: Печатаем по 1 копии N раз для правильной калибровки термопринтера
        log.info(`🖨️ ПРЯМАЯ ПЕЧАТЬ HTML: ${copies} копий`);
        for (let i = 1; i <= copies; i++) {
            log.info(`📄 Печать копии ${i}/${copies}`);
            const success = await this.printSingleLabelHTML(printerName, html, offsetHorizontal, offsetVertical);
            if (!success) {
                log.error(`❌ Ошибка печати копии ${i}/${copies}`);
                return false;
            }
            // ⏱️ Увеличенная пауза между копиями для TSC термопринтера (2 секунды)
            if (i < copies) {
                log.info('⏸️ Пауза 2000ms для калибровки TSC термопринтера...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                // 🖨️ Отправляем команду feed для калибровки черной метки (если поддерживается принтером)
                try {
                    await this.sendPrinterCalibrationCommand(printerName);
                }
                catch (err) {
                    log.warn('⚠️ Команда калибровки не поддерживается, продолжаем с паузой');
                }
            }
        }
        log.info(`✅ Все ${copies} копий напечатаны успешно`);
        return true;
    }
    async sendPrinterCalibrationCommand(printerName) {
        // Отправляем пустую страницу для прогона ленты и калибровки черной метки
        const platform = process.platform;
        if (platform === 'darwin') {
            // macOS: используем lp с опцией feed
            return new Promise((resolve, reject) => {
                (0, child_process_1.exec)(`echo "" | lp -d "${printerName}" -o media=Custom.60x40mm`, (error) => {
                    if (error) {
                        log.warn('Команда feed не выполнена:', error.message);
                    }
                    resolve(); // Не блокируем печать при ошибке
                });
            });
        }
        else if (platform === 'win32') {
            // Windows: отправка пустого задания для прогона ленты
            log.info('⚠️ Команда калибровки не реализована для Windows, используется только пауза');
            return Promise.resolve();
        }
        return Promise.resolve();
    }
    async printSingleLabelHTML(printerName, html, offsetHorizontal, offsetVertical) {
        return new Promise((resolve, reject) => {
            // Создаем невидимое окно для печати
            const printWindow = new electron_1.BrowserWindow({
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
            let imagesLoaded = false;
            let printStarted = false;
            // Функция для проверки загрузки всех изображений
            const checkImagesLoaded = () => {
                printWindow.webContents.executeJavaScript(`
          (function() {
            const images = document.querySelectorAll('img');
            if (images.length === 0) {
              return Promise.resolve({ loaded: 0, total: 0, errors: 0, allLoaded: true });
            }
            
            let loadedCount = 0;
            let errorCount = 0;
            const totalImages = images.length;
            
            return Promise.all(
              Array.from(images).map((img) => {
                return new Promise((resolve) => {
                  // Если изображение уже загружено
                  if (img.complete && img.naturalHeight !== 0) {
                    resolve(true);
                  } 
                  // Если изображение уже загружено, но с ошибкой
                  else if (img.complete && img.naturalHeight === 0) {
                    resolve(false);
                  } 
                  // Если изображение еще загружается
                  else {
                    const timeout = setTimeout(() => {
                      resolve(false);
                    }, 5000);
                    
                    img.onload = () => {
                      clearTimeout(timeout);
                      resolve(true);
                    };
                    img.onerror = () => {
                      clearTimeout(timeout);
                      resolve(false);
                    };
                  }
                });
              })
            ).then((results) => {
              loadedCount = results.filter(r => r === true).length;
              errorCount = results.filter(r => r === false).length;
              return { 
                loaded: loadedCount, 
                total: totalImages, 
                errors: errorCount,
                allLoaded: loadedCount + errorCount >= totalImages
              };
            });
          })()
        `).then((result) => {
                    if (result && result.allLoaded) {
                        imagesLoaded = true;
                        log.info(`✅ Изображения загружены: ${result.loaded}/${result.total} (ошибок: ${result.errors})`);
                        if (loadDone && imagesLoaded) {
                            setTimeout(() => printNow(), 200);
                        }
                    }
                    else if (result && result.total === 0) {
                        // Нет изображений - можно печатать сразу
                        imagesLoaded = true;
                        log.info('✅ Изображений нет, можно печатать');
                        if (loadDone && imagesLoaded) {
                            setTimeout(() => printNow(), 200);
                        }
                    }
                }).catch((err) => {
                    log.warn('⚠️ Ошибка проверки изображений:', err);
                    imagesLoaded = true; // Продолжаем печать даже если проверка не удалась
                    if (loadDone && imagesLoaded) {
                        setTimeout(() => printNow(), 200);
                    }
                });
            };
            const finishLoad = (tag) => {
                if (loadDone)
                    return;
                loadDone = true;
                log.info(`✅ HTML готов к печати: ${tag}`);
                // Проверяем загрузку изображений
                setTimeout(() => {
                    checkImagesLoaded();
                    // Fallback: если через 3 секунды изображения не загрузились, печатаем все равно
                    setTimeout(() => {
                        if (!imagesLoaded) {
                            log.warn('⚠️ Таймаут загрузки изображений, печатаем без них');
                            imagesLoaded = true;
                            if (loadDone && imagesLoaded) {
                                setTimeout(() => printNow(), 200);
                            }
                        }
                    }, 3000);
                }, 100);
            };
            printWindow.webContents.once('did-finish-load', () => finishLoad('did-finish-load'));
            printWindow.webContents.once('dom-ready', () => finishLoad('dom-ready'));
            // Fallback timeout для загрузки (увеличен до 2 секунд для загрузки изображений)
            const loadTimeout = setTimeout(() => finishLoad('timeout-2s'), 2000);
            const printNow = () => {
                if (printStarted) {
                    log.warn('⚠️ Печать уже начата, пропускаем повторный вызов');
                    return;
                }
                printStarted = true;
                clearTimeout(loadTimeout);
                const printOptions = {
                    silent: true, // ✅ Без диалогов
                    printBackground: true, // ✅ Печатает фоны
                    deviceName: printerName,
                    copies: 1, // ✅ FIX: ВСЕГДА 1 копия для правильной калибровки
                    margins: { marginType: 'none' }, // ✅ Без отступов
                    dpi: {
                        horizontal: 203,
                        vertical: 203
                    },
                    pageSize: {
                        width: 60000, // 60mm
                        height: 40000 // 40mm
                    }
                };
                log.info('📋 Опции печати:', JSON.stringify(printOptions));
                let printDone = false;
                const printTimeout = setTimeout(() => {
                    if (!printDone) {
                        log.error('⏱️ Таймаут печати (7 секунд)');
                        if (!printWindow.isDestroyed())
                            printWindow.close();
                        resolve(false);
                    }
                }, 7000);
                printWindow.webContents.print(printOptions, (success, failureReason) => {
                    printDone = true;
                    clearTimeout(printTimeout);
                    log.info(`✅ Результат печати: ${success ? 'УСПЕХ' : 'ОШИБКА'} ${failureReason || ''}`);
                    if (!printWindow.isDestroyed())
                        printWindow.close();
                    resolve(success);
                });
            };
        });
    }
    wrapHTMLWithStyles(html, horizontal, vertical) {
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
    generateLabelContent(labelData) {
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
    async printWindows(printerName, filePath) {
        return new Promise((resolve) => {
            // Экранируем имя принтера и путь для PowerShell
            const escapedPrinter = printerName.replace(/"/g, '`"');
            const escapedPath = filePath.replace(/"/g, '`"').replace(/\\/g, '\\\\');
            // Определяем тип файла
            const isPDF = filePath.toLowerCase().endsWith('.pdf');
            let command;
            if (isPDF) {
                // Для PDF используем SumatraPDF или Adobe Reader для печати
                // Альтернатива: использовать встроенную печать PDF через shell
                command = `powershell -Command "Start-Process -FilePath '${escapedPath}' -ArgumentList '/t','${escapedPrinter}' -Verb Print -WindowStyle Hidden -Wait"`;
                log.info(`Отправка PDF на печать (Windows): ${printerName}`);
            }
            else {
                // Для текстовых файлов используем Out-Printer
                command = `powershell -Command "Get-Content '${escapedPath}' | Out-Printer -Name '${escapedPrinter}'"`;
                log.info(`Отправка текста на печать (Windows): ${printerName}`);
            }
            (0, child_process_1.exec)(command, { timeout: 30000 }, (error, stdout, stderr) => {
                if (error) {
                    log.error('Ошибка печати Windows:', error);
                    log.error('stderr:', stderr);
                    resolve(false);
                }
                else {
                    log.info('✅ Успешно отправлено на печать Windows');
                    if (stdout)
                        log.info('stdout:', stdout);
                    resolve(true);
                }
            });
        });
    }
    async printMacOS(printerName, filePath) {
        return new Promise((resolve) => {
            const command = `lp -d "${printerName}" "${filePath}"`;
            (0, child_process_1.exec)(command, (error) => {
                if (error) {
                    log.error('Ошибка печати macOS:', error);
                    resolve(false);
                }
                else {
                    resolve(true);
                }
            });
        });
    }
    async printLinux(printerName, filePath) {
        return new Promise((resolve) => {
            const command = `lp -d "${printerName}" "${filePath}"`;
            (0, child_process_1.exec)(command, (error) => {
                if (error) {
                    log.error('Ошибка печати Linux:', error);
                    resolve(false);
                }
                else {
                    resolve(true);
                }
            });
        });
    }
    clearCache() {
        this.cachedPrinters = [];
        this.lastCacheTime = 0;
        log.info('Кеш принтеров очищен');
    }
}
exports.PrinterManager = PrinterManager;
//# sourceMappingURL=printer-manager.js.map