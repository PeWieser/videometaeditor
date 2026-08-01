import React, { useState } from 'react';
import { Button, Stack, Text, Box, Group, ActionIcon, Tooltip } from '@mantine/core';
import { IconTrash, IconCircleFilled, IconPlus } from '@tabler/icons-react';
import { FileEntry } from '../App';

interface Props {
  files: FileEntry[];
  selected: number[];
  onSelectionChange: (indices: number[]) => void;
  onAddFiles: () => void;
  onRemoveFiles: (indices: number[]) => void;
  onRemoveAllFiles: () => void;
}

const statusColor: Record<string, string> = {
  unchanged: 'gray',
  modified: 'orange',
  saved: 'green',
};

const FileList: React.FC<Props> = ({
  files,
  selected,
  onSelectionChange,
  onAddFiles,
  onRemoveFiles,
  onRemoveAllFiles,
}) => {
  const [lastClicked, setLastClicked] = useState<number | null>(null);

  const handleClick = (index: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClicked !== null) {
      const start = Math.min(lastClicked, index);
      const end = Math.max(lastClicked, index);
      const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      onSelectionChange(range);
    } else if (e.ctrlKey || e.metaKey) {
      onSelectionChange(
        selected.includes(index)
          ? selected.filter((i) => i !== index)
          : [...selected, index]
      );
      setLastClicked(index);
    } else {
      onSelectionChange([index]);
      setLastClicked(index);
    }
  };

  return (
    <Stack>
      <Group grow>
        <Tooltip label="Dateien hinzufügen">
          <Button onClick={onAddFiles} size="sm" px="xs">
            <IconPlus size={18} />
          </Button>
        </Tooltip>
        <Tooltip label="Alle Dateien entfernen">
          <ActionIcon
            variant="light"
            color="red"
            size="lg"
            onClick={onRemoveAllFiles}
            disabled={files.length === 0}
          >
            <IconTrash size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Box style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <Stack gap={2}>
          {files.map((file, idx) => (
            <Box
              key={file.path}
              onClick={(e) => handleClick(idx, e)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: selected.includes(idx) ? '#e7f5ff' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
              onMouseEnter={(e) => {
                if (!selected.includes(idx)) {
                  e.currentTarget.style.backgroundColor = '#f1f3f5';
                }
              }}
              onMouseLeave={(e) => {
                if (!selected.includes(idx)) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <IconCircleFilled
                size={12}
                style={{ color: `var(--mantine-color-${statusColor[file.status]}-6)`, flexShrink: 0 }}
              />
              <Text size="sm" lineClamp={1} style={{ flex: 1 }}>
                {file.name}
              </Text>
              {selected.includes(idx) && (
                <ActionIcon
                  size="sm"
                  color="red"
                  variant="transparent"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFiles([idx]);
                  }}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              )}
            </Box>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
};

export default FileList;