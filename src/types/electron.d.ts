export {};

// Electron erweitert das native File-Objekt um die path-Eigenschaft
interface File {
  /** Lokaler Dateipfad (Electron-spezifisch) */
  path?: string;
}

export interface SubtitleTrack {
  id: string;
  path?: string;
  isEmbedded?: boolean;
  streamIndex?: number;
  language: string;
  title: string;
  default: boolean;
  forced: boolean;
  format?: string;
  durationSec?: number;
  durationWarning?: string;
}

declare global {
  interface Window {
    electronAPI: {
      invoke?: (channel: string, ...args: any[]) => Promise<any>;
      openSubtitles: () => Promise<string[]>;
      selectFiles: () => Promise<string[]>;
      getFileMetadata: (filePath: string) => Promise<any>;
      writeMetadata: (filePath: string, metadata: any) => Promise<boolean>;
      batchWriteMetadata: (files: any[]) => Promise<boolean>;
      searchTMDB: (query: string, type: 'tv' | 'movie') => Promise<any[]>;
      getSeriesDetails: (id: number) => Promise<any>;
      getSeasonDetails: (seriesId: number, seasonNum: number) => Promise<any>;
      getMovieDetails: (id: number) => Promise<any>;
      getImages: (type: string, id: number, seasonNum?: number) => Promise<string[]>;
      getSetting: (key: string) => Promise<any>;
      setSetting: (key: string, value: any) => Promise<void>;
      selectOutputFolder: () => Promise<string | null>;
      processFiles: (options: {
        files: { path: string; metadata: any }[];
        outputFolder: string;
        namingPattern: string;
        overwrite: boolean;
      }) => Promise<boolean>;
      onProgress: (callback: (data: { current: number; total: number }) => void) => void;
      removeProgressListener: () => void;
      copyFileToTemp: (sourcePath: string) => Promise<string>;
      downloadImage: (url: string) => Promise<string>;
      getCredits: (type: string, id: number) => Promise<any>;
      getImageDataUrl: (filePath: string) => Promise<string>;
      extractCover: (filePath: string) => Promise<string | null>;
      onFilesDropped: (callback: (paths: string[]) => void) => void;
    };
  }
}