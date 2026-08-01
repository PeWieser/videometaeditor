import React, { useState, useEffect } from 'react';
import { TextInput, Button, Switch, Stack, Box, Tooltip, Popover, Text, Group, Code } from '@mantine/core';
import { IconInfoCircle, IconFiles } from '@tabler/icons-react';

interface Props {
  files: any[];
  onSaveAll: (seriesPat: string, moviePat: string) => void;
  overwrite: boolean;
  setOverwrite: (val: boolean) => void;
  outputFolder: string;
  setOutputFolder: (path: string) => void;
}

const OutputSettings: React.FC<Props> = ({
  files,
  onSaveAll,
  overwrite,
  setOverwrite,
  outputFolder,
  setOutputFolder,
}) => {
  const [seriesPattern, setSeriesPattern] = useState('{show} - S{season}E{episode} - {title}');
  const [moviePattern, setMoviePattern] = useState('{title} ({year})');

  const api = (window as any).electronAPI;

  useEffect(() => {
    (async () => {
      const savedSeries = await api.getSetting('seriesPattern');
      const savedMovie = await api.getSetting('moviePattern');
      if (savedSeries) setSeriesPattern(savedSeries);
      if (savedMovie) setMoviePattern(savedMovie);
    })();
  }, []);

  const selectFolder = async () => {
    const folder = await api.selectOutputFolder();
    if (folder) setOutputFolder(folder);
  };

  const handleSeriesChange = (val: string) => {
    setSeriesPattern(val);
    api.setSetting('seriesPattern', val);
  };

  const handleMovieChange = (val: string) => {
    setMoviePattern(val);
    api.setSetting('moviePattern', val);
  };

  const placeholderInfo = (
    <Box>
      <Text size="sm" fw={500} mb="xs">Verfügbare Platzhalter:</Text>
      <Code block>{`{title}        – Titel der Episode / des Films
{show}         – Serienname
{season}       – Staffelnummer
{episode}      – Episodennummer
{episode_title} – Episodentitel
{year}         – Erscheinungsjahr`}</Code>
      <Text size="xs" mt="xs">Beispiel Serie: <Code>{'{show} - S{season}E{episode} - {title}'}</Code></Text>
    </Box>
  );

  return (
    <Stack mt="xl">
      <Group align="flex-end">
        <TextInput 
          label="Serien-Muster" 
          value={seriesPattern} 
          onChange={(e) => handleSeriesChange(e.currentTarget.value)} 
          style={{ flex: 1 }} 
        />
        <Popover width={300} position="bottom" withArrow shadow="md">
          <Popover.Target><Button variant="subtle" size="sm" px="xs"><IconInfoCircle size={18} /></Button></Popover.Target>
          <Popover.Dropdown>{placeholderInfo}</Popover.Dropdown>
        </Popover>
      </Group>

      <Group align="flex-end">
        <TextInput 
          label="Film-Muster" 
          value={moviePattern} 
          onChange={(e) => handleMovieChange(e.currentTarget.value)} 
          style={{ flex: 1 }} 
        />
      </Group>

      <Box>
        <TextInput
          label="Zielordner"
          value={outputFolder}
          readOnly
          disabled={overwrite}
          rightSection={<Tooltip label="Ordner auswählen"><Button onClick={selectFolder} size="xs" disabled={overwrite}>...</Button></Tooltip>}
        />
      </Box>
      <Switch label="Original überschreiben" checked={overwrite} onChange={(e) => setOverwrite(e.currentTarget.checked)} />

      <Stack mt="md">
        {/* FIX: Nur noch ein einziger, sauberer Button für die gesamte Liste */}
        <Tooltip label="Alle geladenen Dateien verarbeiten und umbenennen">
          <Button
            leftSection={<IconFiles size={18} />}
            onClick={() => onSaveAll(seriesPattern, moviePattern)}
            disabled={files.length === 0}
            variant="filled"
            fullWidth
            size="md"
          >
            Alle Dateien verarbeiten
          </Button>
        </Tooltip>
      </Stack>
    </Stack>
  );
};

export default OutputSettings;