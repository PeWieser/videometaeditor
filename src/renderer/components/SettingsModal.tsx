import React, { useEffect, useState } from 'react';
import { 
  Modal, TextInput, Switch, Stack, Button, useMantineColorScheme, Group, 
  Tabs, Table, ActionIcon, Text, Badge 
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

interface Props {
  opened: boolean;
  onClose: () => void;
  overwrite: boolean;
  setOverwrite: (val: boolean) => void;
  patternSeparator: string;
  setPatternSeparator: (val: string) => void;
}

const SettingsModal: React.FC<Props> = ({ opened, onClose, overwrite, setOverwrite, patternSeparator, setPatternSeparator }) => {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const [apiKey, setApiKey] = useState('');
  const [gpu, setGpu] = useState(false);
  const [separator, setSeparator] = useState('');
  const [saved, setSaved] = useState(false);
  
  // Offline-State
  const [offlineItems, setOfflineItems] = useState<any[]>([]);
  const api = (window as any).electronAPI;

  const fetchOfflineList = async () => {
    try {
      const list = await api.getOfflineList();
      setOfflineItems(list);
    } catch (e) {}
  };

  useEffect(() => {
    if (opened) {
      api.getSetting('tmdbApiKey').then((v: any) => setApiKey(v || ''));
      api.getSetting('gpuEnabled').then((v: any) => setGpu(!!v));
      setSeparator(patternSeparator);
      fetchOfflineList();
    }
  }, [opened, patternSeparator]);

  const handleSave = async () => {
    await api.setSetting('tmdbApiKey', apiKey.trim());
    await api.setSetting('gpuEnabled', gpu);
    setPatternSeparator(separator);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDeleteItem = async (type: string, id: number) => {
    await api.deleteOfflineItem(type, id);
    fetchOfflineList();
  };

  const handleDeleteAll = async () => {
    if (window.confirm('Bist du sicher, dass du ALLE lokal gespeicherten Offline-Daten (inkl. Bilder) unwiderruflich löschen möchtest?')) {
      await api.deleteAllOffline();
      fetchOfflineList();
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Einstellungen" centered size="lg">
      <Tabs defaultValue="general">
        <Tabs.List mb="md">
          <Tabs.Tab value="general">Allgemein</Tabs.Tab>
          <Tabs.Tab value="offline">Offline Daten</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="general">
          <Stack>
            <TextInput
              label="TMDB API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.currentTarget.value)}
              placeholder="Dein API-Key"
              type="password"
            />
            
            <Switch
              label="Dark Mode"
              checked={colorScheme === 'dark'}
              onChange={() => toggleColorScheme()}
            />

            <Switch
              label="Originaldateien überschreiben (Vorsicht!)"
              description="Wenn deaktiviert, wird beim Speichern immer eine neue Datei erstellt."
              checked={overwrite}
              onChange={(e) => setOverwrite(e.currentTarget.checked)}
            />

            <Switch
              label="GPU-Beschleunigung (Hardware Accel)"
              description="Nutzt die Grafikkarte für FFmpeg Prozesse (kann CPU entlasten)."
              checked={gpu}
              onChange={(e) => setGpu(e.currentTarget.checked)}
            />

            <TextInput
              label="Segment-Trennzeichen (Regulärer Ausdruck)"
              description="Bestimmt, wie Dateinamen in Segmente zerlegt werden. Standard: \\s*-\\s*|\\s+ (Bindestrich oder Leerzeichen)"
              value={separator}
              onChange={(e) => setSeparator(e.currentTarget.value)}
              placeholder="z.B. \\s*-\\s*|\\s+"
            />

            <Group justify="flex-end" mt="md">
              <Button onClick={handleSave} color={saved ? 'green' : 'blue'}>
                {saved ? 'Gespeichert ✓' : 'Speichern'}
              </Button>
            </Group>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="offline">
          <Stack>
            <Text size="sm" c="dimmed">
              Hier kannst du alle Serien und Filme verwalten, die du für die Nutzung ohne Internetverbindung heruntergeladen hast.
            </Text>
            
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <Table striped highlightOnHover>
                <thead>
                  <tr>
                    <th>Typ</th>
                    <th>Titel</th>
                    <th>Jahr</th>
                    <th style={{ width: 60 }}>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {offlineItems.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <Text c="dimmed" ta="center" py="md">Noch keine Daten offline gespeichert.</Text>
                      </td>
                    </tr>
                  ) : (
                    offlineItems.map((item) => (
                      <tr key={`${item.type}-${item.id}`}>
                        <td>
                          <Badge color={item.type === 'tv' ? 'blue' : 'orange'} size="sm">
                            {item.type === 'tv' ? 'Serie' : 'Film'}
                          </Badge>
                        </td>
                        <td style={{ fontWeight: 500 }}>{item.name}</td>
                        <td>{item.year}</td>
                        <td>
                          <ActionIcon color="red" variant="subtle" onClick={() => handleDeleteItem(item.type, item.id)}>
                            <IconTrash size={16} />
                          </ActionIcon>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>

            {offlineItems.length > 0 && (
              <Group justify="flex-end" mt="md">
                <Button color="red" variant="outline" onClick={handleDeleteAll} leftSection={<IconTrash size={16} />}>
                  Alle Offline-Daten löschen
                </Button>
              </Group>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
};

export default SettingsModal;