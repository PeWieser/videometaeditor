import React, { useState, useEffect } from 'react';
import {
  TextInput,
  Button,
  Stack,
  Paper,
  Image,
  Text,
  Box,
  Group,
  Badge,
  Loader,
  Modal,
  Tabs,
  FileInput,
  Checkbox,
  ActionIcon,
  Tooltip,
  Switch,
  Select,
  Notification
} from '@mantine/core';
import { IconSearch, IconArrowLeft, IconCloudDownload, IconX } from '@tabler/icons-react';

interface TmdbResult {
  id: number;
  name: string;
  year: string;
  poster: string | null;
  type: 'tv' | 'movie';
  overview?: string;
  availableLanguages?: string[];
  seasonsCount?: number;
  seasonsComplete?: boolean;
}

interface TmdbImage {
  url: string;
  lang: string;
}

interface Props {
  opened: boolean;
  onClose: () => void;
  onApply: (metadata: any) => void;
  initialQuery?: string;
}

const TmdbSearch: React.FC<Props> = ({ opened, onClose, onApply, initialQuery }) => {
  const [query, setQuery] = useState('');
  const [searchTv, setSearchTv] = useState(true);
  const [searchMovie, setSearchMovie] = useState(true);
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TmdbResult | null>(null);
  const [availableImages, setAvailableImages] = useState<TmdbImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [customImagePath, setCustomImagePath] = useState<string>('');
  const [customImageUrl, setCustomImageUrl] = useState<string>('');
  const [fetchingDetails, setFetchingDetails] = useState(false);

  // Offline Modi
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineIds, setOfflineIds] = useState<string[]>([]);

  // Sprach- und Episoden-States
  const [language, setLanguage] = useState<string>('de');
  const [apiError, setApiError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<string | null>(null);
  const [seasonsList, setSeasonsList] = useState<any[]>([]);
  const [episodesList, setEpisodesList] = useState<any[]>([]);

  const api = (window as any).electronAPI;

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchOfflineIds = async () => {
    try {
      const list = await api.getOfflineList();
      setOfflineIds(list.map((item: any) => `${item.type}-${item.id}`));
    } catch (e) { }
  };

  useEffect(() => {
    if (opened) {
      fetchOfflineIds();

      // Sprache aus den Settings laden, wenn Fenster geöffnet wird
      api.getSetting('searchLanguage').then((l: any) => {
        if (l) setLanguage(l);
      });

      if (initialQuery) {
        setQuery(initialQuery);
        handleSearch(initialQuery);
      } else {
        setQuery('');
        if (isOffline) {
          handleSearch('');
        }
      }
    }
  }, [opened, initialQuery]);

  const handleLanguageChange = (val: string | null) => {
    const newLang = val || 'de';
    setLanguage(newLang);
    api.setSetting('searchLanguage', newLang); // Sprache dauerhaft speichern
  };

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery !== undefined ? searchQuery : query;
    if (!q.trim() && !isOffline) return;
    if (!searchTv && !searchMovie) return;

    setLoading(true);
    setApiError(null);
    try {
      let searchRes;
      if (searchTv && searchMovie) {
        searchRes = await api.searchTMDB(q, 'both', isOffline, language);
      } else if (searchTv) {
        searchRes = await api.searchTMDB(q, 'tv', isOffline, language);
      } else if (searchMovie) {
        searchRes = await api.searchTMDB(q, 'movie', isOffline, language);
      }

      // Das Backend sagt uns, ob es aufgrund eines Timeouts in den Offline-Modus gefallen ist
      if (searchRes.offlineFallback) {
        setIsOffline(true);
        if (searchRes.error === 'invalid_api_key') {
          setApiError("Ungültiger oder fehlender TMDB API-Schlüssel! Bitte in den Einstellungen überprüfen.");
        }
      }

      const combined: TmdbResult[] = searchRes.results || [];
      combined.sort((a: TmdbResult, b: TmdbResult) => (b.year || '').localeCompare(a.year || ''));
      setResults(combined);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (item: TmdbResult) => {
    setSelectedItem(item);
    setCustomImagePath('');
    setCustomImageUrl('');
    setSelectedSeason(null);
    setSelectedEpisode(null);
    setSeasonsList([]);
    setEpisodesList([]);

    try {
      const images = await api.getImages(item.type, item.id, undefined);
      setAvailableImages(images);
      setSelectedImage(images.length > 0 ? images[0].url : '');

      // Wenn Serie, lade die Staffeln vor
      if (item.type === 'tv') {
        const details = await api.getSeriesDetails(item.id, isOffline, language);
        setSeasonsList(details?.seasons || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSeasonChange = async (val: string | null) => {
    setSelectedSeason(val);
    setSelectedEpisode(null);
    if (!val || !selectedItem) {
      setEpisodesList([]);
      return;
    }
    // Lade die Episoden dieser Staffel
    try {
      const sData = await api.getSeasonDetails(selectedItem.id, val, isOffline, language);
      setEpisodesList(sData?.episodes || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleApply = async () => {
    if (!selectedItem) return;
    setFetchingDetails(true);
    try {
      let details: any;
      if (selectedItem.type === 'tv') {
        details = await api.getSeriesDetails(selectedItem.id, isOffline, language);
      } else {
        details = await api.getMovieDetails(selectedItem.id, isOffline, language);
      }

      let artist = '';
      try {
        const credits = await api.getCredits(selectedItem.type, selectedItem.id, isOffline, language);
        if (selectedItem.type === 'movie') {
          const director = credits.crew?.find((c: any) => c.job === 'Director');
          artist = director?.name || '';
        } else {
          const creators = details?.created_by || [];
          artist = creators.map((c: any) => c.name).join(', ');
          if (!artist && credits.crew) {
            const producer = credits.crew.find((c: any) => c.job === 'Executive Producer');
            artist = producer?.name || '';
          }
        }
      } catch (e) { }

      let genres = '';
      if (details?.genres && details.genres.length > 0) {
        genres = details.genres.map((g: any) => g.name).join(', ');
      }

      // Überschreibt Serientitel und Beschreibung, falls eine spezifische Episode gewählt wurde
      let epName = '';
      let epOverview = '';
      if (selectedItem.type === 'tv' && selectedSeason && selectedEpisode) {
        const sData = await api.getSeasonDetails(selectedItem.id, selectedSeason, isOffline, language);
        const ep = sData?.episodes?.find((e: any) => String(e.episode_number) === selectedEpisode);
        if (ep) {
          epName = ep.name;
          epOverview = ep.overview;
        }
      }

      const metadata: any = {
        title: epName || details?.name || details?.title || '',
        artist: artist,
        year: (details?.first_air_date || details?.release_date || '').substring(0, 4),
        description: epOverview || details?.overview || '',
        genre: genres,
        show: selectedItem.type === 'tv' ? details?.name : '',
        season: selectedSeason || '',
        episode: selectedEpisode || '',
        episode_title: epName || '',
        tmdbId: selectedItem.id,
        tmdbType: selectedItem.type,
        coverPath: '',
        coverUrl: '',
      };

      if (customImagePath) {
        metadata.coverPath = customImagePath;
      } else if (customImageUrl) {
        metadata.coverPath = await api.downloadImage(customImageUrl);
      } else if (selectedImage) {
        // Lokale Festplatten-Pfade werden direkt übernommen, nicht heruntergeladen!
        if (selectedImage.startsWith('file://')) {
          let localPath = decodeURI(selectedImage.replace('file://', ''));
          if (localPath.match(/^\/[a-zA-Z]:/)) localPath = localPath.substring(1);
          metadata.coverPath = localPath.replace(/\//g, '\\');
        } else {
          metadata.coverPath = await api.downloadImage(selectedImage);
        }
      }

      onApply(metadata);
      onClose();
      setSelectedItem(null);
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingDetails(false);
    }
  };

  const handleCustomFile = async (file: File | null) => {
    if (!file) return;
    const path = await api.copyFileToTemp((file as any).path);
    setCustomImagePath(path);
    setCustomImageUrl('');
    setSelectedImage('');
  };

  const toggleOffline = async (e: React.MouseEvent, type: string, id: number, isCurrentlyOffline: boolean) => {
    e.stopPropagation();
    if (isCurrentlyOffline) {
      await api.deleteOfflineItem(type, id);
      alert('Erfolgreich gelöscht: Die Daten sind nun nicht mehr offline verfügbar.');
    } else {
      await api.makeOffline(type, id);
    }
    fetchOfflineIds();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="TMDB Suche"
      size="85%"
      centered
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' } }}
    >
      {isOffline && (
        <Text size="sm" c="orange" ta="center" mb="md" fw={500}>
          Du befindest dich im Offline-Modus. Es werden nur lokal gespeicherte Ergebnisse durchsucht.
        </Text>
      )}

      {apiError && (
        <Notification icon={<IconX size={18} />} color="red" onClose={() => setApiError(null)} mb="md">
          {apiError}
        </Notification>
      )}

      {!selectedItem ? (
        <>
          <Group mb="md" align="center">
            <TextInput
              placeholder="Film oder Serie suchen..."
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
              style={{ flex: 1 }}
            />

            <Select
              style={{ width: 110 }}
              value={language}
              onChange={handleLanguageChange}
              data={[
                { value: 'de', label: 'Deutsch' },
                { value: 'en', label: 'English' },
                { value: 'fr', label: 'Français' },
                { value: 'es', label: 'Español' }
              ]}
            />

            <Group gap="sm">
              <Checkbox label="Serien" checked={searchTv} onChange={(e) => setSearchTv(e.currentTarget.checked)} />
              <Checkbox label="Filme" checked={searchMovie} onChange={(e) => setSearchMovie(e.currentTarget.checked)} />
            </Group>

            <Switch
              label="Offline-Suche erzwingen"
              checked={isOffline}
              onChange={(e) => setIsOffline(e.currentTarget.checked)}
              ml="md"
            />

            <Button onClick={() => handleSearch()} loading={loading} leftSection={<IconSearch size={18} />}>
              Suchen
            </Button>
          </Group>

          {results.length === 0 && (
            <Text c="dimmed" ta="center" mt="xl">Noch keine Suchergebnisse.</Text>
          )}

          <Stack gap="sm">
            {results.map((item) => {
              const itemIsOffline = offlineIds.includes(`${item.type}-${item.id}`);

              return (
                <Paper
                  key={`${item.type}-${item.id}`}
                  withBorder
                  p="sm"
                  onClick={() => handleSelect(item)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'background-color 0.2s ease' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--mantine-color-gray-1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Box style={{ width: 80, height: 120, flexShrink: 0, borderRadius: '8px', overflow: 'hidden' }}>
                    {item.poster ? (
                      <Image src={item.poster} alt={item.name} width={80} height={120} fit="cover" style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Box style={{ width: '100%', height: '100%', backgroundColor: '#dee2e6' }} />
                    )}
                  </Box>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Group justify="space-between" mb={4}>
                      <Text fw={600} size="lg" truncate>{item.name}</Text>
                      <Badge color={item.type === 'tv' ? 'blue' : 'orange'} size="sm">
                        {item.type === 'tv' ? 'Serie' : 'Film'}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed" mb="xs">{item.year || 'Jahr unbekannt'}</Text>
                    {item.overview && <Text size="sm" lineClamp={2} c="gray.7">{item.overview}</Text>}
                    
                    {itemIsOffline && (
                      <Group gap="xs" mt="xs">
                        {item.availableLanguages && item.availableLanguages.map(lang => (
                          <Badge key={lang} size="xs" variant="outline" color="gray">{lang.toUpperCase()}</Badge>
                        ))}
                        {item.type === 'tv' && item.seasonsCount !== undefined && (
                          <Badge size="xs" variant="light" color={item.seasonsComplete ? 'teal' : 'yellow'}>
                            {item.seasonsCount} {item.seasonsCount === 1 ? 'Staffel' : 'Staffeln'} {item.seasonsComplete ? '✓' : ''}
                          </Badge>
                        )}
                      </Group>
                    )}
                  </Box>

                  <Box px="md">
                    {itemIsOffline ? (
                      <Tooltip label="Gespeicherte Offline-Daten löschen">
                        <ActionIcon color="red" variant="subtle" size="xl" onClick={(e) => toggleOffline(e, item.type, item.id, true)}>
                          <IconX size={24} />
                        </ActionIcon>
                      </Tooltip>
                    ) : (
                      <Tooltip label="Für Offline-Nutzung herunterladen">
                        <ActionIcon color="blue" variant="light" size="xl" onClick={(e) => toggleOffline(e, item.type, item.id, false)}>
                          <IconCloudDownload size={24} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Box>
                </Paper>
              );
            })}
          </Stack>
        </>
      ) : (
        <Box>
          <Group mb="lg" justify="space-between" align="flex-start">
            <Group>
              <Button variant="outline" onClick={() => setSelectedItem(null)} leftSection={<IconArrowLeft size={18} />}>
                Zurück
              </Button>
              <Box>
                <Text fw={500}>{selectedItem.name} ({selectedItem.year})</Text>
                {selectedItem.type === 'tv' && (
                  <Group mt="xs" align="flex-end" gap="sm">
                    <Select
                      label="Staffel"
                      placeholder="Wählen..."
                      data={seasonsList.map((s) => ({ value: String(s.season_number), label: `Staffel ${s.season_number}` }))}
                      value={selectedSeason}
                      onChange={handleSeasonChange}
                      clearable
                      style={{ width: 140 }}
                      size="xs"
                    />
                    {selectedSeason && (
                      <Select
                        label="Episode"
                        placeholder="Wählen..."
                        data={episodesList.map((e) => ({ value: String(e.episode_number), label: `${e.episode_number}. ${e.name}` }))}
                        value={selectedEpisode}
                        onChange={setSelectedEpisode}
                        clearable
                        style={{ width: 220 }}
                        size="xs"
                        searchable
                      />
                    )}
                  </Group>
                )}
              </Box>
            </Group>
          </Group>

          <Tabs defaultValue="tmdb" mb="md">
            <Tabs.List>
              <Tabs.Tab value="tmdb">TMDB-Bilder</Tabs.Tab>
              <Tabs.Tab value="file">Eigene Datei</Tabs.Tab>
              <Tabs.Tab value="url">URL</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="tmdb" pt="md">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', maxHeight: '40vh', overflowY: 'auto' }}>
                {availableImages.map((img) => (
                  <Box
                    key={img.url}
                    onClick={() => {
                      setSelectedImage(img.url);
                      setCustomImagePath('');
                      setCustomImageUrl('');
                    }}
                    style={{
                      position: 'relative',
                      border: selectedImage === img.url ? '3px solid #228be6' : '3px solid transparent',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <Image src={img.url} width={120} height={180} fit="cover" />
                    {img.lang && (
                      <Badge
                        size="xs"
                        color={img.lang === 'DE' ? 'blue' : 'gray'}
                        style={{ position: 'absolute', bottom: 4, right: 4, pointerEvents: 'none', opacity: 0.9 }}
                      >
                        {img.lang}
                      </Badge>
                    )}
                  </Box>
                ))}
              </div>
            </Tabs.Panel>

            <Tabs.Panel value="file" pt="md">
              <FileInput
                placeholder="Bild auswählen"
                accept="image/*"
                onChange={handleCustomFile}
                clearable
              />
              {customImagePath && <Text size="sm" mt="xs">Ausgewählte Datei: {customImagePath.split('\\').pop()}</Text>}
            </Tabs.Panel>

            <Tabs.Panel value="url" pt="md">
              <TextInput
                placeholder="https://..."
                value={customImageUrl}
                onChange={(e) => {
                  setCustomImageUrl(e.currentTarget.value);
                  setSelectedImage('');
                  setCustomImagePath('');
                }}
              />
            </Tabs.Panel>
          </Tabs>

          <Button onClick={handleApply} fullWidth loading={fetchingDetails} size="md">
            Metadaten & Cover übernehmen
          </Button>
        </Box>
      )}
    </Modal>
  );
};

export default TmdbSearch;