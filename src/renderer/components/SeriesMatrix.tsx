import React, { useEffect, useState, useMemo } from 'react';
import { Modal, Table, TextInput, Button, Group, Progress, Text, Select } from '@mantine/core';
import { FileEntry } from '../App';
import { PatternConfig } from './PatternSelector';

interface Props {
  seriesName: string;
  files: FileEntry[];
  pattern: PatternConfig | null;
  onClose: () => void;
  onBatchSearch: (files: FileEntry[], language: string, targetSeriesName?: string) => Promise<void>;
}

const SeriesMatrix: React.FC<Props> = ({
  seriesName,
  files,
  pattern,
  onClose,
  onBatchSearch,
}) => {
  const [currentSeriesName, setCurrentSeriesName] = useState(seriesName || '');
  const [episodes, setEpisodes] = useState<FileEntry[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [language, setLanguage] = useState('de');

  const api = (window as any).electronAPI;

  useEffect(() => {
    api.getSetting('searchLanguage').then((l: any) => {
      if (l) setLanguage(l);
    });
  }, []);

  useEffect(() => {
    setCurrentSeriesName(seriesName || '');
  }, [seriesName]);

  useEffect(() => {
    // Zeige immer alle übergebenen Dateien in der Serien-Matrix
    const sorted = [...files].sort(
      (a, b) =>
        (parseInt(a.metadata.season) || 0) - (parseInt(b.metadata.season) || 0) ||
        (parseInt(a.metadata.episode) || 0) - (parseInt(b.metadata.episode) || 0)
    );
    setEpisodes(sorted.map((f) => ({ ...f, metadata: { ...f.metadata, show: f.metadata.show || seriesName } })));
  }, [files, seriesName]);

  const handleSeriesNameChange = (newName: string) => {
    setCurrentSeriesName(newName);
    setEpisodes((prev) =>
      prev.map((ep) => ({
        ...ep,
        metadata: { ...ep.metadata, show: newName },
      }))
    );
  };

  const updateField = (index: number, field: string, value: string) => {
    const updated = [...episodes];
    updated[index].metadata[field] = value;
    setEpisodes(updated);
  };

  const handleBatchSearch = async () => {
    setBatchRunning(true);
    await onBatchSearch(episodes, language, currentSeriesName);
    setBatchRunning(false);
  };

  const handleLanguageChange = (val: string | null) => {
    const newLang = val || 'de';
    setLanguage(newLang);
    api.setSetting('searchLanguage', newLang);
  };

  let patternDescription = 'Kein Muster definiert';
  if (pattern) {
    const hasSeason = pattern.seasonIndices && pattern.seasonIndices.length > 0;
    const hasEpisode = pattern.episodeIndices && pattern.episodeIndices.length > 0;
    if (hasSeason && hasEpisode) {
      patternDescription = `Muster: Staffel Pos ${pattern.seasonIndices.map(i => i + 1).join(', ')}, Episode Pos ${pattern.episodeIndices.map(i => i + 1).join(', ')}`;
    } else if (hasEpisode) {
      patternDescription = `Muster: Episode Pos ${pattern.episodeIndices.map(i => i + 1).join(', ')} (Ohne Staffelzuweisung)`;
    } else if (pattern.titleText || pattern.seasonText || pattern.episodeText) {
      patternDescription = `Muster: Manuell definiert / Eingabe`;
    }
  }

  const rows = useMemo(() => {
    return episodes.map((ep, i) => (
      <tr key={ep.path}>
        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Text size="xs" title={ep.name}>{ep.name}</Text>
        </td>
        <td style={{ width: 90 }}>
          <TextInput
            value={ep.metadata.season || ''}
            onChange={(e) => updateField(i, 'season', e.currentTarget.value)}
            size="xs"
            styles={{ input: { textAlign: 'center' } }}
          />
        </td>
        <td style={{ width: 100 }}>
          <TextInput
            value={ep.metadata.episode || ''}
            onChange={(e) => updateField(i, 'episode', e.currentTarget.value)}
            size="xs"
            styles={{ input: { textAlign: 'center' } }}
          />
        </td>
        <td>
          <TextInput
            value={ep.metadata.title || ''}
            onChange={(e) => updateField(i, 'title', e.currentTarget.value)}
            size="xs"
          />
        </td>
      </tr>
    ));
  }, [episodes]);

  return (
    <Modal opened={true} onClose={onClose} title={`Serien‑Matrix: ${seriesName}`} size="80%">
      <Text size="sm" mb="xs" c="dimmed">
        {patternDescription} ({episodes.length} Dateien geladen)
      </Text>

      {batchRunning && (
        <Progress value={100} animated mb="md" size="sm" />
      )}

      <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
        <Table striped highlightOnHover>
          <thead>
            <tr>
              <th>Dateiname</th>
              <th>Staffel</th>
              <th>Episode</th>
              <th>Titel</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </Table>
      </div>

      <Group mt="xl" justify="flex-end">
        <Select
          data={[
            { value: 'de', label: 'Deutsch' },
            { value: 'en', label: 'English' },
            { value: 'fr', label: 'Français' },
            { value: 'es', label: 'Español' }
          ]}
          value={language}
          onChange={handleLanguageChange}
          style={{ width: 120 }}
          disabled={batchRunning}
        />
        <Button onClick={handleBatchSearch} disabled={batchRunning}>
          Batch-Suche (TMDB)
        </Button>
        <Button variant="default" onClick={onClose} disabled={batchRunning}>
          Schließen
        </Button>
      </Group>
    </Modal>
  );
};

export default SeriesMatrix;