// Простейший тест electron
console.log('1. Node version:', process.versions.node);
console.log('2. Trying to require electron...');
const electron = require('electron');
console.log('3. electron type:', typeof electron);
console.log('4. electron value:', electron);

if (typeof electron === 'string') {
  console.log('ERROR: electron is a string (path), not an object!');
  console.log('This is a known issue on macOS when electron binary is not properly set up');
  process.exit(1);
}

const { app } = electron;
console.log('5. app:', app);

app.whenReady().then(() => {
  console.log('SUCCESS: Electron app is ready!');
  app.quit();
});
