# 🔧 ИСПРАВЛЕНИЕ АВТОЗАГРУЗКИ WINDOWS

## Проблема:
После удаления старой версии и установки новой, автозагрузка не работает, хотя галочка включена.

## ⚡ БЫСТРОЕ РЕШЕНИЕ:

### Вариант 1: Через PowerShell (Рекомендуется)

1. **Открыть PowerShell от имени администратора:**
   - Нажать `Win + X`
   - Выбрать "Windows PowerShell (администратор)"

2. **Удалить старую запись:**
```powershell
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "CloudChef Print Agent" -ErrorAction SilentlyContinue
```

3. **Найти путь к новому агенту:**
```powershell
Get-ChildItem "C:\Program Files\CloudChef Print Agent\*.exe"
```
   Скопировать полный путь к .exe файлу

4. **Добавить новую запись с правильным путём:**
```powershell
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "CloudChef Print Agent" -Value '"C:\Program Files\CloudChef Print Agent\CloudChef Print Agent.exe"'
```
   ⚠️ Замените путь на тот, который получили в шаге 3

5. **Проверить что запись создалась:**
```powershell
Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "CloudChef Print Agent"
```

---

### Вариант 2: Через Диспетчер задач

1. **Открыть Диспетчер задач:**
   - Нажать `Ctrl + Shift + Esc`
   
2. **Перейти во вкладку "Автозагрузка"**

3. **Найти "CloudChef Print Agent":**
   - Если он есть - проверить статус
   - Если путь битый - Удалить запись (правая кнопка → Отключить → затем удалить через реестр)

4. **После удаления старой записи:**
   - Перейти в агент → "⚙️ Общие"
   - Снять галочку "Запускать при старте системы"
   - Нажать "💾 Сохранить"
   - Подождать 2 секунды
   - Снова поставить галочку
   - Нажать "💾 Сохранить"
   - Это должно пересоздать запись с правильным путём

---

### Вариант 3: Через Редактор реестра (regedit)

1. **Открыть Редактор реестра:**
   - Нажать `Win + R`
   - Ввести `regedit`
   - Нажать Enter

2. **Перейти по пути:**
```
HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run
```

3. **Найти ключ "CloudChef Print Agent"**

4. **Удалить его:**
   - Правая кнопка → Удалить

5. **Закрыть regedit**

6. **В агенте:**
   - Снять галочку автозагрузки → Сохранить
   - Поставить галочку обратно → Сохранить

---

## 🧪 ПРОВЕРКА:

После исправления проверьте:

1. **Откройте PowerShell:**
```powershell
Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "CloudChef Print Agent"
```

Должно показать что-то вроде:
```
CloudChef Print Agent : "C:\Program Files\CloudChef Print Agent\CloudChef Print Agent.exe"
```

2. **Проверьте путь:**
   - Убедитесь что .exe файл существует по этому пути
   - Откройте проводник и проверьте

3. **Тест автозагрузки:**
   - Закройте агент (через "Выход" в трее)
   - Перезагрузите Windows
   - После входа агент должен запуститься автоматически

---

## 📝 ДЛЯ РАЗРАБОТЧИКА:

Проблема в коде: `launcher.isEnabled()` возвращает `true` даже если путь битый.

Нужно добавить проверку пути и принудительное обновление:

```typescript
private async setupAutoLaunch(): Promise<void> {
  const shouldAutoLaunch = store.get('autoLaunch');
  
  try {
    const launcher = getAutoLauncher();
    const isEnabled = await launcher.isEnabled();
    
    // НОВОЕ: Принудительно пересоздаём если нужно
    if (shouldAutoLaunch) {
      if (isEnabled) {
        // Сначала отключаем старую запись
        await launcher.disable();
      }
      // Затем создаём новую с актуальным путём
      await launcher.enable();
      log.info('✅ Автозапуск включен (принудительно обновлён)');
    } else if (isEnabled) {
      await launcher.disable();
      log.info('Автозапуск отключен');
    }
  } catch (error) {
    log.error('Ошибка настройки автозапуска:', error);
  }
}
```

Это гарантирует что путь всегда актуальный!

