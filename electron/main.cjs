const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const RED = require("node-red");

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
    // Copy data/ from read-only Resources to writable userData on every launch,
    // so re-packaged db files always take effect.
    const srcData = path.join(srcNr, "data");
    const destData = path.join(destNr, "data");
    fs.mkdirSync(destData, { recursive: true });
    if (fs.existsSync(srcData)) {
      for (const file of fs.readdirSync(srcData)) {
        const src = path.join(srcData, file);
        const dest = path.join(destData, file);
        if (fs.statSync(src).isFile()) {
          fs.copyFileSync(src, dest);
        }
      }
    }

    // Point flowFile and rootPath to writable copy
    nrSettings.flowFile = destFlow;
    nrSettings.functionGlobalContext.rootPath = destNr;

    // Set CWD to userData/nr so ./data/device.db resolves to writable copy
    process.chdir(destNr);
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
    icon:
      process.env.NODE_ENV === "development"
        ? path.join(__dirname, "../build/icon.png")
        : path.join(process.resourcesPath, "build/icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
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
