const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const https = require('https');
const os = require('os');
const AdmZip = require('adm-zip');

const { app } = require('electron');

function getBinPath() {
  const localBin = path.join(__dirname, '..', 'bin');
  if (fs.existsSync(path.join(localBin, 'ffmpeg.exe'))) return localBin;

  if (process.resourcesPath) {
    const resBin = path.join(process.resourcesPath, 'bin');
    if (fs.existsSync(path.join(resBin, 'ffmpeg.exe'))) return resBin;
  }

  if (app) {
    const userDataBin = path.join(app.getPath('userData'), 'bin');
    if (!fs.existsSync(userDataBin)) fs.mkdirSync(userDataBin, { recursive: true });
    return userDataBin;
  }
  return localBin;
}

let binPath = getBinPath();

function setFfmpegPaths() {
  binPath = getBinPath();
  if (fs.existsSync(path.join(binPath, 'ffmpeg.exe'))) {
    ffmpeg.setFfmpegPath(path.join(binPath, 'ffmpeg.exe'));
    ffmpeg.setFfprobePath(path.join(binPath, 'ffprobe.exe'));
    return true;
  }
  return false;
}
setFfmpegPaths();

async function ensureFfmpeg(mainWindow) {
  if (setFfmpegPaths()) return true; // Already exists

  mainWindow.webContents.send('progress', { opened: true, current: 0, message: 'Downloading FFmpeg...' });
  
  const zipUrl = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';
  const tmpZip = path.join(os.tmpdir(), 'ffmpeg.zip');

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tmpZip);
    https.get(zipUrl, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        https.get(response.headers.location, handleResponse).on('error', reject);
      } else {
        handleResponse(response);
      }

      function handleResponse(res) {
        const totalLen = parseInt(res.headers['content-length'], 10);
        let downloaded = 0;

        res.on('data', (chunk) => {
          downloaded += chunk.length;
          if (totalLen) {
            const percent = Math.round((downloaded / totalLen) * 100);
            mainWindow.webContents.send('progress', { opened: true, current: percent, message: `Downloading FFmpeg... (${percent}%)` });
            mainWindow.setProgressBar(percent / 100);
          }
        });

        res.pipe(file);

        file.on('finish', () => {
          file.close();
          mainWindow.webContents.send('progress', { opened: true, current: 100, message: 'Extracting FFmpeg...' });
          try {
            if (!fs.existsSync(binPath)) fs.mkdirSync(binPath, { recursive: true });
            const zip = new AdmZip(tmpZip);
            const zipEntries = zip.getEntries();
            
            zipEntries.forEach((entry) => {
              if (entry.entryName.endsWith('ffmpeg.exe') || entry.entryName.endsWith('ffprobe.exe')) {
                const fileName = path.basename(entry.entryName);
                fs.writeFileSync(path.join(binPath, fileName), entry.getData());
              }
            });
            
            fs.unlinkSync(tmpZip);
            setFfmpegPaths();
            mainWindow.setProgressBar(-1);
            mainWindow.webContents.send('progress', { opened: false, current: 100, message: 'FFmpeg ready!' });
            resolve(true);
          } catch (err) {
            console.error('Extraction error:', err);
            reject(err);
          }
        });
      }
    }).on('error', (err) => {
      fs.unlink(tmpZip, () => {});
      reject(err);
    });
  });
}

function parseNumber(val) {
  if (val === undefined || val === null || val === '') return '';
  const num = parseInt(val, 10);
  return isNaN(num) ? val : num.toString();
}

function getMetadata(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const tags = data.format.tags || {};
      const coverStream = data.streams.find(s => s.disposition && s.disposition.attached_pic);

      const subtitleStreams = data.streams
        .filter(s => s.codec_type === 'subtitle')
        .map(s => {
          const sTags = s.tags || {};
          const sDisp = s.disposition || {};
          return {
            id: 'embedded_' + s.index,
            isEmbedded: true,
            streamIndex: s.index,
            language: sTags.language || sTags.LANG || 'und',
            title: sTags.title || '',
            default: sDisp.default === 1,
            forced: sDisp.forced === 1,
            format: s.codec_name,
            durationSec: parseFloat(s.duration || data.format?.duration || 0)
          };
        });

      resolve({
        title: tags.title || '',
        artist: tags.artist || tags.performer || tags.album_artist || '',
        album: tags.album || tags.collection || '',
        genre: tags.genre || tags.show_genre || '',
        year: tags.date || tags.year || '',
        description: tags.description || '',
        show: tags.show || tags.collection || '',
        season: parseNumber(tags.season_number || tags.Season || tags.tv_season),
        episode: parseNumber(tags.episode_id || tags.Part || tags.tv_episode || tags.episode_sort || tags.track),
        episode_title: tags.episode_name || tags['Track name'] || tags.title || '',
        cover: !!coverStream,
        subtitles: subtitleStreams,
      });
    });
  });
}

