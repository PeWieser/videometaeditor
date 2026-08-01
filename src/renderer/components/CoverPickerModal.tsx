import React, { useEffect, useState, useMemo } from 'react';
import {
  Modal,
  Tabs,
  Image,
  Box,
  FileInput,
  TextInput,
  Button,
  Group,
  Badge,
  Loader,
  Checkbox,
  Text,
  Divider,
  Switch,
} from '@mantine/core';

interface TmdbImage {
  url: string;
  lang: string;
  season: string | number;
}

interface Props {
  opened: boolean;
  onClose: () => void;
  metadata: any;
  onSelect: (coverPath: string) => void;
}

const CoverPickerModal: React.FC<Props> = ({ opened, onClose, metadata, onSelect }) => {
  const [images, setImages] = useState<TmdbImage[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [customFile, setCustomFile] = useState<string>('');
  const [customUrl, setCustomUrl] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [seasonFilter, setSeasonFilter] = useState('');
  const [showAllSeasons, setShowAllSeasons] = useState(false);
  const [loading, setLoading] = useState(false);

  // NEU: Offline-Stati wie im großen Suchfenster
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const api = (window as any).electronAPI;

  // NEU: Überwachung der Internetverbindung
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

  const fetchImages = async (type: string, id: number, seasonStr?: string, fetchAll: boolean = false) => {
    try {
      setLoading(true);
      const imgs = await api.getImages(type, id, seasonStr || 'all', fetchAll);
      setImages(imgs);
      setSelected(imgs.length > 0 ? imgs[0].url : '');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async () => {
    if (!searchQuery) return;
    setLoading(true);
    try {
      // FIX: Die Ergebnisse des Backends werden hier jetzt korrekt entpackt
      const searchRes = await api.searchTMDB(searchQuery, 'multi', isOffline);
      
      // Falls das Backend wegen Timeout offline gegangen ist, UI updaten
      if (searchRes.offlineFallback) {
        setIsOffline(true);
      }

      const results = searchRes.results || [];

      if (results.length > 0) {
        await fetchImages(results[0].type, results[0].id, seasonFilter, showAllSeasons);
      } else {
        setImages([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opened) {
      const titleToSearch = metadata?.show || metadata?.title || '';
      const seasonToSearch = metadata?.season ? String(metadata.season) : '';
      
      setSearchQuery(titleToSearch);
      setSeasonFilter(seasonToSearch);
      
      if (metadata?.tmdbId && metadata?.tmdbType) {
        fetchImages(metadata.tmdbType, metadata.tmdbId, seasonToSearch, showAllSeasons);
      } else if (titleToSearch) {
        performSearch();
      }
    }
  }, [opened, showAllSeasons]);

  const handleApply = async () => {
    let coverPath = '';
    if (customFile) {
      coverPath = customFile;
    } else if (customUrl) {
      coverPath = await api.downloadImage(customUrl);
    } else if (selected) {
      coverPath = await api.downloadImage(selected);
    }
    if (coverPath) {
      onSelect(coverPath);
    }
    onClose();
  };

  const groupedImages = useMemo(() => {
    const groups: Record<string, TmdbImage[]> = {};
    images.forEach(img => {
      const key = String(img.season);
      if (!groups[key]) groups[key] = [];
      groups[key].push(img);
    });
    return groups;
  }, [images]);

  const sortedKeys = useMemo(() => {
    return Object.keys(groupedImages).sort((a, b) => {
      if (a === 'Serie' || a === 'Film') return 1;
      if (b === 'Serie' || b === 'Film') return -1;
      return Number(a) - Number(b);
    });
  }, [groupedImages]);

  return (
    <Modal opened={opened} onClose={onClose} title="Cover auswählen" size="xl" centered>
      
      {/* NEU: Offline Warntext */}
      {isOffline && (
        <Text size="sm" c="orange" ta="center" mb="md" fw={500}>
          Du befindest dich im Offline-Modus. Es werden nur lokal gespeicherte Cover durchsucht.
        </Text>
      )}

      <Tabs defaultValue="tmdb">
        <Tabs.List>
          <Tabs.Tab value="tmdb">TMDB</Tabs.Tab>
          <Tabs.Tab value="file">Datei</Tabs.Tab>
          <Tabs.Tab value="url">URL</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="tmdb" pt="md">
          <Group mb="sm" align="flex-end">
            <TextInput 
              label="Suche" 
              placeholder="Serie oder Film..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && performSearch()}
              style={{ flex: 1 }} 
            />
            <TextInput 
              label="Staffel" 
              placeholder="Alle" 
              value={seasonFilter} 
              onChange={(e) => setSeasonFilter(e.currentTarget.value)}
              style={{ width: 80 }} 
            />
            <Button onClick={performSearch} loading={loading}>Suchen</Button>
          </Group>

          {/* NEU: Schalter nebeneinander platziert */}
          <Group mb="md" justify="space-between">
            <Checkbox
              label="Auch Cover anderer Staffeln suchen & anzeigen"
              checked={showAllSeasons}
              onChange={(e) => setShowAllSeasons(e.currentTarget.checked)}
            />
            
            <Switch 
              label="Offline-Suche erzwingen" 
              checked={isOffline} 
              onChange={(e) => setIsOffline(e.currentTarget.checked)} 
            />
          </Group>

          {loading ? (
             <Group justify="center" p="xl"><Loader /></Group>
          ) : (
            <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: '10px' }}>
              {sortedKeys.map((seasonKey) => (
                <Box key={seasonKey} mb="lg">
                  <Divider 
                    my="sm" 
                    label={seasonKey === 'Serie' ? 'Allgemeine Cover / Nicht zugeordnet' : seasonKey === 'Film' ? 'Film Cover' : `Staffel ${seasonKey}`} 
                    labelPosition="left" 
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {groupedImages[seasonKey].map((img) => (
                      <Box
                        key={img.url}
                        onClick={() => { setSelected(img.url); setCustomFile(''); setCustomUrl(''); }}
                        style={{
                          position: 'relative',
                          border: selected === img.url ? '3px solid #228be6' : '3px solid transparent',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          overflow: 'hidden',
                        }}
                      >
                        <Image src={img.url} width={120} height={180} fit="cover" />
                        <Badge 
                          size="xs" 
                          color={img.lang === 'DE' ? 'blue' : 'gray'}
                          style={{ position: 'absolute', bottom: 4, right: 4, pointerEvents: 'none', opacity: 0.9 }}
                        >
                          {img.lang}
                        </Badge>
                      </Box>
                    ))}
                  </div>
                </Box>
              ))}
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="file" pt="md">
          <FileInput
            placeholder="Bild auswählen"
            accept="image/*"
            onChange={async (file) => {
              if (file) {
                const path = await api.copyFileToTemp((file as any).path);
                setCustomFile(path);
                setSelected('');
                setCustomUrl('');
              }
            }}
            clearable
          />
        </Tabs.Panel>

        <Tabs.Panel value="url" pt="md">
          <TextInput
            placeholder="https://..."
            value={customUrl}
            onChange={(e) => {
              setCustomUrl(e.currentTarget.value);
              setSelected('');
              setCustomFile('');
            }}
          />
          {customUrl.trim().length > 5 && (
            <Box mt="md" style={{ display: 'flex', justifyContent: 'center' }}>
              <Box style={{ width: 150, height: 225, borderRadius: '8px', overflow: 'hidden', border: '1px solid #dee2e6' }}>
                <Image src={customUrl} width={150} height={225} fit="cover" fallbackSrc="https://placehold.co/150x225?text=Fehler" />
              </Box>
            </Box>
          )}
        </Tabs.Panel>
      </Tabs>

      <Group mt="md" justify="flex-end">
        <Button onClick={handleApply}>Übernehmen</Button>
      </Group>
    </Modal>
  );
};

export default CoverPickerModal;