// Minimal Electron test - plain JS
const { app, BrowserWindow } = require('electron');

console.log('✅ Electron imported successfully!');
console.log('app:', typeof app);
console.log('BrowserWindow:', typeof BrowserWindow);

app.whenReady().then(() => {
  console.log('✅ App is ready!');
  const win = new BrowserWindow({
    width: 400,
    height: 300
  });

  win.loadURL('data:text/html,<h1>Test OK!</h1>');

  setTimeout(() => {
    console.log('✅ Window created, closing...');
    app.quit();
  }, 2000);
});
