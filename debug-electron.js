console.log('=== Debugging Electron Import ===');
console.log('Node version:', process.version);
console.log('Process versions:', process.versions);
console.log('\nAttempting to require electron...');

try {
  const electron = require('electron');
  console.log('✅ Electron imported successfully!');
  console.log('Type of electron:', typeof electron);
  console.log('Electron keys:', Object.keys(electron || {}).slice(0, 20));
  console.log('electron.app:', typeof electron.app);

  if (electron.app) {
    console.log('\n✅ electron.app exists!');
    electron.app.whenReady().then(() => {
      console.log('✅ App is ready!');
      process.exit(0);
    });
  } else {
    console.log('\n❌ electron.app is undefined!');
    console.log('Full electron value:', electron);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error requiring electron:', error);
  process.exit(1);
}
