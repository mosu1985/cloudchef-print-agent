// Кросс-платформенное копирование HTML рендерера в out/.
// Заменяет Unix-команды `mkdir -p` / `cp`, которые ломали сборку на Windows CI.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'renderer', 'index.html');
const destDir = path.join(__dirname, '..', 'out', 'renderer');
const dest = path.join(destDir, 'index.html');

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);

console.log(`Скопировано: ${src} -> ${dest}`);
