# Dockerfile для разработки CloudChef Print Agent
# Использовать на macOS 26 Beta где Electron не работает

FROM ubuntu:24.04

# Отключить интерактивные prompts
ENV DEBIAN_FRONTEND=noninteractive

# Установить базовые зависимости
RUN apt-get update && apt-get install -y \
    curl \
    git \
    wget \
    gnupg \
    ca-certificates \
    # Зависимости для Electron
    libgtk-3-0 \
    libnotify4 \
    libnss3 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    libatspi2.0-0 \
    libdrm2 \
    libgbm1 \
    libasound2t64 \
    libx11-xcb1 \
    # Виртуальный дисплей для headless режима
    xvfb \
    tigervnc-standalone-server \
    tigervnc-common \
    fluxbox \
    xterm \
    && rm -rf /var/lib/apt/lists/*

# Установить Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm@latest

# Создать пользователя разработчика (не root для безопасности)
RUN useradd -m -s /bin/bash developer \
    && mkdir -p /home/developer/app \
    && chown -R developer:developer /home/developer

# Переключиться на пользователя
USER developer
WORKDIR /home/developer/app

# Копировать package files
COPY --chown=developer:developer package*.json ./

# Установить зависимости
RUN npm install

# Удалить chrome-sandbox чтобы избежать проблем с правами
RUN rm -f /home/developer/app/node_modules/electron/dist/chrome-sandbox

# Копировать остальной код
COPY --chown=developer:developer . .

# Настроить виртуальный дисплей
ENV DISPLAY=:99
ENV ELECTRON_DISABLE_GPU=1
ENV ELECTRON_NO_SANDBOX=1

# Скрипт для запуска с виртуальным дисплеем и VNC
RUN echo '#!/bin/bash\n\
# Удаляем chrome-sandbox чтобы избежать проблем\n\
rm -f /home/developer/app/node_modules/electron/dist/chrome-sandbox\n\
# Обновляем package.json чтобы добавить --no-sandbox\n\
sed -i "s/electron out\\/main\\/main.js/electron out\\/main\\/main.js --no-sandbox/g" /home/developer/app/package.json\n\
# Создаем директорию для VNC\n\
mkdir -p ~/.vnc\n\
# Устанавливаем пароль для VNC\n\
echo "password" | vncpasswd -f > ~/.vnc/passwd\n\
chmod 600 ~/.vnc/passwd\n\
# Запускаем Xvfb\n\
Xvfb :99 -screen 0 1280x720x24 > /dev/null 2>&1 &\n\
sleep 2\n\
# Запускаем оконный менеджер Fluxbox\n\
DISPLAY=:99 fluxbox > /dev/null 2>&1 &\n\
sleep 1\n\
# Запускаем TigerVNC сервер\n\
DISPLAY=:99 vncserver :99 -rfbport 5900 -localhost no -SecurityTypes VncAuth -PasswordFile ~/.vnc/passwd > /dev/null 2>&1 &\n\
sleep 2\n\
exec "$@"' > /home/developer/entrypoint.sh \
    && chmod +x /home/developer/entrypoint.sh

ENTRYPOINT ["/home/developer/entrypoint.sh"]

# По умолчанию запускать dev mode
CMD ["npm", "run", "dev"]
