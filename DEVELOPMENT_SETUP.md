# 🛠️ CloudChef Print Agent - Решение проблемы разработки на macOS 26 Beta

## ⚠️ Проблема

macOS 26.0 Tahoe Beta **несовместима** с Electron в dev mode:
- `require('electron')` возвращает строку пути вместо API
- `app` is undefined внутри Electron процесса
- Это системная проблема, не решаемая обновлением пакетов

## ✅ Решения (от лучшего к худшему)

### 1. 🎯 **UTM Virtual Machine** (РЕКОМЕНДУЕТСЯ)

**Лучший вариант для Electron разработки!**

#### Установка:

```bash
# 1. Скачать UTM (бесплатно, open-source)
# https://mac.getutm.app/

# 2. Скачать Ubuntu 24.04 ARM64
# https://ubuntu.com/download/desktop/arm

# 3. Создать VM в UTM:
# - RAM: 8GB минимум (16GB рекомендуется)
# - CPU: 4 cores минимум
# - Storage: 50GB минимум
# - Включить shared folder для кода
```

#### Настройка внутри Ubuntu VM:

```bash
# Установить Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установить зависимости для Electron
sudo apt-get install -y libgtk-3-0 libnotify4 libnss3 libxss1 \
  libxtst6 xdg-utils libatspi2.0-0 libdrm2 libgbm1 libasound2

# Клонировать ваш проект
cd ~/
git clone https://github.com/mosu1985/cloudchef-print-agent.git
cd cloudchef-print-agent

# Установить зависимости
npm install

# Запустить dev mode - БУДЕТ РАБОТАТЬ! ✅
npm run dev
```

**Преимущества:**
- ✅ Полноценный GUI - видите Electron окна
- ✅ Можно установить Cursor/VSCode внутри VM
- ✅ Electron работает нативно
- ✅ Можно тестировать на разных ОС (Ubuntu, Windows VM)

**Недостатки:**
- ⚠️ Занимает ~50GB диска
- ⚠️ Потребляет RAM (8-16GB)
- ⚠️ Нужно переключаться между macOS и VM

---

### 2. 🐳 **Docker + X11** (для headless разработки)

**Хорош для backend/CLI, сложнее для GUI приложений**

#### Dockerfile:

```dockerfile
FROM ubuntu:24.04

# Установить Node.js и зависимости
RUN apt-get update && apt-get install -y \
    curl \
    libgtk-3-0 \
    libnotify4 \
    libnss3 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    libatspi2.0-0 \
    libdrm2 \
    libgbm1 \
    libasound2 \
    xvfb \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

# Запуск с виртуальным дисплеем
CMD ["xvfb-run", "-a", "npm", "run", "dev"]
```

#### docker-compose.yml:

```yaml
version: '3.8'
services:
  electron-dev:
    build: .
    volumes:
      - .:/app
      - /tmp/.X11-unix:/tmp/.X11-unix
    environment:
      - DISPLAY=${DISPLAY}
    network_mode: host
```

**Преимущества:**
- ✅ Быстрый старт
- ✅ Легко делиться с командой
- ✅ Изолированная среда

**Недостатки:**
- ❌ GUI сложно настроить (нужен XQuartz на Mac)
- ❌ Медленнее чем native
- ❌ Electron окна могут глючить

---

### 3. 🖥️ **Удаленный сервер (EC2/DigitalOcean)**

Арендовать Linux сервер и разрабатывать через SSH/VSCode Remote.

```bash
# На локальном Mac
ssh ubuntu@your-server-ip

# На сервере
git clone https://github.com/mosu1985/cloudchef-print-agent.git
cd cloudchef-print-agent
npm install
npm run dev  # Работает!
```

**Преимущества:**
- ✅ Electron работает
- ✅ Можно работать с любого устройства
- ✅ Мощное железо (можно выбрать больше CPU/RAM)

**Недостатки:**
- 💰 Стоит денег ($5-20/месяц)
- ❌ Интернет зависимость
- ❌ GUI через VNC (медленно)

---

### 4. 🔄 **Откатить macOS**

Вернуться на стабильную macOS 15 Sequoia.

```bash
# ВНИМАНИЕ: Это удалит все данные!
# Сделайте бэкап через Time Machine

# 1. Перезагрузить Mac и держать Command + R
# 2. Выбрать "Restore from Time Machine"
# 3. Выбрать бэкап до обновления на macOS 26
```

**Преимущества:**
- ✅ Все работает нативно
- ✅ Максимальная производительность
- ✅ Нет дополнительного софта

**Недостатки:**
- ⚠️ Теряете новые фичи macOS 26
- ⚠️ Нужен полный бэкап/восстановление
- ⚠️ Занимает несколько часов

---

### 5. ⏳ **Подождать обновления**

Дождаться когда Electron выпустит полную поддержку macOS 26.

**Статус:**
- Electron v38.2.2 имеет частичные фиксы для macOS 26
- Полная поддержка ожидается в Electron v39+ (Q1 2026)
- macOS 26 официальный релиз: уже вышел (сентябрь 2025)

---

## 🎯 Моя рекомендация

**Для вас лучше всего: UTM Virtual Machine**

Почему:
1. Бесплатно
2. Electron GUI будет работать сразу
3. Можете установить Cursor внутри VM и работать как обычно
4. Изолировано от macOS 26 beta проблем
5. Можете тестировать на чистой Linux системе

### Быстрый старт с UTM:

1. Скачать: https://mac.getutm.app/
2. Скачать Ubuntu: https://ubuntu.com/download/desktop/arm (ARM64!)
3. Создать VM: 8GB RAM, 4 CPU cores, 50GB storage
4. Установить Ubuntu
5. В Ubuntu Terminal:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
   sudo apt-get install -y nodejs git
   sudo apt-get install -y libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6
   git clone https://github.com/mosu1985/cloudchef-print-agent.git
   cd cloudchef-print-agent
   npm install
   npm run dev  # ✅ РАБОТАЕТ!
   ```

---

## 📊 Сравнение решений

| Решение | Сложность | Стоимость | GUI | Производительность |
|---------|-----------|-----------|-----|-------------------|
| **UTM VM** | ⭐⭐ | 💰 Free | ✅ Да | ⭐⭐⭐⭐ |
| Docker+X11 | ⭐⭐⭐⭐ | 💰 Free | ⚠️ Сложно | ⭐⭐⭐ |
| Remote Server | ⭐⭐⭐ | 💰💰 $5-20/мес | ⚠️ VNC | ⭐⭐⭐⭐⭐ |
| Откатить macOS | ⭐⭐⭐⭐⭐ | 💰 Free | ✅ Native | ⭐⭐⭐⭐⭐ |
| Подождать | ⭐ | 💰 Free | ❌ | - |

---

## 🐛 Текущая ошибка (для документации)

```
TypeError: Cannot read properties of undefined (reading 'whenReady')
    at CloudChefPrintAgent.setupAppHandlers
```

**Причина:**
macOS 26.0 Beta изменила внутренние API, из-за чего `require('electron')` возвращает строку пути к бинарнику вместо модуля API.

**Версии:**
- macOS: 26.0 (Build 25A354)
- Node: v22.20.0 (system)
- Electron: v30.5.1 → v38.2.2 (обе не работают)
- Arch: arm64 (Apple Silicon)

---

## 📞 Нужна помощь?

1. GitHub Issues: https://github.com/mosu1985/cloudchef-print-agent/issues
2. Electron Discord: https://discord.gg/electron
3. macOS 26 Beta Feedback: https://feedbackassistant.apple.com/
