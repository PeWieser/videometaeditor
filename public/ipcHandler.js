const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const ffmpegService = require('./ffmpegService');
const tmdbService = require('./tmdbService');
const offlineService = require('./offlineService'); // NEU
const Store = require('electron-store');
const store = new Store();

function safeRenameSync(oldPath, newPath) {
  try {
    fs.renameSync(oldPath, newPath);
  } catch (err) {
    if (err.code === 'EXDEV') {
      fs.copyFileSync(oldPath, newPath);
      fs.unlinkSync(oldPath);
    } else {
      throw err;
    }
  }
}

function initIpcHandlers(mainWindow) {
  ipcMain.handle('dialog:openFiles', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Videos', extensions: ['mp4', 'mkv', 'avi', 'mov'] }],
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:openSubtitles', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Subtitles', extensions: ['srt', 'vtt', 'ass', 'ssa', 'sub'] }],
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('file:getSubtitleMetadata', async (event, filePath) => {
    return new Promise((resolve) => {
      const ffmpeg = require('fluent-ffmpeg');
      ffmpeg.ffprobe(filePath, (err, data) => {
        let durationSec = 0;
        if (!err && data.format && data.format.duration) {
          durationSec = parseFloat(data.format.duration);
        }
        
        let firstLines = '';
        try {
          const buffer = fs.readFileSync(filePath);
          firstLines = buffer.toString('utf8', 0, Math.min(buffer.length, 1024));
        } catch(e) {}
        
        resolve({ durationSec, firstLines });
      });
    });
  });

  ipcMain.handle('file:getMetadata', async (event, filePath) => {
    return await ffmpegService.getMetadata(filePath);
  });

  ipcMain.handle('file:writeMetadata', async (event, filePath, metadata) => {
    const gpuEnabled = store.get('gpuEnabled') || false;
    const tmpPath = filePath + '.tmp.' + path.extname(filePath);

    mainWindow.webContents.send('progress', { opened: true, current: 0, message: 'Starte Verarbeitung...' });
    mainWindow.setProgressBar(0);

    try {
      await ffmpegService.writeMetadata(filePath, tmpPath, metadata, gpuEnabled, (percent) => {
        mainWindow.setProgressBar(percent / 100);
        mainWindow.webContents.send('progress', { opened: true, current: percent, message: `Speichere... (${Math.round(percent)}%)` });
      });

      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(filePath);
        safeRenameSync(tmpPath, filePath);
      }
    } catch (err) {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      console.error(err);
      mainWindow.setProgressBar(-1);
      mainWindow.webContents.send('progress', { opened: false, current: 100, message: 'Fehler aufgetreten' });
      return false;
    }

    mainWindow.setProgressBar(-1);
    mainWindow.webContents.send('progress', { opened: false, current: 100, message: 'Fertig!' });
    return true;
  });

  ipcMain.handle('file:processFiles', async (event, options) => {
    const { files, outputFolder, seriesPattern, moviePattern, overwrite } = options;
    const gpuEnabled = store.get('gpuEnabled') || false;

    mainWindow.webContents.send('progress', { opened: true, current: 0, message: 'Starte Batch-Verarbeitung...' });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isSeries = !!file.metadata.show;
      const pattern = isSeries ? seriesPattern : moviePattern;

      let newName = buildFileName(file.metadata, pattern);
      if (!newName || newName.trim() === '' || newName === '()') {
        newName = path.basename(file.path, path.extname(file.path));
      }

      const ext = path.extname(file.path);
      const targetFolder = (outputFolder && outputFolder.trim() !== '') ? outputFolder : path.dirname(file.path);
      let destPath = path.join(targetFolder, newName + ext);

      try {
        const tmpPath = destPath + '.tmp' + ext;
        await ffmpegService.writeMetadata(file.path, tmpPath, file.metadata, gpuEnabled, (percent) => {
          const overallProgress = (i + (percent / 100)) / files.length;
          mainWindow.setProgressBar(overallProgress);
          mainWindow.webContents.send('progress', {
            opened: true,
            current: percent,
            message: `Datei ${i + 1}/${files.length}: ${newName} (${Math.round(percent)}%)`
          });
        });

        const resolvedInput = path.resolve(file.path).toLowerCase();
        const resolvedOutput = path.resolve(destPath).toLowerCase();
        const isSamePath = resolvedInput === resolvedOutput;

        if (fs.existsSync(destPath)) {
          if (isSamePath) fs.unlinkSync(file.path);
          else if (overwrite) fs.unlinkSync(destPath);
          else { fs.unlinkSync(tmpPath); throw new Error('Datei existiert bereits: ' + destPath); }
        }

        safeRenameSync(tmpPath, destPath);
        if (overwrite && !isSamePath && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      } catch (err) {
        console.error(`Fehler bei ${file.path}:`, err.message);
      }
    }

    mainWindow.setProgressBar(-1);
    mainWindow.webContents.send('progress', { opened: false, current: 100, message: 'Fertig!' });
    return true;
  });

  // ---------- TMDB ----------
  ipcMain.handle('tmdb:search', async (event, query, type, forceOffline, language) => {
    return await tmdbService.search(store.get('tmdbApiKey'), query, type, forceOffline, language);
  });

  ipcMain.handle('tmdb:getSeriesDetails', async (event, id, forceOffline, language) => {
    return await tmdbService.getSeriesDetails(store.get('tmdbApiKey'), id, forceOffline, language);
  });

  ipcMain.handle('tmdb:getMovieDetails', async (event, id, forceOffline, language) => {
    return await tmdbService.getMovieDetails(store.get('tmdbApiKey'), id, forceOffline, language);
  });

  ipcMain.handle('tmdb:getSeasonDetails', async (event, seriesId, seasonNum, forceOffline, language) => {
    return await tmdbService.getSeasonDetails(store.get('tmdbApiKey'), seriesId, seasonNum, forceOffline, language);
  });

  ipcMain.handle('tmdb:getImages', async (event, type, id, seasonNum, fetchAll) => {
    return await tmdbService.getImages(store.get('tmdbApiKey'), type, id, seasonNum, fetchAll);
  });

  ipcMain.handle('tmdb:getCredits', async (event, type, id, forceOffline, language) => {
    return await tmdbService.getCredits(store.get('tmdbApiKey'), type, id, forceOffline, language);
  });

  ipcMain.handle('tmdb:makeOffline', async (event, type, id) => {
    mainWindow.webContents.send('progress', { opened: true, current: 0, message: 'Starte Offline-Download...' });
    await tmdbService.makeOfflineAvailable(store.get('tmdbApiKey'), type, id, (percent, msg) => {
      mainWindow.webContents.send('progress', { opened: true, current: percent, message: msg });
    });
    setTimeout(() => mainWindow.webContents.send('progress', { opened: false, current: 100, message: 'Fertig' }), 1500);
    return true;
  });

  // NEU: Backend-Funktionen für das Settings-Modul
  ipcMain.handle('tmdb:getOfflineList', async () => {
    return offlineService.getOfflineList();
  });

  ipcMain.handle('tmdb:deleteOfflineItem', async (event, type, id) => {
    return offlineService.deleteItem(type, id);
  });

  ipcMain.handle('tmdb:deleteAllOffline', async () => {
    return offlineService.deleteAll();
  });

  ipcMain.handle('file:extractCover', async (event, filePath) => {
    const tmpDir = path.join(os.tmpdir(), 'videometaeditor');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const outputPath = path.join(tmpDir, uuidv4() + '.jpg');

    return new Promise((resolve) => {
      const ffmpeg = require('fluent-ffmpeg');
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return resolve(null);
        const coverStream = metadata.streams.find(s => s.disposition?.attached_pic === 1);
        if (!coverStream) return resolve(null);

        ffmpeg(filePath)
          .outputOptions(['-map', `0:${coverStream.index}`, '-frames:v', '1', '-q:v', '2', '-f', 'image2'])
          .output(outputPath)
          .on('end', () => resolve(outputPath))
          .on('error', () => {
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            resolve(null);
          }).run();
      });
    });
  });

  ipcMain.handle('file:getImageDataUrl', async (event, filePath) => {
    try {
      if (!fs.existsSync(filePath)) return '';
      const bitmap = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase().replace('.', '');
      return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${bitmap.toString('base64')}`;
    } catch (err) {
      return '';
    }
  });

  ipcMain.handle('file:downloadImage', async (event, url) => {
    try {
      // FIX: Wenn es bereits ein lokales Bild (Offline-Modus) ist -> Download überspringen!
      if (url.startsWith('file://')) {
        let localPath = decodeURI(url.replace('file://', ''));
        // Windows Pfad-Korrektur (z.B. aus /C:/Ordner wird C:\Ordner)
        if (process.platform === 'win32' && localPath.match(/^\/[a-zA-Z]:/)) {
          localPath = localPath.substring(1);
        }
        return localPath.replace(/\//g, '\\');
      }

      // Normaler Download für echte Online-Bilder
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const tmpDir = path.join(os.tmpdir(), 'videometaeditor');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const destPath = path.join(tmpDir, uuidv4() + '.jpg');
      fs.writeFileSync(destPath, Buffer.from(response.data));
      return destPath;
    } catch (err) {
      console.error('Fehler beim Bild-Download:', err.message);
      return '';
    }
  });

  ipcMain.handle('file:copyToTemp', async (event, sourcePath) => {
    const tmpDir = path.join(os.tmpdir(), 'videometaeditor');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const destPath = path.join(tmpDir, uuidv4() + path.extname(sourcePath));
    fs.copyFileSync(sourcePath, destPath);
    return destPath;
  });

  ipcMain.handle('store:get', (event, key) => store.get(key));
  ipcMain.handle('store:set', (event, key, value) => store.set(key, value));
}

function buildFileName(metadata, pattern) {
  if (!pattern) return '';
  let name = pattern
    .replace(/{show}/g, metadata.show || '')
    .replace(/{title}/g, metadata.title || '')
    .replace(/{season}/g, metadata.season ? String(metadata.season).padStart(2, '0') : '')
    .replace(/{episode}/g, metadata.episode ? String(metadata.episode).padStart(2, '0') : '')
    .replace(/{episode_title}/g, metadata.episode_title || '')
    .replace(/{year}/g, metadata.year || '');

  // Entferne ungültige Pfadzeichen, leere Klammern () und doppelte Leerzeichen
  name = name
    .replace(/[<>:"/\\|?*]+/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return name;
}

module.exports = { initIpcHandlers };