function writeMetadata(inputPath, outputPath, metadata, gpuEnabled = false, onProgress = null) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, probeData) => {
      if (err) return reject(err);
      
      const cmd = ffmpeg(inputPath);
      
      if (gpuEnabled) {
        cmd.inputOptions(['-hwaccel', 'auto']);
      }

      cmd.outputOptions('-map', '0');
      cmd.outputOptions('-c', 'copy');
      cmd.outputOptions('-map_metadata', '-1');

      for (const [key, value] of Object.entries(metadata)) {
        if (['coverPath', 'coverUrl', 'cover', 'tmdbId', 'tmdbType', 'subtitles'].includes(key)) continue;
        
        if (value !== undefined && value !== '' && value !== '[individuell]') {
          cmd.outputOptions(`-metadata`, `${key}=${value}`);
          
          if (key === 'season') {
             cmd.outputOptions(`-metadata`, `season_number=${value}`);
             cmd.outputOptions(`-metadata`, `tv_season=${value}`);
          }
          if (key === 'episode') {
             cmd.outputOptions(`-metadata`, `episode_sort=${value}`);
             cmd.outputOptions(`-metadata`, `tv_episode=${value}`);
             cmd.outputOptions(`-metadata`, `episode_id=${value}`);
          }
          if (key === 'episode_title') {
             cmd.outputOptions(`-metadata`, `episode_name=${value}`);
          }
          if (key === 'year') {
             cmd.outputOptions(`-metadata`, `date=${value}`);
          }
          if (key === 'artist') {
             cmd.outputOptions(`-metadata`, `album_artist=${value}`);
             cmd.outputOptions(`-metadata`, `performer=${value}`);
          }
        }
      }

      if (metadata.coverPath && fs.existsSync(metadata.coverPath)) {
        cmd.input(metadata.coverPath);
        cmd.outputOptions('-map', '-0:v:m:attached_pic'); // Remove old covers from input 0
        cmd.outputOptions('-map', '1');
        
        // Calculate new video stream index
        const videoStreams = probeData.streams.filter(s => s.codec_type === 'video');
        const oldCoversCount = videoStreams.filter(s => s.disposition && s.disposition.attached_pic).length;
        const newCoverIndex = videoStreams.length - oldCoversCount;
        
        cmd.outputOptions(`-disposition:v:${newCoverIndex}`, 'attached_pic');
      }

      let currentMapIndex = 1;
      if (metadata.coverPath && fs.existsSync(metadata.coverPath)) {
        currentMapIndex++;
      }

      if (metadata.subtitles && Array.isArray(metadata.subtitles)) {
        cmd.outputOptions('-map', '-0:s');

        const ext = path.extname(outputPath).toLowerCase();
        const subtitleCodec = (ext === '.mp4' || ext === '.m4v') ? 'mov_text' : 'copy';

        let subIdx = 0;
        for (const sub of metadata.subtitles) {
          if (sub.isEmbedded) {
            cmd.outputOptions('-map', `0:${sub.streamIndex}`);
          } else if (sub.path && fs.existsSync(sub.path)) {
            cmd.input(sub.path);
            cmd.outputOptions('-map', `${currentMapIndex}:0`);
            currentMapIndex++;
          } else {
            continue;
          }

          cmd.outputOptions(`-c:s:${subIdx}`, subtitleCodec);
          
          if (sub.language) {
            cmd.outputOptions(`-metadata:s:s:${subIdx}`, `language=${sub.language}`);
          }
          if (sub.title) {
            cmd.outputOptions(`-metadata:s:s:${subIdx}`, `title=${sub.title}`);
          }
          
          const dispositions = [];
          if (sub.default) dispositions.push('default');
          if (sub.forced) dispositions.push('forced');
          
          if (dispositions.length > 0) {
            cmd.outputOptions(`-disposition:s:s:${subIdx}`, dispositions.join('+'));
          } else {
            cmd.outputOptions(`-disposition:s:s:${subIdx}`, '0');
          }
          
          subIdx++;
        }
      }

      if (onProgress) {
        cmd.on('progress', (progress) => {
          if (progress.percent !== undefined) {
            onProgress(progress.percent);
          }
        });
      }

      cmd.save(outputPath)
        .on('end', () => resolve(true))
        .on('error', reject);
    });
  });
}

module.exports = { getMetadata, writeMetadata, ensureFfmpeg };