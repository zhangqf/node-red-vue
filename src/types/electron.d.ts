export interface ElectronAPI {
  platform: string;
  onUpdateStatus: (cb: (status: string) => void) => void;
  onUpdateProgress: (cb: (pct: number) => void) => void;
  onUpdateDownloaded: (cb: (version: string) => void) => void;
  installUpdate: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
