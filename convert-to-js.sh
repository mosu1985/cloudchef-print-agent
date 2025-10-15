#!/bin/bash
# Скрипт для конвертации TypeScript в JavaScript

echo "🔄 Конвертация TypeScript → JavaScript..."

# 1. Копируем TypeScript файлы в JavaScript
echo "📋 Копирование файлов..."
cp src/main/socket-manager.ts src/main/socket-manager.js
cp src/main/printer-manager.ts src/main/printer-manager.js
cp src/main/main.ts src/main/main.js
cp src/preload/preload.ts src/preload/preload.js
cp src/renderer/index.ts src/renderer/index.js

# 2. Удаляем импорты типов и заменяем на require
echo "🔧 Конвертация импортов..."

for file in src/main/*.js src/preload/*.js; do
  if [ -f "$file" ]; then
    # Заменяем import на require для electron
    sed -i '' 's/import { \(.*\) } from '\''electron'\'';/const { \1 } = require('\''electron'\'');/g' "$file"

    # Заменяем import * as на require
    sed -i '' 's/import \* as \(.*\) from '\''\(.*\)'\'';/const \1 = require('\''\2'\'');/g' "$file"

    # Заменяем обычные import на require
    sed -i '' 's/import \(.*\) from '\''\(.*\)'\'';/const \1 = require('\''\2'\'');/g' "$file"

    # Удаляем импорты типов
    sed -i '' '/^import.*{.*}.*from.*types/d' "$file"
    sed -i '' '/^import type/d' "$file"

    # Заменяем export class на module.exports
    sed -i '' 's/export class \(.*\) {/class \1 {/g' "$file"

    # Добавляем module.exports в конец файла для классов
    if grep -q "^class.*{" "$file"; then
      class_name=$(grep "^class" "$file" | head -1 | sed 's/class \([^ ]*\).*/\1/')
      if [ ! -z "$class_name" ]; then
        echo "" >> "$file"
        echo "module.exports = { $class_name };" >> "$file"
      fi
    fi
  fi
done

# 3. Удаляем аннотации типов (упрощенная версия)
echo "🗑️  Удаление типов..."
for file in src/main/*.js src/preload/*.js; do
  if [ -f "$file" ]; then
    # Удаляем типы из параметров функций: (param: Type) -> (param)
    sed -i '' 's/(\([a-zA-Z_][a-zA-Z0-9_]*\): [^,)]*)/(\1)/g' "$file"

    # Удаляем типы возвращаемых значений: ): Type -> )
    sed -i '' 's/): [^{]*{/)  {/g' "$file"

    # Удаляем типы переменных: let x: Type = -> let x =
    sed -i '' 's/\(let\|const\|var\) \([a-zA-Z_][a-zA-Z0-9_]*\): [^=]* =/\1 \2 =/g' "$file"

    # Удаляем public/private/protected
    sed -i '' 's/  \(public\|private\|protected\) //g' "$file"

    # Удаляем interface
    sed -i '' '/^export interface/,/^}/d' "$file"
    sed -i '' '/^interface/,/^}/d' "$file"
  fi
done

echo "✅ Конвертация завершена!"
echo ""
echo "📁 Созданные файлы:"
ls -lh src/main/*.js src/preload/*.js src/renderer/*.js 2>/dev/null | awk '{print $9, $5}'

echo ""
echo "⚠️  ВНИМАНИЕ: Проверьте файлы вручную, автоматическая конвертация может быть неполной!"
