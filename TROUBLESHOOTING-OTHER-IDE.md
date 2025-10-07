# 🔧 Troubleshooting: Запуск Electron Agent в других IDE

> **Проблема:** Electron агент не запускается через `npm run dev`, компиляция TypeScript работает, но Electron процесс не стартует.

---

## 🚨 **СИМПТОМЫ ПРОБЛЕМЫ**

### **Что видно в терминале:**
```
[0] 1:27:48 AM - Starting compilation in watch mode...
[0] 1:27:49 AM - Found 0 errors. Watching for file changes.
$ 
```

### **Что ДОЛЖНО быть:**
```
[0] 1:27:48 AM - Starting compilation in watch mode...
[0] 1:27:49 AM - Found 0 errors. Watching for file changes.
[1] DEBUG electron: object [...]          ← ЭТО ОТСУТСТВУЕТ!
[1] DEBUG electronApp: App {...}          ← ЭТО ОТСУТСТВУЕТ!
```

### **Проблема:**
- ✅ TypeScript компилятор работает (процесс `[0]`)
- ❌ Electron НЕ запускается (процесс `[1]` отсутствует)

---

## 🎯 **КОРНЕВАЯ ПРИЧИНА**

### **`concurrently` не запускает вторую команду**

В `package.json`:
```json
"dev": "concurrently \"npm run build:watch\" \"npm run electron:dev\""
```

Эта команда должна запустить **2 процесса параллельно**:
- `[0]` → `npm run build:watch` ✅ работает
- `[1]` → `npm run electron:dev` ❌ НЕ запускается

---

## 🔍 **ДИАГНОСТИКА (выполни по порядку)**

### **Шаг 1: Проверь Node.js в PATH**

```bash
which node
node --version
npm --version
```

**Ожидаемый результат:**
```
/usr/local/bin/node  (или ~/.nvm/versions/node/v20.x.x/bin/node)
v20.11.0 (или выше)
9.x.x (или выше)
```

**Если команды не найдены:**
```
-bash: node: command not found
```

➡️ **ПРОБЛЕМА: IDE не видит Node.js!** Перейди к разделу "Решение 1".

---

### **Шаг 2: Проверь зависимости**

```bash
cd cloudchef-print-agent
npm list concurrently
npm list wait-on
npm list electron
```

**Ожидаемый результат:**
```
cloudchef-print-agent@1.0.11
├── concurrently@8.2.2
├── wait-on@7.2.0
└── electron@28.1.0
```

**Если пакеты не найдены:**
```bash
npm install
```

---

### **Шаг 3: Проверь скомпилированные файлы**

```bash
ls -la dist/main/main.js
```

**Ожидаемый результат:**
```
-rw-r--r--  1 user  staff  45678 Oct  3 01:27 dist/main/main.js
```

**Если файл не существует:**
```bash
npm run build
```

---

### **Шаг 4: Ручной запуск Electron**

```bash
npx electron .
```

**Если работает:**
- ✅ Electron установлен правильно
- ✅ Код компилируется корректно
- ❌ Проблема в `concurrently` или `wait-on`

**Если НЕ работает:**
- Смотри ошибку и переходи к разделу "Типичные ошибки"

---

## ✅ **РЕШЕНИЯ**

### **Решение 1: Исправить PATH к Node.js (САМОЕ ЧАСТОЕ)**

#### **Вариант A: Через .zshrc / .bashrc**

1. Найди где установлен Node.js:
```bash
# Если используешь nvm
echo $NVM_DIR
ls ~/.nvm/versions/node/

# Если установлен глобально
which node
```

2. Добавь в `~/.zshrc` (или `~/.bashrc`):
```bash
# Для nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Или для глобального Node.js
export PATH="/usr/local/bin:$PATH"
```

3. Перезагрузи терминал:
```bash
source ~/.zshrc
# или
source ~/.bashrc
```

4. Проверь:
```bash
which node
node --version
```

#### **Вариант B: Прямой запуск с полным путём**

```bash
/usr/local/bin/node /usr/local/bin/npm run dev
# или
~/.nvm/versions/node/v20.11.0/bin/node ~/.nvm/versions/node/v20.11.0/bin/npm run dev
```

#### **Вариант C: Настройка IDE**

**VS Code:**
1. `Cmd + Shift + P` → "Preferences: Open Settings (JSON)"
2. Добавь:
```json
{
  "terminal.integrated.env.osx": {
    "PATH": "/usr/local/bin:${env:PATH}"
  }
}
```

**WebStorm / IntelliJ:**
1. Preferences → Tools → Terminal
2. Environment variables: `PATH=/usr/local/bin:$PATH`

