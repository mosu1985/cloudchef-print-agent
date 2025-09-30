#!/usr/bin/env node

/**
 * 🧪 Скрипт для тестирования первого запуска CloudChef Print Agent
 * 
 * Этот скрипт:
 * 1. Сбрасывает флаг isFirstRun в настройках агента
 * 2. Позволяет протестировать popup автозапуска при первом запуске
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Путь к файлу настроек electron-store
const getConfigPath = () => {
  if (process.platform === 'win32') {
    return path.join(os.homedir(), 'AppData', 'Roaming', 'cloudchef-print-agent', 'config.json');
  } else if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'cloudchef-print-agent', 'config.json');
  } else {
    return path.join(os.homedir(), '.config', 'cloudchef-print-agent', 'config.json');
  }
};

const configPath = getConfigPath();

console.log('🧪 Тест первого запуска CloudChef Print Agent');
console.log('📁 Путь к настройкам:', configPath);

try {
  if (fs.existsSync(configPath)) {
    // Читаем существующие настройки
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    console.log('📋 Текущие настройки:');
    console.log('   isFirstRun:', config.isFirstRun ?? 'undefined');
    console.log('   autoLaunch:', config.autoLaunch ?? 'undefined');
    
    // Сбрасываем флаг первого запуска
    config.isFirstRun = true;
    
    // Записываем обновленные настройки
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log('✅ Настройки обновлены:');
    console.log('   isFirstRun: true (сброшено для тестирования)');
    console.log('');
    
    const osName = process.platform === 'win32' ? 'Windows' : 
                   process.platform === 'darwin' ? 'macOS' : 'Linux';
    
    console.log(`🚀 Теперь запустите агент для тестирования popup автозапуска на ${osName}:`);
    console.log('   npm run dev');
    console.log('');
    
  } else {
    console.log('ℹ️  Файл настроек не найден.');
    console.log('   Это нормально, если агент еще не запускался.');
    console.log('   При первом запуске будут использованы настройки по умолчанию.');
    console.log('');
    
    const osName = process.platform === 'win32' ? 'Windows' : 
                   process.platform === 'darwin' ? 'macOS' : 'Linux';
    
    console.log(`🚀 Запустите агент для тестирования на ${osName}:`);
    console.log('   npm run dev');
    console.log('');
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
}

console.log('📖 Что ожидать:');
console.log('1. Агент запустится');
console.log('2. Появится popup с вопросом об автозапуске');
console.log('3. При выборе "Да" - автозапуск включится');
console.log('4. При выборе "Нет" - автозапуск останется отключен');
console.log('5. Флаг isFirstRun будет установлен в false');
console.log('');
console.log('🔄 Для повторного тестирования запустите этот скрипт снова');
