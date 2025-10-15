#!/bin/bash

# Скрипт для создания релиза CloudChef Print Agent v1.1.2
# Автор: AI Assistant
# Дата: 15 октября 2025

echo "🚀 Создание релиза CloudChef Print Agent v1.1.2"

# Проверяем, что мы в правильной директории
if [ ! -f "package.json" ]; then
    echo "❌ Ошибка: package.json не найден. Запустите скрипт из корня проекта."
    exit 1
fi

# Проверяем, что файлы релиза существуют
RELEASE_FILES=(
    "release-files/CloudChef Print Agent Setup 1.1.2.exe"
    "release-files/CloudChef Print Agent-1.1.2-arm64.dmg"
    "release-files/CloudChef Print Agent-1.1.2-arm64-mac.zip"
)

echo "📁 Проверка файлов релиза..."
for file in "${RELEASE_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Файл не найден: $file"
        exit 1
    fi
    echo "✅ Найден: $file"
done

# Проверяем git статус
echo "🔍 Проверка git статуса..."
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  Есть незакоммиченные изменения. Коммитим их..."
    git add .
    git commit -m "Prepare release v1.1.2 - final changes"
    git push origin main
fi

# Проверяем, что тег существует
if git tag -l | grep -q "v1.1.2"; then
    echo "✅ Тег v1.1.2 существует"
else
    echo "❌ Тег v1.1.2 не найден"
    exit 1
fi

echo ""
echo "🎯 Инструкции для создания релиза на GitHub:"
echo ""
echo "1. Откройте https://github.com/mosu1985/cloudchef-print-agent/releases"
echo "2. Нажмите 'Create a new release'"
echo "3. В поле 'Tag version' выберите: v1.1.2"
echo "4. В поле 'Release title' введите: CloudChef Print Agent v1.1.2 - Fix Auto-fill Fields"
echo ""
echo "5. В поле 'Description' вставьте:"
echo ""
cat << 'EOF'
## 🐛 Исправления

### Основная проблема: Автоматическое заполнение полей при первой установке

**Проблема:** При первой установке агента поля "Код ресторана" и "Токен агента" автоматически заполнялись тестовыми значениями ресторана Bomond.

**Решение:** 
- ✅ Удалены все тестовые значения и захардкоженные данные
- ✅ Очищены файлы конфигурации от старых настроек
- ✅ Исправлена логика автоматического подключения
- ✅ Поля теперь остаются пустыми при первой установке

## 📦 Файлы для скачивания

- **Windows**: `CloudChef Print Agent Setup 1.1.2.exe` - установщик для Windows 10+
- **macOS**: `CloudChef Print Agent-1.1.2-arm64.dmg` - установщик для macOS (Apple Silicon)
- **macOS Portable**: `CloudChef Print Agent-1.1.2-arm64-mac.zip` - портативная версия для macOS

## ⚙️ Системные требования

- **Windows**: Windows 10 или новее
- **macOS**: macOS 10.12+ (Intel или Apple Silicon)
- **Интернет-соединение** для подключения к серверу CloudChef

## 🔧 Изменения в версии 1.1.2

- ✅ **Исправлена проблема** с автоматическим заполнением полей при первой установке
- ✅ **Поля теперь пустые** при первом запуске
- ✅ **Удалены тестовые значения** ресторана Bomond
- ✅ **Улучшена стабильность** подключения
- ✅ **Обновлены зависимости** для безопасности

## 📝 Инструкции по установке

1. **Скачайте** подходящий файл для вашей ОС
2. **Установите** приложение
3. **Запустите** CloudChef Print Agent
4. **Введите код ресторана** (8 символов)
5. **Введите токен агента** (получите в веб-приложении CloudChef)
6. **Нажмите "Подключиться"**

При первой установке все поля будут пустыми - это нормально!
EOF

echo ""
echo "6. Загрузите следующие файлы:"
for file in "${RELEASE_FILES[@]}"; do
    echo "   - $file"
done

echo ""
echo "7. Нажмите 'Publish release'"
echo ""
echo "🔗 После создания релиза проверьте ссылки:"
echo "Windows: https://github.com/mosu1985/cloudchef-print-agent/releases/download/v1.1.2/CloudChef%20Print%20Agent%20Setup%201.1.2.exe"
echo "macOS: https://github.com/mosu1985/cloudchef-print-agent/releases/download/v1.1.2/CloudChef%20Print%20Agent-1.1.2-arm64.dmg"
echo ""
echo "✅ Готово! После создания релиза веб-приложение будет автоматически скачивать последнюю версию."