**Sublime Text:**
1. Preferences → Package Settings → Terminal → Settings
2. Добавь:
```json
{
  "env": {
    "PATH": "/usr/local/bin:/usr/bin:/bin"
  }
}
```

---

### **Решение 2: Запуск в двух терминалах (обходной путь)**

**Терминал 1:**
```bash
cd cloudchef-print-agent
npm run build:watch
```

**Ждём появления:**
```
1:27:49 AM - Found 0 errors. Watching for file changes.
```

**Терминал 2** (открой новый):
```bash
cd cloudchef-print-agent
npm run electron:dev
```

**Должно появиться:**
```
DEBUG electron: object [...]
DEBUG electronApp: App {...}
```

---

### **Решение 3: Упрощённый package.json**

Измени `package.json` для упрощённого запуска:

```json
{
  "scripts": {
    "dev": "npm run build && npm run dev:both",
    "dev:both": "concurrently \"npm run build:watch\" \"npm run electron:dev\"",
    "dev:simple": "tsc && electron .",
    "build": "tsc",
    "build:watch": "tsc -w",
    "electron:dev": "wait-on ./dist/main/main.js && electron ."
  }
}
```

**Затем используй:**
```bash
npm run dev:simple   # Без watch-режима (быстрый тест)
npm run dev          # Полный dev режим
```

---

### **Решение 4: Bash скрипт для запуска**

Создай файл `start-dev.sh` в корне проекта:

```bash
#!/bin/bash

# Переход в директорию проекта
cd "$(dirname "$0")"

echo "🔍 Проверка окружения..."

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не найден в PATH!"
    echo ""
    echo "Возможные решения:"
    echo "1. Установи Node.js: https://nodejs.org/"
    echo "2. Если используешь nvm: добавь в ~/.zshrc:"
    echo "   export NVM_DIR=\"\$HOME/.nvm\""
    echo "   [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\""
    echo ""
    exit 1
fi

echo "✅ Node.js: $(node --version)"
echo "✅ npm: $(npm --version)"

# Проверка зависимостей
if [ ! -d "node_modules" ]; then
    echo "📦 Устанавливаю зависимости..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Ошибка установки зависимостей!"
        exit 1
    fi
fi

# Проверка dist/main/main.js
if [ ! -f "dist/main/main.js" ]; then
    echo "🔨 Первичная компиляция TypeScript..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ Ошибка компиляции TypeScript!"
        exit 1
    fi
fi

echo ""
echo "🚀 Запускаю CloudChef Print Agent..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Запуск dev сервера
npm run dev
```

**Сделай исполняемым и запусти:**
```bash
chmod +x start-dev.sh
./start-dev.sh
```

---

### **Решение 5: Обновить зависимости**

```bash
cd cloudchef-print-agent

# Удалить node_modules и package-lock.json
rm -rf node_modules package-lock.json

# Переустановить всё
npm install

# Запустить
npm run dev
```

---

## 🐛 **ТИПИЧНЫЕ ОШИБКИ И РЕШЕНИЯ**

### **Ошибка 1: `env: node: No such file or directory`**

**Причина:** IDE не видит Node.js в PATH

**Решение:**
```bash
# Найди Node.js
which node

# Добавь в ~/.zshrc
export PATH="/usr/local/bin:$PATH"

# Перезагрузи терминал
source ~/.zshrc
```

---

### **Ошибка 2: `Cannot find module 'electron'`**

**Причина:** Electron не установлен

**Решение:**
```bash
npm install --save-dev electron
```

---

### **Ошибка 3: `Command failed: concurrently`**

**Причина:** concurrently не установлен

**Решение:**
```bash
npm install --save-dev concurrently wait-on
```

---

### **Ошибка 4: `Error: Cannot read properties of undefined (reading 'whenReady')`**

**Причина:** Код пытается использовать `app` до инициализации Electron

**Проверь:** В `dist/main/main.js` строки 786-801 должны быть:
```javascript
const electron = require('electron');
const electronApp = electron.app;

if (electronApp) {
  electronApp.whenReady().then(() => {
    initializeElectron();
    new CloudChefPrintAgent();
  });
}
```

**Решение:** Пересобери код:
```bash
npm run build
npm run dev
```

---

### **Ошибка 5: `wait-on timeout`**

**Причина:** TypeScript не компилируется или файл не создаётся

**Решение:**
```bash
# Проверь ошибки компиляции
npx tsc --noEmit

# Если есть ошибки - исправь их
# Затем пересобери
npm run build
```

---

## 📋 **БЫСТРЫЙ ЧЕКЛИСТ**

Перед запуском проверь:

