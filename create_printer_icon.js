const fs = require('fs');

// Создаем SVG иконку принтера для macOS Template Image
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
  <!-- Верхняя часть принтера (лоток) -->
  <rect x="3" y="2" width="10" height="2" fill="white"/>
  
  <!-- Основной корпус принтера -->
  <rect x="2" y="4" width="12" height="6" fill="white"/>
  
  <!-- Нижний лоток -->
  <rect x="3" y="10" width="10" height="2" fill="white"/>
  
  <!-- Кнопки/индикаторы -->
  <circle cx="4" cy="6" r="0.5" fill="white"/>
  <rect x="6" y="5.5" width="2" height="1" fill="white"/>
  
  <!-- Выходящая бумага -->
  <rect x="5" y="1" width="6" height="1" fill="white"/>
  <rect x="6" y="0" width="4" height="1" fill="white"/>
</svg>`;

fs.writeFileSync('printer_icon.svg', svg);
console.log('✅ SVG иконка принтера создана!');
