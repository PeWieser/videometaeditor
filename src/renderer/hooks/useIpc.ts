import { useCallback } from 'react';

export const useIpc = () => {
  const getMetadata = useCallback(async (path: string) => window.electronAPI.getFileMetadata(path), []);
  const selectFiles = useCallback(async () => window.electronAPI.selectFiles(), []);
  const searchTMDB = useCallback(async (query: string, type: 'tv' | 'movie') => window.electronAPI.searchTMDB(query, type), []);
  const writeMetadata = useCallback(async (path: string, meta: any) => window.electronAPI.writeMetadata(path, meta), []);
  return { getMetadata, selectFiles, searchTMDB, writeMetadata };
};