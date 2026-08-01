import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppShell,
  Button,
  Group,
  Paper,
  Title,
  Tooltip,
  Text,
  Stack,
  ActionIcon,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconTable,
  IconMoon,
  IconSun,
  IconSettings,
} from '@tabler/icons-react';
import FileList from './components/FileList';
import MetadataForm from './components/MetadataForm';
import TmdbSearch from './components/TmdbSearch';
import SeriesMatrix from './components/SeriesMatrix';
import OutputSettings from './components/OutputSettings';
import SubtitleManager from './components/SubtitleManager';
import CoverPickerModal from './components/CoverPickerModal';
import PatternSelector from './components/PatternSelector';
import SettingsModal from './components/SettingsModal';
import ProgressModal from './components/ProgressModal';
import { useIpc } from './hooks/useIpc';

export interface FileEntry {
  path: string;
  name: string;
  metadata: any;
  status: 'unchanged' | 'modified' | 'saved';
}

const App: React.FC = () => {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [metadata, setMetadata] = useState<any>({});
  const [showMatrix, setShowMatrix] = useState(false);
  const [activeSeries, setActiveSeries] = useState('');
  const [coverModalOpen, setCoverModalOpen] = useState(false);
  const [tmdbModalOpen, setTmdbModalOpen] = useState(false);
  const [tmdbInitialQuery, setTmdbInitialQuery] = useState<string | undefined>(undefined);

  const [progressValue, setProgressValue] = useState(0);
  const [progressVisible, setProgressVisible] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');

  const [seriesMode, setSeriesMode] = useState(false);
  const [pattern, setPattern] = useState<{ titleIdx: number; seasonIdx?: number; episodeIdx: number; } | null>(null);
  const [patternEditMode, setPatternEditMode] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [patternSeparator, setPatternSeparator] = useState('\\s*-\\s*|\\s+');
  const [outputFolder, setOutputFolder] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const extractingPathsRef = useRef<Set<string>>(new Set());

  const { getMetadata } = useIpc();
  const api = (window as any).electronAPI;

  useEffect(() => {
    api.getSetting('overwrite').then((val: any) => {
      if (val !== undefined) setOverwrite(!!val);
    });
    api.getSetting('patternSeparator').then((val: any) => {
      if (val) setPatternSeparator(val);
    });
  }, []);

  const handleSetOverwrite = (val: boolean) => {
    setOverwrite(val);
    api.setSetting('overwrite', val);
  };

  const handleSetPatternSeparator = (val: string) => {
    setPatternSeparator(val);
    api.setSetting('patternSeparator', val);
  };

  useEffect(() => {
    (async () => {
      const filesToProcess = files.filter(f => Object.keys(f.metadata).length === 0);
      if (filesToProcess.length === 0) return;

      setProgressVisible(true);
      const updated = [...files];

      for (let i = 0; i < updated.length; i++) {
        if (Object.keys(updated[i].metadata).length === 0) {
          setProgressMessage(`Lese Metadaten der Dateien... (${i + 1}/${updated.length})`);
          setProgressValue(((i + 1) / updated.length) * 100);
          updated[i].metadata = await getMetadata(updated[i].path);
        }
      }

      setFiles(updated);
      setProgressVisible(false);
    })();
  }, [files.length, getMetadata]);

  useEffect(() => {
    if (selectedIndices.length > 0) {
      const filesToExtract = selectedIndices.filter(idx => {
        const file = files[idx];
        return file && file.metadata.cover === true && !file.metadata.coverPath && !extractingPathsRef.current.has(file.path);
      });

      if (filesToExtract.length > 0) {
        filesToExtract.forEach(idx => extractingPathsRef.current.add(files[idx].path));
        (async () => {
          const updatedFiles = [...files];
          let changed = false;
          for (const idx of filesToExtract) {
            const file = updatedFiles[idx];
            if (!file) continue;
            const coverPath = await api.extractCover(file.path);
            if (coverPath) {
              const currentIdx = updatedFiles.findIndex(f => f.path === file.path);
              if (currentIdx !== -1) {
                updatedFiles[currentIdx].metadata = { ...updatedFiles[currentIdx].metadata, coverPath };
                changed = true;
              }
            }
            extractingPathsRef.current.delete(file.path);
          }
          if (changed) setFiles(updatedFiles);
        })();
      }
    }
  }, [selectedIndices, files]);

  useEffect(() => {
    api.onFilesDropped((paths: string[]) => {
      const newFiles = paths.map((p: string) => ({
        path: p, name: p.split('\\').pop() || p, metadata: {}, status: 'unchanged' as const,
      }));
      setFiles((prev) => [...prev, ...newFiles]);
    });
  }, []);

  useEffect(() => {
    api.onProgress((data: any) => {
      if (data.opened !== undefined) setProgressVisible(data.opened);
      else setProgressVisible(true);
      setProgressValue(data.current);
      if (data.message) setProgressMessage(data.message);
    });
    return () => { api.removeProgressListener(); };
  }, []);

  useEffect(() => {
    if (files.length > 1) {
      let splitRegex = /[-_\s]+/;
      try {
        splitRegex = new RegExp(patternSeparator || '\\s*-\\s*|\\s+');
      } catch (e) {
        splitRegex = /[-_\s]+/;
      }

      const filesSegments = files.map(f => {
        return f.name
          .replace(/\.\w+$/, '')
          .split(splitRegex)
          .filter(Boolean);
      });

      const groups: Record<string, number[]> = {};
      filesSegments.forEach((segs, idx) => {
        const firstSeg = (segs[0] || '').toLowerCase().trim();
        if (firstSeg) {
          if (!groups[firstSeg]) groups[firstSeg] = [];
          groups[firstSeg].push(idx);
        }
      });

      let bestGroupKey = '';
      let maxGroupSize = 0;
      for (const [key, indices] of Object.entries(groups)) {
        if (indices.length > maxGroupSize) {
          maxGroupSize = indices.length;
          bestGroupKey = key;
        }
      }

      if (maxGroupSize >= 2) {
        const groupIndices = groups[bestGroupKey];
        const groupSegments = groupIndices.map(idx => filesSegments[idx]);
        
        const commonSegments: string[] = [];
        const firstFileSegs = groupSegments[0] || [];
        
        for (let i = 0; i < firstFileSegs.length; i++) {
          const seg = firstFileSegs[i];
          const allMatch = groupSegments.every(segs => segs[i] && segs[i].toLowerCase() === seg.toLowerCase());
          if (allMatch) {
            commonSegments.push(seg);
          } else {
            break;
          }
        }

        let commonTitle = commonSegments.join(' ').trim();
        commonTitle = commonTitle
          .replace(/\s+(S\d+|Season\s*\d+|Staffel\s*\d+|E\d+|Episode\s*\d+|\d+)$/i, '')
          .trim();

        if (commonTitle.length > 2) {
          setSeriesMode(true);
          setActiveSeries(commonTitle);
          return;
        }
      }
      
      setSeriesMode(false);
    } else {
      setSeriesMode(false);
    }
  }, [files, patternSeparator]);

  const getCommonMetadata = useCallback((indices: number[]): any => {
    if (indices.length === 0) return {};
    if (indices.length === 1) return files[indices[0]].metadata;
    const first = files[indices[0]].metadata;
    const result: any = {};
    for (const key of Object.keys(first)) {
      const allSame = indices.every((i) => files[i].metadata[key] === first[key]);
      result[key] = allSame ? first[key] : '[individuell]';
    }
    return result;
  }, [files]);

  useEffect(() => {
    setMetadata(getCommonMetadata(selectedIndices));
  }, [selectedIndices, getCommonMetadata]);

  const handleAddFiles = async () => {
    const paths = await api.selectFiles();
    const newFiles = paths.map((p: string) => ({
      path: p, name: p.split('\\').pop() || p, metadata: {}, status: 'unchanged' as const,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveAllFiles = () => {
    setFiles([]);
    setSelectedIndices([]);
  };

  const handleRemoveFiles = (indices: number[]) => {
    setFiles((prev) => prev.filter((_, i) => !indices.includes(i)));
    setSelectedIndices([]);
  };

  const handleSelectionChange = (indices: number[]) => {
    setSelectedIndices(indices);
  };

  const handleOpenTmdb = (initial?: string) => {
    setTmdbInitialQuery(initial);
    setTmdbModalOpen(true);
  };

  const openMatrix = () => {
    setShowMatrix(true);
  };

  const startPatternEdit = () => {
    setPatternEditMode(true);
  };

  const handlePatternApplied = (
    newMetaList: any[],
    newPattern: { titleIdx: number; seasonIdx?: number; episodeIdx: number }
  ) => {
    const updated = files.map((f, i) => ({
      ...f,
      metadata: newMetaList[i] || f.metadata,
      status: 'modified' as const,
    }));
    setFiles(updated);
    setPattern(newPattern);
    setPatternEditMode(false);
    if (newMetaList.length > 0 && newMetaList[0].show) {
      setActiveSeries(newMetaList[0].show);
    }
  };

  const markAsSaved = (indices: number[]) => {
    setFiles((prev) => prev.map((f, i) => indices.includes(i) ? { ...f, status: 'saved' as const } : f));
  };

  const handleSaveAll = async (seriesPattern: string, moviePattern: string) => {
    if (files.length === 0) return;
    try {
      await api.processFiles({
        files, outputFolder, seriesPattern, moviePattern, overwrite
      });
      markAsSaved(files.map((_, i) => i));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMetadataChange = (newMeta: any) => {
    setMetadata(newMeta);
    if (selectedIndices.length === 1) {
      const idx = selectedIndices[0];
      const updated = [...files];
      updated[idx].metadata = newMeta;
      updated[idx].status = 'modified';
      setFiles(updated);
    } else if (selectedIndices.length > 1) {
      const updated = files.map((f, i) => {
        if (selectedIndices.includes(i)) {
          const merged = { ...f.metadata };
          for (const key of Object.keys(newMeta)) {
            if (newMeta[key] !== '[individuell]') merged[key] = newMeta[key];
          }
          return { ...f, metadata: merged, status: 'modified' as const };
        }
        return f;
      });
      setFiles(updated);
    }
  };

  const handleTmdbApply = (newMetadata: any) => {
    setMetadata(newMetadata);
    if (selectedIndices.length === 1) {
      const idx = selectedIndices[0];
      const updated = [...files];
      updated[idx].metadata = newMetadata;
      updated[idx].status = 'modified';
      setFiles(updated);
    } else if (selectedIndices.length > 1) {
      const updated = files.map((f, i) => {
        if (selectedIndices.includes(i)) return { ...f, metadata: { ...f.metadata, ...newMetadata }, status: 'modified' as const };
        return f;
      });
      setFiles(updated);
    }
    setTmdbModalOpen(false);
  };

  const handleCoverSelect = (coverPath: string) => {
    const updatedMeta = { ...metadata, coverPath };
    setMetadata(updatedMeta);
    if (selectedIndices.length === 1) {
      const idx = selectedIndices[0];
      const updatedFiles = [...files];
      updatedFiles[idx].metadata = updatedMeta;
      updatedFiles[idx].status = 'modified';
      setFiles(updatedFiles);
    } else if (selectedIndices.length > 1) {
      const updatedFiles = files.map((f, i) => {
        if (selectedIndices.includes(i)) return { ...f, metadata: { ...f.metadata, coverPath }, status: 'modified' as const };
        return f;
      });
      setFiles(updatedFiles);
    }
  };

  const handleApplyManualEdits = (updatedMatrixFiles: FileEntry[]) => {
    setFiles((prev) =>
      prev.map((f) => {
        const match = updatedMatrixFiles.find((m) => m.path === f.path);
        return match ? { ...f, metadata: { ...match.metadata }, status: 'modified' as const } : f;
      })
    );
  };

  const handleBatchSearch = async (matrixFiles: FileEntry[], searchLang: string, targetSeriesName?: string) => {
    let queryTitle = (targetSeriesName || activeSeries || '').trim();
    if (!queryTitle) return;
    setProgressVisible(true);
    setProgressMessage('Batch-Suche läuft...');
    setProgressValue(0);
    try {
      const isOffline = !navigator.onLine;

      let seriesSearchRes = await api.searchTMDB(queryTitle, 'tv', isOffline, searchLang);
      let seriesSearch = seriesSearchRes.results || [];

      // Smart Fallback 1: Falls die Suche mit trailing number schlägt (z.B. "Patience 2" -> "Patience")
      if (seriesSearch.length === 0) {
        const cleanedTitle = queryTitle.replace(/\s+\d+$/, '').trim();
        if (cleanedTitle && cleanedTitle !== queryTitle) {
          const fallbackRes = await api.searchTMDB(cleanedTitle, 'tv', isOffline, searchLang);
          if (fallbackRes.results && fallbackRes.results.length > 0) {
            seriesSearch = fallbackRes.results;
            queryTitle = cleanedTitle;
            setActiveSeries(cleanedTitle);
          }
        }
      }

      if (seriesSearch.length === 0) {
        alert(`Serie "${queryTitle}" nicht auf TMDB gefunden. Bitte passe den Seriennamen im Eingabefeld der Serien-Matrix an.`);
        setProgressVisible(false);
        return;
      }
      const seriesId = seriesSearch[0].id;
      const detectedShowName = seriesSearch[0].name || queryTitle;
      setActiveSeries(detectedShowName);

      setProgressMessage(`Lade Serien-Details für "${detectedShowName}"...`);
      const details = await api.getSeriesDetails(seriesId, isOffline, searchLang);
      const credits = await api.getCredits('tv', seriesId, isOffline, searchLang);

      let artist = '';
      const creators = details?.created_by || [];
      artist = creators.map((c: any) => c.name).join(', ');
      if (!artist && credits?.crew) {
        const producer = credits.crew.find((c: any) => c.job === 'Executive Producer');
        artist = producer?.name || '';
      }

      let genres = '';
      if (details?.genres && details.genres.length > 0) {
        genres = details.genres.map((g: any) => g.name).join(', ');
      }

      const year = (details?.first_air_date || '').substring(0, 4);
      const seasonPosterCache: Record<string, string> = {};
      for (let i = 0; i < matrixFiles.length; i++) {
        const f = matrixFiles[i];
        const season = f.metadata.season || '1';
        const episode = f.metadata.episode || '1';

        try {
          let epName = `${detectedShowName} S${season}E${episode}`;
          let epOverview = details?.overview || '';
          let posterPath = details?.poster_path || '';

          try {
            const seasonData = await api.getSeasonDetails(seriesId, season, isOffline, searchLang);
            if (seasonData?.poster_path) {
              posterPath = seasonData.poster_path;
            }
            const ep = seasonData?.episodes?.find((e: any) => e.episode_number === parseInt(episode));
            if (ep) {
              if (ep.name) epName = ep.name;
              if (ep.overview) epOverview = ep.overview;
            }
          } catch (e) {
            console.warn('Season details fallback to series overview', e);
          }

          if (seasonPosterCache[season] === undefined) {
            if (posterPath) {
              const url = posterPath.startsWith('http') ? posterPath : `https://image.tmdb.org/t/p/w500${posterPath}`;
              seasonPosterCache[season] = await api.downloadImage(url);
            } else {
              seasonPosterCache[season] = '';
            }
          }

          const updatedMeta = {
            ...f.metadata,
            show: detectedShowName,
            title: epName,
            artist: artist,
            year: year,
            genre: genres,
            description: epOverview,
            episode_title: epName,
            season: season,
            episode: episode,
            tmdbId: seriesId,
            tmdbType: 'tv',
          };

          if (seasonPosterCache[season]) {
            updatedMeta.coverPath = seasonPosterCache[season];
          }

          setFiles((prev) =>
            prev.map((file) =>
              file.path === f.path ? { ...file, metadata: updatedMeta, status: 'modified' as const } : file
            )
          );
        } catch (err) {
          console.error(err);
        }
        setProgressValue(((i + 1) / matrixFiles.length) * 100);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProgressVisible(false);
    }
  };

  return (
    <>
      <AppShell padding="md" navbar={{ width: 260, breakpoint: 'sm' }} aside={{ width: 300, breakpoint: 'sm' }} header={{ height: 40 }}>
        <AppShell.Header p="xs">
          <Group justify="flex-end" gap="xs">
            <ActionIcon variant="outline" color={dark ? 'yellow' : 'blue'} onClick={() => toggleColorScheme()}>
              {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
            <ActionIcon variant="outline" color={dark ? 'gray' : 'blue'} onClick={() => setSettingsOpen(true)}>
              <IconSettings size={18} />
            </ActionIcon>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="md">
          <FileList
            files={files}
            selected={selectedIndices}
            onSelectionChange={handleSelectionChange}
            onAddFiles={handleAddFiles}
            onRemoveFiles={handleRemoveFiles}
            onRemoveAllFiles={handleRemoveAllFiles}
          />
        </AppShell.Navbar>

        <AppShell.Main>
          <Paper shadow="xs" p="md" withBorder mb="md">
            <Title order={3} mb="sm">Metadaten bearbeiten</Title>
            <MetadataForm
              metadata={metadata}
              onChange={handleMetadataChange}
              onRequestCoverChange={() => setCoverModalOpen(true)}
              onRequestTmdbSearch={handleOpenTmdb}
              selectionCount={selectedIndices.length}
            />
          </Paper>

          <SubtitleManager 
            subtitles={metadata.subtitles} 
            onChange={(subtitles) => handleMetadataChange({ ...metadata, subtitles })} 
            selectionCount={selectedIndices.length} 
            videoDuration={metadata.duration} 
          />

          {seriesMode && !pattern && !patternEditMode && (
            <PatternSelector files={files} pattern={null} onChange={handlePatternApplied} patternSeparator={patternSeparator} />
          )}
          {seriesMode && pattern && !patternEditMode && (
            <Group mb="md">
              <Button variant="outline" onClick={startPatternEdit}>Namensmuster bearbeiten</Button>
              <Button leftSection={<IconTable size={18} />} onClick={openMatrix}>Serienmatrix öffnen ({activeSeries})</Button>
            </Group>
          )}
          {seriesMode && patternEditMode && (
            <PatternSelector files={files} pattern={pattern} onChange={handlePatternApplied} patternSeparator={patternSeparator} />
          )}

          {showMatrix && (
            <SeriesMatrix
              seriesName={activeSeries}
              files={files}
              pattern={pattern}
              onClose={() => setShowMatrix(false)}
              onBatchSearch={handleBatchSearch}
              onApplyManualEdits={handleApplyManualEdits}
            />
          )}
        </AppShell.Main>

        <AppShell.Aside p="md">
          <OutputSettings
            files={files}
            onSaveAll={handleSaveAll}
            overwrite={overwrite}
            setOverwrite={handleSetOverwrite}
            outputFolder={outputFolder}
            setOutputFolder={setOutputFolder}
          />
        </AppShell.Aside>
      </AppShell>

      <CoverPickerModal opened={coverModalOpen} onClose={() => setCoverModalOpen(false)} metadata={metadata} onSelect={handleCoverSelect} />
      <TmdbSearch opened={tmdbModalOpen} onClose={() => setTmdbModalOpen(false)} onApply={handleTmdbApply} initialQuery={tmdbInitialQuery} />
      <SettingsModal opened={settingsOpen} onClose={() => setSettingsOpen(false)} overwrite={overwrite} setOverwrite={handleSetOverwrite} patternSeparator={patternSeparator} setPatternSeparator={handleSetPatternSeparator} />

      <ProgressModal
        opened={progressVisible}
        message={progressMessage}
        value={progressValue}
      />
    </>
  );
};

export default App;