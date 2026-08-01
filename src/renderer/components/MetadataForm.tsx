import React, { useEffect, useState, useRef } from 'react';
import { TextInput, Textarea, Grid, Image, Box, Button, Tooltip, Kbd, Text } from '@mantine/core';
import { IconPhoto } from '@tabler/icons-react';

interface Metadata {
  title?: string;
  artist?: string;
  year?: string;
  genre?: string;
  description?: string;
  show?: string;
  season?: string;
  episode?: string;
  episode_title?: string;
  coverPath?: string;
  coverUrl?: string;
  tmdbId?: number;
  tmdbType?: string;
}

interface Props {
  metadata: Metadata;
  onChange: (meta: Metadata) => void;
  onRequestCoverChange: () => void;
  onRequestTmdbSearch: (initial?: string) => void;
  selectionCount: number;
}

const MetadataForm: React.FC<Props> = ({
  metadata,
  onChange,
  onRequestCoverChange,
  onRequestTmdbSearch,
  selectionCount,
}) => {
  const [coverDataUrl, setCoverDataUrl] = useState('');
  const [titleFocused, setTitleFocused] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const api = (window as any).electronAPI;

  useEffect(() => {
    const hasCoverPath = metadata.coverPath && metadata.coverPath !== '[individuell]';
    const hasCoverUrl = metadata.coverUrl && metadata.coverUrl !== '[individuell]';

    if (!hasCoverPath && !hasCoverUrl) {
      setCoverDataUrl('');
      return;
    }

    (async () => {
      if (hasCoverPath) {
        try {
          const dataUrl = await api.getImageDataUrl(metadata.coverPath!);
          setCoverDataUrl(dataUrl);
        } catch {
          setCoverDataUrl('');
        }
      } else if (hasCoverUrl) {
        setCoverDataUrl(metadata.coverUrl!);
      }
    })();
  }, [metadata.coverPath, metadata.coverUrl]);

  const handleChange = (field: keyof Metadata, value: string) => {
    onChange({ ...metadata, [field]: value });
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const currentTitle = (e.target as HTMLInputElement).value.trim();
      onRequestTmdbSearch(currentTitle || undefined);
    }
  };

  return (
    <Grid>
      <Grid.Col span={6}>
        <Tooltip
          label={<span>Drücke <Kbd>Tab</Kbd> um die TMDB-Suche zu starten</span>}
          withArrow
          opened={titleFocused}
        >
          <TextInput
            ref={titleRef}
            label="Titel"
            value={metadata.title || ''}
            onChange={(e) => handleChange('title', e.currentTarget.value)}
            onKeyDown={handleTitleKeyDown}
            onFocus={() => setTitleFocused(true)}
            onBlur={() => setTitleFocused(false)}
          />
        </Tooltip>
        <TextInput label="Autor (Artist)" value={metadata.artist || ''} onChange={(e) => handleChange('artist', e.currentTarget.value)} mt="sm" />
        <TextInput label="Jahr" value={metadata.year || ''} onChange={(e) => handleChange('year', e.currentTarget.value)} mt="sm" />
        <TextInput label="Genre" value={metadata.genre || ''} onChange={(e) => handleChange('genre', e.currentTarget.value)} mt="sm" />
        <TextInput label="Serie" value={metadata.show || ''} onChange={(e) => handleChange('show', e.currentTarget.value)} mt="sm" />
        <TextInput label="Staffel" value={metadata.season || ''} onChange={(e) => handleChange('season', e.currentTarget.value)} mt="sm" />
        <TextInput label="Episode" value={metadata.episode || ''} onChange={(e) => handleChange('episode', e.currentTarget.value)} mt="sm" />
        <TextInput label="Episodentitel" value={metadata.episode_title || ''} onChange={(e) => handleChange('episode_title', e.currentTarget.value)} mt="sm" />
      </Grid.Col>

      <Grid.Col span={6}>
        <Box style={{ width: 180, height: 270, borderRadius: '8px', overflow: 'hidden', position: 'relative', margin: '0 auto' }}>
          {coverDataUrl ? (
            <Image src={coverDataUrl} alt="Cover" fit="cover" style={{ width: '100%', height: '100%' }} />
          ) : (
            <Box style={{ width: '100%', height: '100%', backgroundColor: '#dee2e6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}>
              {selectionCount > 1 && (metadata.coverPath === '[individuell]' || metadata.coverUrl === '[individuell]') ? (
                <Text size="sm" c="dimmed" ta="center">Unterschiedliche Cover ausgewählt</Text>
              ) : (
                <IconPhoto size={48} color="#adb5bd" />
              )}
            </Box>
          )}
        </Box>
        
        <Box style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          <Tooltip label={selectionCount === 1 ? 'Cover ändern' : 'Cover für alle ausgewählten Dateien ändern'}>
            <Button 
              variant="outline" 
              size="xs" 
              onClick={onRequestCoverChange} 
              disabled={selectionCount === 0}
            >
              Cover ändern
            </Button>
          </Tooltip>
        </Box>
        
        <Textarea label="Beschreibung" value={metadata.description || ''} onChange={(e) => handleChange('description', e.currentTarget.value)} mt="sm" minRows={6} />
      </Grid.Col>
    </Grid>
  );
};

export default MetadataForm;