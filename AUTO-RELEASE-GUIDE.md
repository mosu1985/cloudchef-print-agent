# 🤖 Автоматическое создание релиза на GitHub

## 🎯 Цель
Создать релиз CloudChef Print Agent v1.1.2 на GitHub автоматически через API.

## 🔑 Шаг 1: Создание Personal Access Token

1. **Перейдите** на https://github.com/settings/tokens
2. **Нажмите** "Generate new token" → "Generate new token (classic)"
3. **Введите название**: "CloudChef Release Automation"
4. **Выберите права**:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `write:packages` (Upload packages to GitHub Package Registry)
5. **Нажмите** "Generate token"
6. **Скопируйте токен** (он покажется только один раз!)

## 🚀 Шаг 2: Автоматическое создание релиза

Выполните следующие команды в терминале:

```bash
# Перейдите в папку проекта
cd /Users/mihailcarazan/Documents/Cursor/cloudchef-print-agent

# Установите токен (замените YOUR_TOKEN на ваш токен)
export GITHUB_TOKEN="YOUR_TOKEN"

# Создайте релиз
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/mosu1985/cloudchef-print-agent/releases \
  -d @release-data.json
```

## 📤 Шаг 3: Загрузка файлов

После создания релиза загрузите файлы:

```bash
# Получите ID релиза
RELEASE_ID=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/mosu1985/cloudchef-print-agent/releases/tags/v1.1.2 \
  | jq -r '.id')

echo "Release ID: $RELEASE_ID"

# Загрузите Windows установщик
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"release-files/CloudChef Print Agent Setup 1.1.2.exe" \
  "https://uploads.github.com/repos/mosu1985/cloudchef-print-agent/releases/$RELEASE_ID/assets?name=CloudChef%20Print%20Agent%20Setup%201.1.2.exe"

# Загрузите macOS DMG
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"release-files/CloudChef Print Agent-1.1.2-arm64.dmg" \
  "https://uploads.github.com/repos/mosu1985/cloudchef-print-agent/releases/$RELEASE_ID/assets?name=CloudChef%20Print%20Agent-1.1.2-arm64.dmg"

# Загрузите macOS ZIP
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"release-files/CloudChef Print Agent-1.1.2-arm64-mac.zip" \
  "https://uploads.github.com/repos/mosu1985/cloudchef-print-agent/releases/$RELEASE_ID/assets?name=CloudChef%20Print%20Agent-1.1.2-arm64-mac.zip"
```

## 🎯 Альтернативный способ: Веб-интерфейс

Если автоматизация не работает, используйте веб-интерфейс:

1. **Откройте**: https://github.com/mosu1985/cloudchef-print-agent/releases
2. **Нажмите**: "Create a new release"
3. **Выберите тег**: v1.1.2
4. **Заполните поля**:
   - Title: `CloudChef Print Agent v1.1.2 - Fix Auto-fill Fields`
   - Description: Скопируйте из файла `release-data.json`
5. **Загрузите файлы** из папки `release-files/`
6. **Нажмите**: "Publish release"

## ✅ Проверка

После создания релиза проверьте ссылки:

- **Windows**: https://github.com/mosu1985/cloudchef-print-agent/releases/download/v1.1.2/CloudChef%20Print%20Agent%20Setup%201.1.2.exe
- **macOS**: https://github.com/mosu1985/cloudchef-print-agent/releases/download/v1.1.2/CloudChef%20Print%20Agent-1.1.2-arm64.dmg

## 🔄 Обновление веб-приложения

После создания релиза:

1. **Веб-приложение уже обновлено** (файл `AgentsPanel.tsx`)
2. **Задеплойте** веб-приложение на Vercel
3. **Проверьте** работу ссылок для скачивания

---

**Статус**: ✅ Готово к автоматизации  
**Файлы подготовлены**: ✅  
**Веб-приложение обновлено**: ✅
