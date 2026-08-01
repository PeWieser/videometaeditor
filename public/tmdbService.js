const axios = require('axios');
const offlineService = require('./offlineService');

const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// NEU: Unterstützt dynamische Sprachparameter (language)
async function tmdbRequest(apiKey, endpoint, params = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const lang = params.language || 'de'; // Fallback

  const res = await axios.get(url, {
    params: { api_key: apiKey, language: lang, ...params },
    timeout: 4000
  });
  return res.data;
}

function getLangSpecific(data, language) {
  if (!data) return null;
  if (data.de || data.en || data.fr || data.es) {
    return data[language] || data['de'] || data['en'] || Object.values(data)[0];
  }
  return data;
}

async function search(apiKey, query, type = 'tv', forceOffline = false, language = 'de') {
  if (forceOffline) {
    return { results: offlineService.searchOffline(query, type, language), offlineFallback: true };
  }

  try {
    let endpoint = '/search/tv';
    if (type === 'movie') endpoint = '/search/movie';
    if (type === 'both' || type === 'multi') endpoint = '/search/multi';

    const data = await tmdbRequest(apiKey, endpoint, { query, language });
    const results = data.results
      .filter(item => item.media_type !== 'person')
      .map(item => ({
        id: item.id,
        name: item.name || item.title,
        year: (item.first_air_date || item.release_date || '').substring(0, 4),
        poster: item.poster_path ? IMAGE_BASE + item.poster_path : null,
        type: item.media_type || (type === 'both' ? 'tv' : type),
        overview: item.overview
      }));

    return { results, offlineFallback: false };
  } catch (err) {
    const isApiKeyError = err.response && err.response.status === 401;
    return { 
      results: offlineService.searchOffline(query, type, language), 
      offlineFallback: true, 
      error: isApiKeyError ? 'invalid_api_key' : err.message 
    };
  }
}

async function getSeriesDetails(apiKey, id, forceOffline = false, language = 'de') {
  if (forceOffline) return getLangSpecific(offlineService.getOfflineData('tv', id)?.details, language);
  try { return await tmdbRequest(apiKey, `/tv/${id}`, { language }); }
  catch (err) { return getLangSpecific(offlineService.getOfflineData('tv', id)?.details, language); }
}

async function getSeasonDetails(apiKey, seriesId, seasonNum, forceOffline = false, language = 'de') {
  let normSeason = seasonNum;
  if (typeof seasonNum === 'string') {
    const match = seasonNum.match(/\d+/);
    if (match) normSeason = parseInt(match[0], 10);
  } else if (typeof seasonNum === 'number') {
    normSeason = seasonNum;
  }

  if (forceOffline) {
    const seasons = offlineService.getOfflineData('tv', seriesId)?.seasons;
    if (!seasons) return null;
    if (seasons.de || seasons.en || seasons.fr || seasons.es) {
      const langSeasons = seasons[language] || seasons['de'] || seasons['en'] || Object.values(seasons)[0];
      return langSeasons ? langSeasons[normSeason] : null;
    }
    return seasons[normSeason];
  }
  try { return await tmdbRequest(apiKey, `/tv/${seriesId}/season/${normSeason}`, { language }); }
  catch (err) {
    const seasons = offlineService.getOfflineData('tv', seriesId)?.seasons;
    if (!seasons) return null;
    if (seasons.de || seasons.en || seasons.fr || seasons.es) {
      const langSeasons = seasons[language] || seasons['de'] || seasons['en'] || Object.values(seasons)[0];
      return langSeasons ? langSeasons[normSeason] : null;
    }
    return seasons[normSeason];
  }
}

