import React from 'react';
import { Paper, Title, Table, Badge, Select, TextInput, Checkbox, ActionIcon, Button, Group, Tooltip, Text, Flex, Box } from '@mantine/core';
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

  const hasAnyWarnings = subtitles.some(track => track.duration && videoDuration && Math.abs(track.duration - videoDuration) > 300);

  const rows = subtitles.map((track, idx) => {
    const isDurationMismatch = track.duration && videoDuration && Math.abs(track.duration - videoDuration) > 300;

    return (
      <Table.Tr key={track.id || idx}>
        <Table.Td style={{ width: 130, padding: '6px 8px' }}>
          <Tooltip label={track.type === 'embedded' ? 'In Videodatei eingebettet' : track.filename || track.path} multiline w={300}>
            <Badge color={track.type === 'embedded' ? 'blue' : 'green'} variant="light" style={{ textOverflow: 'ellipsis', overflow: 'hidden', width: '100%' }}>
              {track.type === 'embedded' ? 'Eingebettet' : track.filename || 'Datei'}
            </Badge>
          </Tooltip>
        </Table.Td>
        <Table.Td style={{ width: 120, padding: '6px 8px' }}>
          <Select
            data={LANGUAGES}
            value={track.language}
            onChange={(val) => updateTrack(idx, { language: val || 'eng' })}
            searchable
            allowDeselect={false}
            size="xs"
            comboboxProps={{ withinPortal: true }}
          />
        </Table.Td>
        <Table.Td style={{ width: 120, padding: '6px 8px' }}>
          <Tooltip label="Interner Spurname im Videoplayer (z.B. 'Forced', 'Vollständig', 'SDH für Hörgeschädigte')." multiline w={220}>
            <TextInput
              placeholder="z.B. Forced"
              value={track.title}
              onChange={(e) => updateTrack(idx, { title: e.currentTarget.value })}
              size="xs"
            />
          </Tooltip>
        </Table.Td>
        <Table.Td style={{ width: 170, padding: '6px 8px' }}>
          <Flex gap="xs" align="center">
            <Tooltip label="Legt fest, dass diese Untertitelspur beim Abspielen im Player automatisch als Hauptspur ausgewählt wird." multiline w={220}>
              <Checkbox
                label="Standard"
                size="xs"
                checked={track.isDefault}
                onChange={(e) => updateTrack(idx, { isDefault: e.currentTarget.checked })}
              />
            </Tooltip>
            <Tooltip label="Kennzeichnet Untertitel für fremdsprachige Passagen/Schilder. Wird von Playern auch bei ausgeschalteten Untertiteln eingeblendet." multiline w={230}>
              <Checkbox
                label="Erzwungen"
                size="xs"
                checked={track.isForced}
                onChange={(e) => updateTrack(idx, { isForced: e.currentTarget.checked })}
              />
            </Tooltip>
          </Flex>
        </Table.Td>
        {hasAnyWarnings && (
          <Table.Td style={{ width: 130, padding: '6px 8px' }}>
            {isDurationMismatch && (
              <Tooltip label={`Dauer Untertitel: ${formatDuration(track.duration)} vs Video: ${formatDuration(videoDuration)}`}>
                <Badge color="red" size="xs" leftSection={<IconAlertTriangle size={10} />}>
                  Dauer abweichend
                </Badge>
              </Tooltip>
            )}
          </Table.Td>
        )}
        <Table.Td style={{ width: 40, padding: '6px 4px', textAlign: 'center' }}>
          <ActionIcon color="red" variant="subtle" size="sm" onClick={() => removeTrack(idx)}>
            <IconTrash size={16} />
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
        <Box style={{ overflowX: 'auto', width: '100%' }}>
          <Table striped highlightOnHover style={{ width: '100%', minWidth: 600 }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 130 }}>Typ / Datei</Table.Th>
                <Table.Th style={{ width: 120 }}>Sprache</Table.Th>
                <Table.Th style={{ width: 120 }}>Titel</Table.Th>
                <Table.Th style={{ width: 170 }}>Optionen</Table.Th>
                {hasAnyWarnings && <Table.Th style={{ width: 130 }}>Warnungen</Table.Th>}
                <Table.Th style={{ width: 40 }}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        </Box>
      )}
    </Paper>
  );
};

export default SubtitleManager;
