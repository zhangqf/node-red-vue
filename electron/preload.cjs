const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  onUpdateStatus: (cb) => ipcRenderer.on("update-status", (_e, status) => cb(status)),
  onUpdateProgress: (cb) => ipcRenderer.on("update-download-progress", (_e, pct) => cb(pct)),
  onUpdateDownloaded: (cb) => ipcRenderer.on("update-downloaded", (_e, version) => cb(version)),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  // 权限管理
  getAuthConfig: () => ipcRenderer.invoke("get-auth-config"),
  verifyAuthPassword: (password) => ipcRenderer.invoke("verify-auth-password", password),
  setAuthPassword: (oldPassword, newPassword) => ipcRenderer.invoke("set-auth-password", oldPassword, newPassword),
});
