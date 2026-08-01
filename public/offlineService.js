const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const axios = require('axios');

const OFFLINE_DIR = path.join(app.getPath('userData'), 'offline_tmdb');
const IMG_DIR = path.join(OFFLINE_DIR, 'images');
const DB_PATH = path.join(OFFLINE_DIR, 'db.json');

if (!fs.existsSync(OFFLINE_DIR)) fs.mkdirSync(OFFLINE_DIR, { recursive: true });
if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

function getDb() {
  if (!fs.existsSync(DB_PATH)) return { tv: {}, movie: {} };
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function saveDb(db) {
  const tmpPath = DB_PATH + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpPath, DB_PATH);
}

async function cacheImage(url) {
  if (!url) return null;
  const fileName = url.substring(url.lastIndexOf('/') + 1);
  const localPath = path.join(IMG_DIR, fileName);

  if (fs.existsSync(localPath)) return localPath;

  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync(localPath, Buffer.from(response.data));
    return localPath;
  } catch (err) {
    console.error("Fehler beim Cachen des Bildes:", err.message);
    return null;
  }
}

function getOfflineData(type, id) {
  const db = getDb();
  if (db[type] && db[type][id]) return db[type][id];
  return null;
}

function searchOffline(query, type, language = 'de') {
  const db = getDb();
  const results = [];
  const q = (query || '').trim();
  
  const normalize = (str) => {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').toLowerCase();
  };
  
  const normQ = normalize(q);
  const searchIn = type === 'both' || type === 'multi' ? ['tv', 'movie'] : [type];
  
  for (const t of searchIn) {
    for (const [id, data] of Object.entries(db[t] || {})) {
      const details = (data.details && typeof data.details === 'object') ? 
        (data.details[language] || data.details.de || data.details.en || data.details.fr || data.details.es || data.details) : {};
        
      const title = details.name || details.title || '';
      
      if (!normQ || normalize(title).includes(normQ)) {
        let availableLanguages = [];
        let seasonsComplete = false;
        let seasonsCount = 0;
        
        if (data.details) {
            availableLanguages = Object.keys(data.details).filter(k => typeof data.details[k] === 'object' && (data.details[k].name !== undefined || data.details[k].title !== undefined || data.details[k].overview !== undefined));
            if (availableLanguages.length === 0) availableLanguages = ['de'];
        }

        if (t === 'tv' && data.seasons) {
           const firstLang = availableLanguages[0] || 'de';
           const seasonsData = data.seasons[firstLang] || data.seasons;
           seasonsCount = Object.keys(seasonsData).length;
           const expectedSeasons = details.number_of_seasons || seasonsCount;
           seasonsComplete = seasonsCount > 0 && seasonsCount >= expectedSeasons;
        }

        results.push({
          id: parseInt(id),
          name: title,
          year: (details.first_air_date || details.release_date || '').substring(0, 4),
          poster: data.images?.length > 0 ? data.images[0].url : null,
          type: t,
          overview: details.overview,
          availableLanguages,
          seasonsCount,
          seasonsComplete
        });
      }
    }
  }
  return results;
}

// NEU: Gibt eine flache Liste aller gespeicherten Medien für die Einstellungen zurück
function getOfflineList() {
  const db = getDb();
  const list = [];
  ['tv', 'movie'].forEach(type => {
    for (const [id, data] of Object.entries(db[type] || {})) {
      const details = data.details.de || data.details.en || data.details.fr || data.details.es || data.details;
      list.push({
        id: parseInt(id),
        type: type,
        name: details.name || details.title || 'Unbekannt',
        year: (details.first_air_date || details.release_date || '').substring(0, 4)
      });
    }
  });
  // Alphabetisch sortieren
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

// NEU: Löscht einen Eintrag und seine verknüpften Bilder aus dem Offline-Speicher
function deleteItem(type, id) {
  const db = getDb();
  if (db[type] && db[type][id]) {
    const item = db[type][id];
    // Versuche, die heruntergeladenen Bilder zu löschen, um Speicherplatz freizugeben
    if (item.images) {
      item.images.forEach(img => {
        if (img.url && img.url.startsWith('file://')) {
          const imgPath = img.url.replace('file://', '');
          if (fs.existsSync(imgPath)) {
            try { fs.unlinkSync(imgPath); } catch(e) {}
          }
        }
      });
    }
    delete db[type][id];
    saveDb(db);
  }
  return true;
}

// NEU: Löscht radikal alle Offline-Daten
function deleteAll() {
  const db = getDb();
  ['tv', 'movie'].forEach(type => {
    for (const id of Object.keys(db[type] || {})) {
      deleteItem(type, id);
    }
  });
  return true;
}

module.exports = {
  getDb, saveDb, cacheImage, getOfflineData, searchOffline, getOfflineList, deleteItem, deleteAll
};