# ⚡ БЫСТРОЕ РЕШЕНИЕ: Electron агент не запускается

## 🚨 **ПРОБЛЕМА**

```
[0] 1:27:49 AM - Found 0 errors. Watching for file changes.
$ 
```

❌ **Процесс `[1]` (Electron) НЕ запускается!**

---

## 🎯 **ПРИЧИНА**

IDE не запускает вторую команду из `concurrently`:
```json
"dev": "concurrently \"npm run build:watch\" \"npm run electron:dev\""
```

**Запускается только:**
- `[0]` → `npm run build:watch` ✅

**НЕ запускается:**
- `[1]` → `npm run electron:dev` ❌

---

## ✅ **РЕШЕНИЕ 1: Исправь PATH (самое частое)**

### **Шаг 1: Найди где Node.js**
```bash
which node
```

**Должно вывести:**
```
/usr/local/bin/node
# ИЛИ
/Users/твой-юзер/.nvm/versions/node/v20.x.x/bin/node
```

### **Шаг 2: Добавь в `~/.zshrc`**
```bash
# Открой файл
nano ~/.zshrc

# Добавь в конец файла:
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export PATH="/usr/local/bin:$PATH"

# Сохрани: Ctrl+O, Enter, Ctrl+X
```

### **Шаг 3: Перезагрузи терминал**
```bash
source ~/.zshrc
```

### **Шаг 4: Запусти заново**
```bash
cd cloudchef-print-agent
npm run dev
```

---

## ✅ **РЕШЕНИЕ 2: Запуск в 2 терминалах (обходной путь)**

### **Терминал 1:**
```bash
cd cloudchef-print-agent
npm run build:watch
```

Жди пока появится:
```
1:27:49 AM - Found 0 errors. Watching for file changes.
```

### **Терминал 2 (открой новый):**
```bash
cd cloudchef-print-agent
npm run electron:dev
```

Должно появиться:
```
DEBUG electron: object [...]
DEBUG electronApp: App {...}
```

**+ Окно Electron откроется!**

---

## ✅ **РЕШЕНИЕ 3: Bash скрипт (автоматическое)**

### **Создай файл `start.sh`:**
```bash
#!/bin/bash
cd "$(dirname "$0")"

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не найден!"
    echo ""
    echo "Добавь в ~/.zshrc:"
    echo 'export NVM_DIR="$HOME/.nvm"'
    echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"'
    exit 1
fi

echo "✅ Node.js: $(node --version)"
echo "✅ npm: $(npm --version)"
echo ""

# Первая компиляция
if [ ! -f "dist/main/main.js" ]; then
    echo "🔨 Компиляция..."
    npm run build
fi

# Запуск
echo "🚀 Запуск агента..."
npm run dev
```

### **Запусти:**
```bash
chmod +x start.sh
./start.sh
```

---

## 🔍 **ДИАГНОСТИКА**

### **Проверь что работает:**
```bash
# 1. Node.js в PATH
which node
node --version

# 2. Зависимости установлены
cd cloudchef-print-agent
npm list electron concurrently wait-on

# 3. Файлы скомпилированы
ls dist/main/main.js

# 4. Ручной запуск
npx electron .
```

---

## 🎯 **ЕСЛИ ВСЁ РАВНО НЕ РАБОТАЕТ**

### **Собери debug информацию:**
```bash
cd cloudchef-print-agent

{
  echo "=== Node.js ==="
  which node
  node --version
  echo ""
  
  echo "=== PATH ==="
  echo $PATH
  echo ""
  
  echo "=== npm run dev ==="
  npm run dev
} > debug.txt 2>&1

cat debug.txt
```

**Отправь мне файл `debug.txt`!**

---

## ✅ **УСПЕШНЫЙ ЗАПУСК:**

```
$ npm run dev

[0] 1:27:48 AM - Starting compilation in watch mode...
[0] 1:27:49 AM - Found 0 errors. Watching for file changes.
[1] DEBUG electron: object [...]        ← ЭТО ДОЛЖНО БЫТЬ!
[1] DEBUG electronApp: App {...}        ← ЭТО ДОЛЖНО БЫТЬ!
```

**+ Окно Electron открылось = ВСЁ РАБОТАЕТ! 🎉**

---

## 📞 **ПОДДЕРЖКА**

**Самая частая проблема:** IDE не видит Node.js в PATH

**Решение:** Добавь в `~/.zshrc`:
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

Затем перезапусти терминал IDE.

---

*Версия: 1.0 | Дата: 2025-10-03*


