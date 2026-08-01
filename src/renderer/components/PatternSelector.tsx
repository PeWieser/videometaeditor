import React, { useState, useMemo, useEffect } from 'react';
import { Paper, Group, Button, Text, Popover, Checkbox, Stack, TextInput, Badge } from '@mantine/core';
import { FileEntry } from '../App';

export interface PatternConfig {
  titleText: string;
  seasonText: string;
  episodeText: string;
  titleIndices: number[];
  seasonIndices: number[];
  episodeIndices: number[];
}

interface Props {
  files: FileEntry[];
  pattern: PatternConfig | null;
  patternSeparator?: string;
  onChange: (newMetaList: any[], newPattern: PatternConfig) => void;
}

const PatternSelector: React.FC<Props> = ({ files, pattern, patternSeparator, onChange }) => {
  const splitRegex = useMemo(() => {
    try {
      return new RegExp(patternSeparator || '\\s*-\\s*|\\s+');
    } catch (e) {
      return /\s*-\s*|\s+/;
    }
  }, [patternSeparator]);

  const segments = useMemo(() => {
    if (files.length === 0) return [];
    const name = files[0].name.replace(/\.\w+$/, '');
    return name
      .split(splitRegex)
      .flatMap(part => {
        const sub = part.match(/^([Ss]\d{1,3})([Ee]\d{1,3})$/);
        if (sub) return [sub[1], sub[2]];

        const seriesMatch = part.match(/^(Series|Staffel|S)\.?(\d+)$/i);
        if (seriesMatch) return [seriesMatch[2]];

        return [part.replace(/\.$/, '')];
      })
      .filter(Boolean);
  }, [files, splitRegex]);

  // Input states
  const [titleText, setTitleText] = useState('');
  const [seasonText, setSeasonText] = useState('');
  const [episodeText, setEpisodeText] = useState('');

  // Selected segment indices states
  const [titleIndices, setTitleIndices] = useState<number[]>([]);
  const [seasonIndices, setSeasonIndices] = useState<number[]>([]);
  const [episodeIndices, setEpisodeIndices] = useState<number[]>([]);

  // Popover open states
  const [titleOpened, setTitleOpened] = useState(false);
  const [seasonOpened, setSeasonOpened] = useState(false);
  const [episodeOpened, setEpisodeOpened] = useState(false);

  // Sync state when pattern or segments change
  useEffect(() => {
    if (pattern) {
      if (pattern.titleText !== undefined) setTitleText(pattern.titleText);
      if (pattern.seasonText !== undefined) setSeasonText(pattern.seasonText);
      if (pattern.episodeText !== undefined) setEpisodeText(pattern.episodeText);

      if (pattern.titleIndices) setTitleIndices(pattern.titleIndices);
      if (pattern.seasonIndices) setSeasonIndices(pattern.seasonIndices);
      if (pattern.episodeIndices) setEpisodeIndices(pattern.episodeIndices);
    } else if (segments.length > 0) {
      const tIdx = [0];
      const sIdx = segments.length >= 2 ? [1] : [];
      const eIdx = segments.length >= 3 ? [2] : [];

      setTitleIndices(tIdx);
      setSeasonIndices(sIdx);
      setEpisodeIndices(eIdx);

      const rawTitle = tIdx.map(i => segments[i]).join(' ');
      const cleanTitle = rawTitle.replace(/\s+\d+$/, '').trim();
      setTitleText(cleanTitle || rawTitle);

      setSeasonText(sIdx.map(i => segments[i]).join(' ').replace(/\D/g, '').replace(/^0+/, ''));
      setEpisodeText(eIdx.map(i => segments[i]).join(' ').replace(/\D/g, '').replace(/^0+/, ''));
    }
  }, [pattern, segments]);

  const applyPattern = () => {
    if (!titleText.trim()) {
      alert("Bitte gib einen Serientitel ein oder wähle Segmente dafür aus!");
      return;
    }

    if (episodeIndices.length === 0 && !episodeText.trim()) {
      alert("Hinweis: Es wurde kein Episoden-Segment ausgewählt. Die Episodennummern werden nicht automatisch ausgefüllt.");
    }

    const segmentTitleStr = titleIndices.map(i => segments[i]).join(' ');

    const updated = files.map((file) => {
      const name = file.name.replace(/\.\w+$/, '');
      const parts = name
        .split(splitRegex)
        .flatMap(part => {
          const sub = part.match(/^([Ss]\d{1,3})([Ee]\d{1,3})$/);
          if (sub) return [sub[1], sub[2]];
          const seriesMatch = part.match(/^(Series|Staffel|S)\.?(\d+)$/i);
          if (seriesMatch) return [seriesMatch[2]];
          return [part.replace(/\.$/, '')];
        })
        .filter(Boolean);

      // 1. Serientitel: Falls manuell editiert, manuellen Text nutzen; sonst Segmente
      let showVal = titleText.trim();
      if (!showVal && titleIndices.length > 0) {
        showVal = titleIndices.map(idx => parts[idx] || '').filter(Boolean).join(' ');
      } else if (titleIndices.length > 0 && segmentTitleStr && titleText === segmentTitleStr) {
        showVal = titleIndices.map(idx => parts[idx] || '').filter(Boolean).join(' ');
      }

      // 2. Staffel: Falls Indizes gewählt, pro Datei aus parts[idx] extrahieren; sonst manuellen Text nutzen
      let seasonVal = '';
      if (seasonIndices.length > 0) {
        seasonVal = seasonIndices.map(idx => parts[idx] || '').filter(Boolean).join(' ').replace(/\D/g, '').replace(/^0+/, '');
      } else {
        seasonVal = seasonText.trim();
      }

      // 3. Episode: Falls Indizes gewählt, PRO DATEI aus parts[idx] extrahieren; sonst manuellen Text nutzen
      let episodeVal = '';
      if (episodeIndices.length > 0) {
        episodeVal = episodeIndices.map(idx => parts[idx] || '').filter(Boolean).join(' ').replace(/\D/g, '').replace(/^0+/, '');
      } else {
        episodeVal = episodeText.trim();
      }

      return {
        ...file.metadata,
        show: showVal || file.metadata.show,
        season: seasonVal !== '' ? seasonVal : file.metadata.season || '',
        episode: episodeVal !== '' ? episodeVal : file.metadata.episode || '',
      };
    });

    onChange(updated, {
      titleText: titleText.trim(),
      seasonText: seasonText.trim(),
      episodeText: episodeText.trim(),
      titleIndices,
      seasonIndices,
      episodeIndices,
    });
  };

  return (
    <Paper withBorder p="md" mb="md">
      <Text size="sm" fw={500} mb="xs">Namensmuster definieren (Wähle Segmente aus oder trage Werte manuell ein)</Text>
      
      {segments.length > 0 && (
        <Group gap="xs" mb="sm" wrap="wrap">
          <Text size="xs" c="dimmed">Segmente aus erstem Dateinamen:</Text>
          {segments.map((seg, idx) => (
            <Badge key={idx} variant="outline" size="sm">{idx + 1}: {seg}</Badge>
          ))}
        </Group>
      )}

      <Group grow align="flex-end" mb="md">
        {/* Titel input */}
        <Popover opened={titleOpened} onChange={setTitleOpened} position="bottom" width="target" trapFocus={false} closeOnEscape closeOnClickOutside>
          <Popover.Target>
            <TextInput
              label="Serientitel"
              value={titleText}
              onChange={(e) => {
                setTitleText(e.currentTarget.value);
              }}
              onFocus={() => {
                setTitleOpened(true);
                setSeasonOpened(false);
                setEpisodeOpened(false);
              }}
              placeholder="Segmente wählen oder manuell eingeben..."
            />
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="xs" style={{ maxHeight: 200, overflowY: 'auto' }}>
              {segments.length === 0 ? (
                <Text size="xs" c="dimmed">Keine Segmente gefunden</Text>
              ) : (
                segments.map((seg, idx) => (
                  <Checkbox
                    key={idx}
                    label={`${idx + 1}. ${seg}`}
                    checked={titleIndices.includes(idx)}
                    onChange={(e) => {
                      const checked = e.currentTarget.checked;
                      const newIndices = checked
                        ? [...titleIndices, idx].sort((a, b) => a - b)
                        : titleIndices.filter(i => i !== idx);
                      setTitleIndices(newIndices);
                      setTitleText(newIndices.map(i => segments[i]).join(' '));
                    }}
                  />
                ))
              )}
            </Stack>
          </Popover.Dropdown>
        </Popover>

        {/* Staffel input */}
        <Popover opened={seasonOpened} onChange={setSeasonOpened} position="bottom" width="target" trapFocus={false} closeOnEscape closeOnClickOutside>
          <Popover.Target>
            <TextInput
              label="Staffel"
              value={seasonText}
              onChange={(e) => {
                setSeasonText(e.currentTarget.value);
              }}
              onFocus={() => {
                setSeasonOpened(true);
                setTitleOpened(false);
                setEpisodeOpened(false);
              }}
              placeholder="Segmente wählen oder manuell eingeben..."
            />
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="xs" style={{ maxHeight: 200, overflowY: 'auto' }}>
              {segments.length === 0 ? (
                <Text size="xs" c="dimmed">Keine Segmente gefunden</Text>
              ) : (
                segments.map((seg, idx) => (
                  <Checkbox
                    key={idx}
                    label={`${idx + 1}. ${seg}`}
                    checked={seasonIndices.includes(idx)}
                    onChange={(e) => {
                      const checked = e.currentTarget.checked;
                      const newIndices = checked
                        ? [...seasonIndices, idx].sort((a, b) => a - b)
                        : seasonIndices.filter(i => i !== idx);
                      setSeasonIndices(newIndices);
                      const rawVal = newIndices.map(i => segments[i]).join(' ');
                      setSeasonText(rawVal.replace(/\D/g, '').replace(/^0+/, ''));
                    }}
                  />
                ))
              )}
            </Stack>
          </Popover.Dropdown>
        </Popover>

        {/* Episode input */}
        <Popover opened={episodeOpened} onChange={setEpisodeOpened} position="bottom" width="target" trapFocus={false} closeOnEscape closeOnClickOutside>
          <Popover.Target>
            <TextInput
              label="Episode"
              value={episodeText}
              onChange={(e) => {
                setEpisodeText(e.currentTarget.value);
              }}
              onFocus={() => {
                setEpisodeOpened(true);
                setTitleOpened(false);
                setSeasonOpened(false);
              }}
              placeholder="Segmente wählen oder manuell eingeben..."
            />
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="xs" style={{ maxHeight: 200, overflowY: 'auto' }}>
              {segments.length === 0 ? (
                <Text size="xs" c="dimmed">Keine Segmente gefunden</Text>
              ) : (
                segments.map((seg, idx) => (
                  <Checkbox
                    key={idx}
                    label={`${idx + 1}. ${seg}`}
                    checked={episodeIndices.includes(idx)}
                    onChange={(e) => {
                      const checked = e.currentTarget.checked;
                      const newIndices = checked
                        ? [...episodeIndices, idx].sort((a, b) => a - b)
                        : episodeIndices.filter(i => i !== idx);
                      setEpisodeIndices(newIndices);
                      const rawVal = newIndices.map(i => segments[i]).join(' ');
                      setEpisodeText(rawVal.replace(/\D/g, '').replace(/^0+/, ''));
                    }}
                  />
                ))
              )}
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Group>

      <Button onClick={applyPattern} size="xs">Muster anwenden</Button>
    </Paper>
  );
};

export default PatternSelector;