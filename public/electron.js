const { app, BrowserWindow, Menu } = require('electron'); // FIX: Menu wurde hier hinzugefügt!
const path = require('path');
const { initIpcHandlers } = require('./ipcHandler');
const ffmpegService = require('./ffmpegService');

// Verhindert das dreimalige Flackern und den GPU-Crash unter Windows
app.disableHardwareAcceleration();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Erlaubt das Laden von lokalen Dateien
    },
  });

  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());

  mainWindow.webContents.on('drop', (event) => {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const paths = Array.from(files).map((f) => f.path);
      mainWindow.webContents.send('dropped-files', paths);
    }
  });

  mainWindow.webContents.on('dragover', (event) => event.preventDefault());
  mainWindow.webContents.on('dragenter', (event) => event.preventDefault());

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../build/index.html')}`;
  mainWindow.loadURL(startUrl);

  mainWindow.on('closed', () => (mainWindow = null));
}

app.whenReady().then(() => {
  createWindow();
  
  // Entfernt die obere Menüleiste (Datei, Bearbeiten, etc.) komplett
  Menu.setApplicationMenu(null); 
  
  initIpcHandlers(mainWindow);
  ffmpegService.ensureFfmpeg(mainWindow).catch(err => {
    console.error('Failed to ensure FFmpeg:', err);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});