async function getImages(apiKey, type, id, seasonNum = null, fetchAll = false) {
  const offlineData = offlineService.getOfflineData(type, id);
  if (offlineData && offlineData.images) {
    if (seasonNum && seasonNum !== 'all') {
      return offlineData.images.filter(img => img.season == seasonNum || img.season === 'Serie');
    }
    return offlineData.images;
  }

  const params = { include_image_language: 'de,en,null' };
  let posters = [];

  if (type === 'tv') {
    if (fetchAll) {
      try {
        const details = await tmdbRequest(apiKey, `/tv/${id}`, params);
        for (const s of details.seasons || []) {
          try {
            const sData = await tmdbRequest(apiKey, `/tv/${id}/season/${s.season_number}/images`, params);
            (sData.posters || []).forEach(p => posters.push({ ...p, context_season: s.season_number }));
          } catch (e) { }
        }
      } catch (e) { }

      try {
        const mainData = await tmdbRequest(apiKey, `/tv/${id}/images`, params);
        (mainData.posters || []).forEach(p => posters.push({ ...p, context_season: 'Serie' }));
      } catch (e) { }

    } else {
      if (seasonNum && seasonNum !== '' && seasonNum !== 'all') {
        try {
          const sData = await tmdbRequest(apiKey, `/tv/${id}/season/${seasonNum}/images`, params);
          (sData.posters || []).forEach(p => posters.push({ ...p, context_season: seasonNum }));
        } catch (e) { }
      }
      try {
        const mainData = await tmdbRequest(apiKey, `/tv/${id}/images`, params);
        (mainData.posters || []).forEach(p => posters.push({ ...p, context_season: 'Serie' }));
      } catch (e) { }
    }
  } else if (type === 'movie') {
    try {
      const data = await tmdbRequest(apiKey, `/movie/${id}/images`, params);
      (data.posters || []).forEach(p => posters.push({ ...p, context_season: 'Film' }));
    } catch (e) { }
  }

  const unique = [];
  const seen = new Set();
  for (const p of posters) {
    if (!seen.has(p.file_path)) {
      seen.add(p.file_path);
      unique.push({
        url: IMAGE_BASE + p.file_path,
        lang: p.iso_639_1 ? p.iso_639_1.toUpperCase() : 'Neutral',
        season: p.context_season !== undefined ? p.context_season : 'Serie'
      });
    }
  }
  return unique;
}

async function getMovieDetails(apiKey, id, forceOffline = false, language = 'de') {
  if (forceOffline) return getLangSpecific(offlineService.getOfflineData('movie', id)?.details, language);
  try { return await tmdbRequest(apiKey, `/movie/${id}`, { language }); }
  catch (err) { return getLangSpecific(offlineService.getOfflineData('movie', id)?.details, language); }
}

async function getCredits(apiKey, type, id, forceOffline = false, language = 'de') {
  if (forceOffline) return getLangSpecific(offlineService.getOfflineData(type, id)?.credits, language);
  try {
    const endpoint = type === 'tv' ? `/tv/${id}/credits` : `/movie/${id}/credits`;
    return await tmdbRequest(apiKey, endpoint, { language });
  }
  catch (err) { return getLangSpecific(offlineService.getOfflineData(type, id)?.credits, language); }
}

async function makeOfflineAvailable(apiKey, type, id, onProgress) {
  const db = offlineService.getDb();
  if (!db[type]) db[type] = {};

  const entry = { details: {}, credits: {}, images: [], seasons: {} };
  onProgress(5, 'Lade Basis-Details...');

  const languages = ['de', 'en', 'fr', 'es'];

  // Fetch details and credits for all languages
  for (const lang of languages) {
    if (type === 'tv') {
      entry.details[lang] = await getSeriesDetails(apiKey, id, false, lang);
      entry.credits[lang] = await getCredits(apiKey, 'tv', id, false, lang);
    } else {
      entry.details[lang] = await getMovieDetails(apiKey, id, false, lang);
      entry.credits[lang] = await getCredits(apiKey, 'movie', id, false, lang);
    }
  }

  const defaultDetails = entry.details['de'] || entry.details['en'] || Object.values(entry.details)[0];
  const title = defaultDetails.name || defaultDetails.title || 'Unbekannt';
  onProgress(15, `Bereite Download für "${title}" vor...`);

  const onlineImages = await getImages(apiKey, type, id, 'all', true);

  for (let i = 0; i < onlineImages.length; i++) {
    const img = onlineImages[i];
    const percent = 15 + Math.floor((i / onlineImages.length) * 45);
    onProgress(percent, `Speichere Cover ${i + 1} von ${onlineImages.length} für "${title}"...`);

    const localPath = await offlineService.cacheImage(img.url);
    if (localPath) {
      const fileUrl = `file:///${localPath.replace(/\\/g, '/')}`;
      entry.images.push({ ...img, url: fileUrl });
    }
  }

  if (type === 'tv' && defaultDetails.seasons) {
    const totalSeasons = defaultDetails.seasons.length;
    for (let i = 0; i < totalSeasons; i++) {
      const s = defaultDetails.seasons[i];
      const percent = 60 + Math.floor((i / totalSeasons) * 35);
      onProgress(percent, `Lade Episodendetails für "${title}" (Staffel ${s.season_number})...`);

      for (const lang of languages) {
        if (!entry.seasons[lang]) entry.seasons[lang] = {};
        try {
          entry.seasons[lang][s.season_number] = await getSeasonDetails(apiKey, id, s.season_number, false, lang);
        } catch (e) { }
      }
    }
  }

  db[type][id] = entry;
  offlineService.saveDb(db);
  onProgress(100, `"${title}" ist nun komplett offline verfügbar!`);
  return true;
}

module.exports = { search, getSeriesDetails, getSeasonDetails, getImages, getMovieDetails, getCredits, makeOfflineAvailable };