- [ ] Node.js установлен: `node --version`
- [ ] npm установлен: `npm --version`
- [ ] Зависимости установлены: `ls node_modules/electron`
- [ ] TypeScript скомпилирован: `ls dist/main/main.js`
- [ ] concurrently установлен: `npm list concurrently`
- [ ] wait-on установлен: `npm list wait-on`
- [ ] PATH настроен: `echo $PATH | grep node`

---

## 🎯 **ПОШАГОВАЯ ИНСТРУКЦИЯ ДЛЯ НОВОЙ IDE**

### **Метод 1: Минимальный (быстрый тест)**

```bash
cd cloudchef-print-agent
npm install
npm run build
npx electron .
```

Если Electron открылся → код работает, проблема в dev скриптах.

---

### **Метод 2: Полный dev режим**

```bash
# Шаг 1: Проверка окружения
which node && which npm

# Шаг 2: Установка зависимостей
cd cloudchef-print-agent
npm install

# Шаг 3: Первая компиляция
npm run build

# Шаг 4: Проверка файлов
ls -la dist/main/main.js

# Шаг 5: Запуск dev
npm run dev
```

---

### **Метод 3: Через bash скрипт (рекомендуется)**

```bash
# Скачай или создай start-dev.sh (см. Решение 4 выше)
chmod +x start-dev.sh
./start-dev.sh
```

---

## 🔍 **ОТЛАДОЧНАЯ ИНФОРМАЦИЯ**

Если проблема не решается, собери эту информацию:

```bash
# Сохрани вывод в файл debug.txt
{
  echo "=== System Info ==="
  uname -a
  echo ""
  
  echo "=== Node.js ==="
  which node
  node --version
  echo ""
  
  echo "=== npm ==="
  which npm
  npm --version
  echo ""
  
  echo "=== PATH ==="
  echo $PATH
  echo ""
  
  echo "=== Project Files ==="
  ls -la dist/main/
  echo ""
  
  echo "=== Dependencies ==="
  npm list electron concurrently wait-on --depth=0
  echo ""
  
  echo "=== Try Build ==="
  npm run build
  echo ""
  
  echo "=== Try Dev ==="
  npm run dev
} > debug.txt 2>&1

# Отправь файл debug.txt разработчику
cat debug.txt
```

---

## 💡 **СРАВНЕНИЕ: CURSOR vs ДРУГАЯ IDE**

### **Почему в Cursor работает, а в другой IDE нет?**

| Аспект | Cursor IDE | Другая IDE |
|--------|-----------|-----------|
| **PATH** | ✅ Автоматически подхватывает из shell | ❌ Может использовать ограниченный PATH |
| **Terminal** | ✅ Использует login shell (~/.zshrc) | ❌ Может использовать non-login shell |
| **Node.js** | ✅ Находит через nvm/asdf автоматически | ❌ Требует явной настройки |
| **npm scripts** | ✅ Выполняет через system shell | ❌ Может использовать встроенный терминал |

---

## 🚀 **ИТОГОВОЕ РЕШЕНИЕ**

### **Для большинства случаев:**

1. **Добавь в `~/.zshrc`:**
```bash
export PATH="/usr/local/bin:$PATH"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

2. **Перезапусти IDE**

3. **Запусти:**
```bash
cd cloudchef-print-agent
npm run dev
```

### **Если всё равно не работает:**

**Используй `start-dev.sh` скрипт** (см. Решение 4) - он проверит всё автоматически!

---

## 📞 **ПОДДЕРЖКА**

Если проблема сохраняется, отправь разработчику:
- Вывод команды: `npm run dev`
- Файл `debug.txt` (см. раздел "Отладочная информация")
- Название и версию твоей IDE
- Операционную систему: `uname -a`

---

## ✅ **УСПЕШНЫЙ ЗАПУСК ВЫГЛЯДИТ ТАК:**

```
$ npm run dev

> cloudchef-print-agent@1.0.11 dev
> concurrently "npm run build:watch" "npm run electron:dev"

[0] 
[0] > cloudchef-print-agent@1.0.11 build:watch
[0] > tsc -w
[0] 
[1] 
[1] > cloudchef-print-agent@1.0.11 electron:dev
[1] > wait-on ./dist/main/main.js && electron .
[1] 
[0] 1:27:48 AM - Starting compilation in watch mode...
[0] 
[0] 1:27:49 AM - Found 0 errors. Watching for file changes.
[1] DEBUG electron: object [
[1]   'nativeImage',       'shell',
[1]   'app',               'autoUpdater',
[1]   'BrowserWindow',     'clipboard',
[1]   ...
[1] ]
[1] DEBUG electronApp: App {
[1]   quit: [Function: quit],
[1]   exit: [Function: exit],
[1]   ...
[1] }
```

**Если видишь `[1] DEBUG electron` - всё работает!** 🎉

---

*Последнее обновление: 2025-10-03*  
*Версия: 1.0*


