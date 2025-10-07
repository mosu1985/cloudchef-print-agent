# 🚀 Как запустить Electron приложение CloudChef Print Agent

> **Быстрый гайд для запуска в любой IDE**

---

## ⚡ БЫСТРЫЙ СТАРТ

### **Команда для терминала:**
```bash
cd "/Users/mihailcarazan/Documents/Cursor/cloudchef-print-agent" && npm run dev
```

---

## 🎯 ЧТО ПРОИСХОДИТ ПРИ ЗАПУСКЕ

### **`npm run dev` запускает 2 процесса параллельно:**

#### **Процесс 1: TypeScript компиляция (watch-режим)**
```bash
tsc -w
```
- ✅ Компилирует `src/main/*.ts` → `dist/main/*.js`
- ✅ Следит за изменениями в коде
- ✅ Автоматически пересобирает при сохранении

#### **Процесс 2: Electron запуск**
```bash
wait-on ./dist/main/main.js && electron .
```
- ⏳ Ждёт завершения компиляции TypeScript
- 🖥️ Запускает Electron приложение
- 🎨 Открывает окно + системный трей

---

## 🛠️ НАСТРОЙКА В РАЗНЫХ IDE

### **VS Code**

#### **Вариант 1: Через терминал (Ctrl + `)**
```bash
cd cloudchef-print-agent
npm run dev
```

#### **Вариант 2: Через tasks.json**

Создай `.vscode/tasks.json`:
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Run Electron Dev",
      "type": "shell",
      "command": "npm run dev",
      "options": {
        "cwd": "${workspaceFolder}/cloudchef-print-agent"
      },
      "problemMatcher": [],
      "isBackground": true
    }
  ]
}
```

Запуск: `Terminal → Run Task → Run Electron Dev`

---

### **WebStorm / IntelliJ IDEA**

#### **Создай Run Configuration:**

1. `Run → Edit Configurations...`
2. `+ → npm`
3. Настройки:
   - **Name:** `Electron Dev`
   - **package.json:** `cloudchef-print-agent/package.json`
   - **Command:** `run`
   - **Scripts:** `dev`

Запуск: `Run → Electron Dev` (Shift + F10)

---

### **Sublime Text / Atom**

#### **Через встроенный терминал:**
```bash
cd cloudchef-print-agent
npm run dev
```

---

### **Любая IDE без NPM поддержки**

#### **Вручную в 2 терминалах:**

**Терминал 1 (TypeScript компиляция):**
```bash
cd /Users/mihailcarazan/Documents/Cursor/cloudchef-print-agent
npm run build:watch
```

**Терминал 2 (Electron, запускать ПОСЛЕ появления dist/main/main.js):**
```bash
cd /Users/mihailcarazan/Documents/Cursor/cloudchef-print-agent
npm run electron:dev
```

---

## 📦 ТРЕБОВАНИЯ

### **Перед первым запуском:**
```bash
cd cloudchef-print-agent
npm install
```

### **Необходимые зависимости:**
- Node.js 18+ или 20+
- npm 9+
- Установленные пакеты:
  - `electron`
  - `typescript`
  - `concurrently`
  - `wait-on`

---

## 🔍 ПРОВЕРКА ЗАПУСКА

### **Успешный запуск выглядит так:**

```
[0] 1:15:46 AM - Starting compilation in watch mode...
[0] 1:15:46 AM - Found 0 errors. Watching for file changes.
[1] DEBUG electron: object [...]
[1] DEBUG electronApp: App {...}
```

✅ **Если видишь это:**
- TypeScript скомпилирован без ошибок
- Electron запущен и готов к работе
- Окно приложения открыто
- Иконка в системном трее появилась

---

## ❌ ЧАСТЫЕ ПРОБЛЕМЫ

### **Проблема 1: `Cannot find module 'dist/main/main.js'`**

**Причина:** TypeScript не успел скомпилироваться

**Решение:**
```bash
# Сначала скомпилируй вручную
npm run build

# Потом запусти dev
npm run dev
```

---

### **Проблема 2: `Error: Electron failed to install correctly`**

**Решение:**
```bash
# Переустанови Electron
npm install electron --force

# Или полная переустановка
rm -rf node_modules package-lock.json
npm install
```

---

### **Проблема 3: TypeScript ошибки компиляции**

**Решение:**
```bash
# Проверь ошибки
npx tsc --noEmit

# Очисти старые файлы
rm -rf dist
npm run build
```

---

### **Проблема 4: Порт занят / Приложение уже запущено**

**Решение (macOS):**
```bash
# Найди процесс Electron
ps aux | grep electron

