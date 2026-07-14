export interface ElectronAPI {
  platform: string;
  onUpdateStatus: (cb: (status: string) => void) => void;
  onUpdateProgress: (cb: (pct: number) => void) => void;
  onUpdateDownloaded: (cb: (version: string) => void) => void;
  installUpdate: () => Promise<void>;
  // 权限管理
  getAuthConfig: () => Promise<{ hasPassword: boolean }>;
  verifyAuthPassword: (password: string) => Promise<boolean>;
  setAuthPassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
