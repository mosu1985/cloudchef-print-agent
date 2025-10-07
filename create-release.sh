#!/bin/bash

# Скрипт для создания GitHub Release v1.0.13

echo "🚀 Создание GitHub Release v1.0.13..."
echo ""
echo "📋 Откройте эту ссылку в браузере:"
echo "https://github.com/mosu1985/cloudchef-print-agent/releases/new?tag=v1.0.13&title=v1.0.13%20-%20Fix%20infinite%20reconnection%20on%20auth%20error"
echo ""
echo "📦 Загрузите следующие файлы:"
echo "  ✅ CloudChef Print Agent-1.0.13-arm64-mac.zip"
echo "  ✅ CloudChef Print Agent-1.0.13-arm64-mac.zip.blockmap"
echo "  ✅ CloudChef Print Agent-1.0.13-arm64.dmg"
echo "  ✅ CloudChef Print Agent-1.0.13-arm64.dmg.blockmap"
echo ""
echo "📝 Описание релиза:"
cat << 'EOF'

## 🔧 Исправления

- Добавлен обработчик события `authentication_error`
- Остановка попыток переподключения при невалидном токене
- Отключение socket и очистка всех слушателей при ошибке аутентификации
- Понятное сообщение об ошибке пользователю
- Предотвращение мигания UI и разрядки батареи из-за бесконечных переподключений

**Фикс:** Мигание агента между подключен/отключен при невалидном токене

---

## 📦 Установка

1. Скачайте `.dmg` или `.zip` файл
2. Установите приложение
3. Агент автоматически обновится при следующем запуске

EOF

echo ""
echo "🎯 Затем нажмите 'Publish release'"
echo ""

# Открываем Finder с файлами релиза
echo "📂 Открываю папку с файлами релиза..."
open release/

# Открываем браузер с формой создания релиза
echo "🌐 Открываю форму создания релиза в браузере..."
open "https://github.com/mosu1985/cloudchef-print-agent/releases/new?tag=v1.0.13&title=v1.0.13%20-%20Fix%20infinite%20reconnection%20on%20auth%20error"

echo ""
echo "✅ Готово! Следуйте инструкциям выше."