# Останови его
killall Electron
# или
pkill -f "cloudchef-print-agent"
```

**Решение (Windows):**
```cmd
taskkill /F /IM electron.exe
```

---

## 🔄 ГОРЯЧИЕ КЛАВИШИ В DEV РЕЖИМЕ

### **В Electron окне:**
- **Ctrl/Cmd + R** — Перезагрузить renderer процесс
- **Ctrl/Cmd + Shift + I** — Открыть DevTools
- **Ctrl/Cmd + Q** — Закрыть приложение

---

## 🛑 ОСТАНОВКА ПРИЛОЖЕНИЯ

### **Способ 1: Через интерфейс**
- Нажми на трей-иконку → `Выход`

### **Способ 2: Через терминал**
- `Ctrl + C` в терминале где запущен `npm run dev`

### **Способ 3: Принудительная остановка (macOS)**
```bash
killall Electron
```

### **Способ 3: Принудительная остановка (Windows)**
```cmd
taskkill /F /IM electron.exe
```

---

## 📊 СТРУКТУРА ПРОЕКТА

```
cloudchef-print-agent/
├── src/
│   ├── main/           # TypeScript исходники (main процесс)
│   │   ├── main.ts
│   │   ├── preload.ts
│   │   ├── printer-manager.ts
│   │   └── socket-manager.ts
│   ├── renderer/       # Renderer процесс (UI)
│   │   ├── index.html
│   │   └── index.ts
│   └── shared/         # Общие типы
│       └── types.ts
├── dist/               # Скомпилированные JS файлы (создаётся автоматически)
│   ├── main/
│   └── renderer/
├── assets/             # Иконки и ресурсы
├── package.json        # NPM конфигурация
├── tsconfig.json       # TypeScript конфигурация
└── webpack.config.js   # Webpack конфигурация
```

---

## 🎯 NPM SCRIPTS СПРАВКА

| Команда | Что делает |
|---------|-----------|
| `npm run dev` | Запуск в режиме разработки (watch + electron) |
| `npm run build` | Полная сборка проекта |
| `npm run build:watch` | TypeScript компиляция в watch-режиме |
| `npm run electron:dev` | Запуск только Electron (нужен скомпилированный код) |
| `npm run electron:dist` | Сборка дистрибутива (exe/dmg) |
| `npm run electron:publish` | Сборка + публикация релиза |
| `npm run release:patch` | Bump версии (x.x.+1) + git tag |

---

## 💡 ПОЛЕЗНЫЕ КОМАНДЫ

### **Проверка версий:**
```bash
node --version    # v20.x.x
npm --version     # 9.x.x
npx tsc --version # 5.x.x
```

### **Очистка кеша (если что-то сломалось):**
```bash
rm -rf node_modules dist package-lock.json
npm install
npm run build
```

### **Просмотр логов:**
```bash
# macOS
tail -f ~/Library/Logs/cloudchef-print-agent/main.log

# Windows
type %USERPROFILE%\AppData\Roaming\cloudchef-print-agent\logs\main.log
```

---

## 🔧 РАСШИРЕННАЯ НАСТРОЙКА

### **Изменить порт dev сервера:**

В `package.json` измени `electron:dev`:
```json
"electron:dev": "wait-on ./dist/main/main.js && electron . --inspect=5858"
```

### **Отключить DevTools в dev режиме:**

В `src/main/main.ts` закомментируй:
```typescript
// mainWindow.webContents.openDevTools();
```

### **Включить debug логирование:**

Перед `npm run dev`:
```bash
export ELECTRON_ENABLE_LOGGING=1
npm run dev
```

---

## 📞 ПОДДЕРЖКА

### **Если ничего не помогло:**

1. ✅ Проверь что `node_modules` установлены: `ls node_modules/electron`
2. ✅ Проверь что TypeScript компилируется: `npx tsc --noEmit`
3. ✅ Проверь что `dist/main/main.js` существует
4. ✅ Удали `dist` и `node_modules`, переустанови всё
5. ✅ Проверь логи в консоли на ошибки

---

## 🎉 ГОТОВО!

Теперь ты можешь запустить Electron приложение в любой IDE! 🚀

**Основная команда:**
```bash
cd "/Users/mihailcarazan/Documents/Cursor/cloudchef-print-agent" && npm run dev
```

---

*Последнее обновление: 2025-10-03*  
*Версия документа: 1.0*



