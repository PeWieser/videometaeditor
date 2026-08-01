import React, { useEffect, useState, useMemo } from 'react';
import { Modal, Table, TextInput, Button, Group, Progress, Text, Select } from '@mantine/core';
import { FileEntry } from '../App';

interface Props {
  seriesName: string;
  files: FileEntry[];
  pattern: { titleIdx: number; seasonIdx?: number; episodeIdx: number } | null;
  onClose: () => void;
  // FIX: onBatchSearch erwartet nun auch die Sprache
  onBatchSearch: (files: FileEntry[], language: string) => Promise<void>;
}

const SeriesMatrix: React.FC<Props> = ({ seriesName, files, pattern, onClose, onBatchSearch }) => {
  const [episodes, setEpisodes] = useState<FileEntry[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);

  // NEU: Sprach-Status
  const [language, setLanguage] = useState('de');
  const api = (window as any).electronAPI;

  useEffect(() => {
    // Lädt die zuletzt genutzte Sprache einmalig beim Mounten
    api.getSetting('searchLanguage').then((l: any) => {
      if (l) setLanguage(l);
    });
  }, []);

  useEffect(() => {
    const sorted = files
      .filter((f) => f.metadata.show === seriesName)
      .sort(
        (a, b) =>
          (a.metadata.season || 0) - (b.metadata.season || 0) ||
          (a.metadata.episode || 0) - (b.metadata.episode || 0)
      );
    setEpisodes(sorted.map((f) => ({ ...f, metadata: { ...f.metadata } })));
  }, [files, seriesName]);

  const updateField = (index: number, field: string, value: string) => {
    const updated = [...episodes];
    updated[index].metadata[field] = value;
    setEpisodes(updated);
  };

  const handleBatchSearch = async () => {
    setBatchRunning(true);
    await onBatchSearch(episodes, language); // Sprache wird ans Backend weitergegeben
    setBatchRunning(false);
  };

  const handleLanguageChange = (val: string | null) => {
    const newLang = val || 'de';
    setLanguage(newLang);
    api.setSetting('searchLanguage', newLang); // Speichert die Sprache für immer
  };

  let patternDescription = 'Kein Muster definiert';
  if (pattern) {
    if (pattern.seasonIdx !== undefined && pattern.seasonIdx >= 0) {
      patternDescription = `Muster: Staffel an Pos ${pattern.seasonIdx + 1}, Episode an Pos ${pattern.episodeIdx + 1}`;
    } else if (pattern.episodeIdx !== undefined && pattern.episodeIdx >= 0) {
      patternDescription = `Muster: Episode an Pos ${pattern.episodeIdx + 1} (Ohne Staffelzuweisung)`;
    } else {
      patternDescription = `Muster: Manuell zugewiesen / Freie Texteingabe`;
    }
  }

  const rows = useMemo(() => {
    return episodes.map((ep, i) => (
      <tr key={ep.path}>
        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Text size="xs" title={ep.name}>{ep.name}</Text>
        </td>
        <td style={{ width: 80 }}>
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
        {patternDescription}
      </Text>

      {batchRunning && (
        <Progress value={100} animated mb="md" size="sm" />
      )}

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