import React from 'react';
import { Paper, Title, Table, Badge, Select, TextInput, Switch, ActionIcon, Button, Group, Tooltip, Text, Flex } from '@mantine/core';
import { IconTrash, IconPlus, IconAlertTriangle } from '@tabler/icons-react';

export interface SubtitleTrack {
  id: string;
  type: 'embedded' | 'external';
  path?: string;
  filename?: string;
  language: string;
  title: string;
  isDefault: boolean;
  isForced: boolean;
  duration?: number;
}

interface Props {
  subtitles?: SubtitleTrack[];
  onChange: (subtitles: SubtitleTrack[]) => void;
  videoDuration?: number;
  selectionCount: number;
}

const LANGUAGES = [
  { value: 'deu', label: 'Deutsch' },
  { value: 'eng', label: 'English' },
  { value: 'fra', label: 'Français' },
  { value: 'spa', label: 'Español' },
  { value: 'ita', label: 'Italiano' },
  { value: 'por', label: 'Português' },
  { value: 'nld', label: 'Nederlands' },
  { value: 'jpn', label: '日本語' },
];

const SubtitleManager: React.FC<Props> = ({ subtitles = [], onChange, videoDuration, selectionCount }) => {
  const api = (window as any).electronAPI;

  const handleAddSubtitle = async () => {
    try {
      let paths: string[] = [];
      if (api.selectSubtitles) {
        paths = await api.selectSubtitles();
      } else if (api.openSubtitles) {
        paths = await api.openSubtitles();
      } else {
        paths = await api.selectFiles();
      }

      if (!paths || paths.length === 0) return;

      const newTracks: SubtitleTrack[] = [...subtitles];
      for (const p of paths) {
        const filename = p.split('\\').pop()?.split('/').pop() || '';
        const lower = filename.toLowerCase();
        
        let lang = 'eng';
        if (lower.includes('.de.') || lower.includes('.ger.') || lower.includes('.deu.')) lang = 'deu';
        else if (lower.includes('.en.') || lower.includes('.eng.')) lang = 'eng';
        else if (lower.includes('.fr.') || lower.includes('.fra.')) lang = 'fra';
        else if (lower.includes('.es.') || lower.includes('.spa.')) lang = 'spa';

        const forced = lower.includes('.forced') || lower.includes('.erzwungen');

        newTracks.push({
          id: Math.random().toString(36).substring(7),
          type: 'external',
          path: p,
          filename,
          language: lang,
          title: '',
          isDefault: false,
          isForced: forced,
        });
      }
      onChange(newTracks);
    } catch (err) {
      console.error(err);
    }
  };

  const updateTrack = (index: number, updates: Partial<SubtitleTrack>) => {
    const updated = [...subtitles];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeTrack = (index: number) => {
    const updated = [...subtitles];
    updated.splice(index, 1);
    onChange(updated);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unbekannt';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h > 0 ? h + 'h ' : ''}${m}m`;
  };

  if (selectionCount === 0) return null;

  const rows = subtitles.map((track, idx) => {
    const isDurationMismatch = track.duration && videoDuration && Math.abs(track.duration - videoDuration) > 300;

    return (
      <Table.Tr key={track.id || idx}>
        <Table.Td>
          <Badge color={track.type === 'embedded' ? 'blue' : 'green'} variant="light">
            {track.type === 'embedded' ? 'Eingebettet' : track.filename}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Select
            data={LANGUAGES}
            value={track.language}
            onChange={(val) => updateTrack(idx, { language: val || 'eng' })}
            searchable
            allowDeselect={false}
          />
        </Table.Td>
        <Table.Td>
          <TextInput
            placeholder="Titel (z.B. SDH)"
            value={track.title}
            onChange={(e) => updateTrack(idx, { title: e.currentTarget.value })}
          />
        </Table.Td>
        <Table.Td>
          <Flex gap="sm">
            <Switch
              label="Standard"
              checked={track.isDefault}
              onChange={(e) => updateTrack(idx, { isDefault: e.currentTarget.checked })}
            />
            <Switch
              label="Erzwungen"
              checked={track.isForced}
              onChange={(e) => updateTrack(idx, { isForced: e.currentTarget.checked })}
            />
          </Flex>
        </Table.Td>
        <Table.Td>
          {isDurationMismatch && (
            <Tooltip label={`Dauer Untertitel: ${formatDuration(track.duration)} vs Video: ${formatDuration(videoDuration)}`}>
              <Badge color="red" leftSection={<IconAlertTriangle size={12} />}>
                Dauer weicht ab: {formatDuration(track.duration)} vs Video {formatDuration(videoDuration)}
              </Badge>
            </Tooltip>
          )}
        </Table.Td>
        <Table.Td>
          <ActionIcon color="red" onClick={() => removeTrack(idx)}>
            <IconTrash size={18} />
          </ActionIcon>
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Paper shadow="xs" p="md" withBorder mb="md">
      <Group justify="space-between" mb="sm">
        <Title order={3}>Untertitel (Subtitles)</Title>
        <Button leftSection={<IconPlus size={16} />} variant="light" size="sm" onClick={handleAddSubtitle}>
          Untertitel hinzufügen
        </Button>
      </Group>

      {subtitles.length === 0 ? (
        <Text c="dimmed" size="sm">Keine Untertitel vorhanden.</Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Typ / Datei</Table.Th>
              <Table.Th>Sprache</Table.Th>
              <Table.Th>Titel</Table.Th>
              <Table.Th>Optionen</Table.Th>
              <Table.Th>Warnungen</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
      )}
    </Paper>
  );
};

export default SubtitleManager;
