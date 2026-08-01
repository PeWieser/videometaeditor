import React, { useEffect, useState } from 'react';
import { TextInput, Button, Stack, Text } from '@mantine/core';

const ApiKeyInput: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const key = await window.electronAPI.getSetting('tmdbApiKey');
      setApiKey(key || '');
      setSavedKey(key || '');
    })();
  }, []);

  const handleSave = async () => {
    await window.electronAPI.setSetting('tmdbApiKey', apiKey.trim());
    setSavedKey(apiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const unchanged = apiKey.trim() === savedKey.trim();

  return (
    <Stack>
      <TextInput
        label="TMDB API Key"
        value={apiKey}
        onChange={(e) => setApiKey(e.currentTarget.value)}
        placeholder="Dein API-Key"
        type="password"
      />
      <Button onClick={handleSave} disabled={unchanged}>
        {saved ? 'Gespeichert ✓' : 'Key speichern'}
      </Button>
    </Stack>
  );
};

export default ApiKeyInput;