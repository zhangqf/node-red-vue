const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const http = require("http");
const express = require("express");
const RED = require("node-red");
const { autoUpdater } = require("electron-updater");

const isDev = process.env.NODE_ENV === "development";

let nrServer;
let mainWindow;

async function shutdownNR() {
  if (nrServer) {
    try {
      await RED.stop();
    } catch (e) {
      /* ignore */
    }
    try {
      await new Promise((resolve) => {
        nrServer.close(() => resolve());
        setTimeout(resolve, 1000);
      });
    } catch (e) {
      /* ignore */
    }
    nrServer = null;
  }
}

async function startNodeRED() {
  const nrSettings = require("../nr/settings.cjs");

  const userDir = isDev
    ? path.join(__dirname, "..", ".node-red-runtime")
    : path.join(app.getPath("userData"), ".node-red-runtime");
  nrSettings.userDir = userDir;

  if (!isDev) {
    // Copy flows.json and data/ from read-only Resources to writable userData on first launch
    const srcNr = path.join(process.resourcesPath, "nr");
    const destNr = path.join(app.getPath("userData"), "nr");
    if (!fs.existsSync(destNr)) {
      fs.mkdirSync(destNr, { recursive: true });
    }
    // Copy flows.json
    const srcFlow = path.join(srcNr, "flows.json");
    const destFlow = path.join(destNr, "flows.json");
    if (fs.existsSync(srcFlow) && !fs.existsSync(destFlow)) {
      fs.copyFileSync(srcFlow, destFlow);
    }
    // Copy data/ from read-only Resources to writable userData only on first launch
    const srcData = path.join(srcNr, "data");
    const destData = path.join(destNr, "data");
    fs.mkdirSync(destData, { recursive: true });
    if (fs.existsSync(srcData)) {
      for (const file of fs.readdirSync(srcData)) {
        const src = path.join(srcData, file);
        const dest = path.join(destData, file);
        if (fs.statSync(src).isFile() && !fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
        }
      }
    }

    // Point flowFile and rootPath to writable copy
    nrSettings.flowFile = destFlow;
    nrSettings.functionGlobalContext.rootPath = destNr;

    // Set CWD to userData/nr so ./data/device.db resolves to writable copy
    process.chdir(destNr);
  } else {
    // Dev: also chdir to nr/ so ./data/device.db resolves to nr/data/device.db
    process.chdir(path.join(__dirname, "..", "nr"));
  }

  const expressApp = express();
  nrServer = http.createServer(expressApp);
  nrServer.on("listening", () => {
    nrServer.setTimeout(0);
  });

  await RED.init(nrServer, nrSettings);
  expressApp.use(nrSettings.httpAdminRoot, RED.httpAdmin);
  expressApp.use(nrSettings.httpNodeRoot, RED.httpNode);

  return new Promise((resolve, reject) => {
    nrServer.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${nrSettings.uiPort} is already in use. Close any running instance of the app and try again.`,
          ),
        );
      } else {
        reject(err);
      }
    });
    nrServer.listen(nrSettings.uiPort, "127.0.0.1", () => {
      RED.start()
        .then(() => {
          console.log(`[Node-RED] started on port ${nrSettings.uiPort}`);
          resolve();
        })
        .catch(reject);
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    fullscreen: true,
    icon: path.join(__dirname, "../png/512x512.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // F12 切换 DevTools
  mainWindow.webContents.on("before-input-event", (_e, input) => {
    if (input.key === "F12" && input.type === "keyDown") {
      mainWindow.webContents.toggleDevTools();
    }
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5174");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(async () => {
    try {
      await startNodeRED();
      createWindow();

      // ---- 自动更新 ----
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;

      autoUpdater.on("checking-for-update", () => {
        console.log("[autoUpdater] 正在检查更新...");
      });
      autoUpdater.on("update-available", (info) => {
        console.log(`[autoUpdater] 发现新版本: ${info.version}`);
        mainWindow?.webContents.send("update-status", "downloading");
      });
      autoUpdater.on("update-not-available", () => {
        console.log("[autoUpdater] 当前已是最新版本");
        mainWindow?.webContents.send("update-status", "up-to-date");
      });
      autoUpdater.on("download-progress", (progress) => {
        const mb = (progress.transferred / 1024 / 1024).toFixed(1);
        const totalMb = (progress.total / 1024 / 1024).toFixed(1);
        const speed = (progress.bytesPerSecond / 1024).toFixed(1);
        console.log(
          `[autoUpdater] 下载: ${progress.percent.toFixed(1)}% (${mb}MB / ${totalMb}MB, ${speed} KB/s)`,
        );
        mainWindow?.webContents.send("update-download-progress", {
          percent: progress.percent,
          transferred: progress.transferred,
          total: progress.total,
          bytesPerSecond: progress.bytesPerSecond,
        });
      });
      autoUpdater.on("update-downloaded", (info) => {
        console.log(`[autoUpdater] 下载完成: v${info.version}`);
        mainWindow?.webContents.send("update-downloaded", info.version);
      });
      autoUpdater.on("error", (err) => {
        console.error("[autoUpdater] 错误:", err.message);
        mainWindow?.webContents.send("update-error", err.message);
      });

      try {
        autoUpdater.checkForUpdates();
      } catch (e) {
        console.warn("Update check skipped (dev mode):", e.message);
      }

      // IPC：renderer 请求立即安装更新
      ipcMain.handle("install-update", () => {
        autoUpdater.quitAndInstall();
      });

      // ---- 权限管理 ----
      const DEFAULT_PASSWORD = "admin888";
      const authFilePath = path.join(app.getPath("userData"), "auth.json");

      function hashPassword(pwd) {
        return crypto.createHash("sha256").update(pwd).digest("hex");
      }

      function getAuthConfig() {
        try {
          if (fs.existsSync(authFilePath)) {
            return JSON.parse(fs.readFileSync(authFilePath, "utf8"));
          }
        } catch (e) {
          console.error("[auth] 读取 auth.json 失败:", e.message);
        }
        return null;
      }

      ipcMain.handle("get-auth-config", () => {
        const config = getAuthConfig();
        return { hasPassword: config != null };
      });

      ipcMain.handle("verify-auth-password", (_e, password) => {
        const config = getAuthConfig();
        const storedHash = config?.passwordHash;
        const validHash = storedHash || hashPassword(DEFAULT_PASSWORD);
        return hashPassword(password) === validHash;
      });

      ipcMain.handle("set-auth-password", (_e, oldPassword, newPassword) => {
        const config = getAuthConfig();
        const storedHash = config?.passwordHash;
        const validHash = storedHash || hashPassword(DEFAULT_PASSWORD);
        if (hashPassword(oldPassword) !== validHash) {
          return { success: false, error: "原密码错误" };
        }
        try {
          fs.writeFileSync(
            authFilePath,
            JSON.stringify({ passwordHash: hashPassword(newPassword) }, null, 2),
            "utf8",
          );
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      });
    } catch (err) {
      dialog.showErrorBox("Startup Error", err.message);
      await shutdownNR();
      app.exit(1);
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", async (event) => {
  event.preventDefault();
  await shutdownNR();
  app.exit();
});

// Ensure cleanup on crash
process.on("uncaughtException", async (err) => {
  console.error("Uncaught exception:", err);
  await shutdownNR();
  app.exit(1);
});
