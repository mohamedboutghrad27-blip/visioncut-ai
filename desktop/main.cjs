/**
 * VisionCut AI — desktop shell (Electron main process).
 *
 * Loads the VisionCut web app in a native window with a desktop menu,
 * external-link handling, native save dialogs for exports and a
 * single-instance lock.
 *
 * The target URL defaults to the production deployment and can be
 * overridden for local development:
 *   VISIONCUT_URL=http://localhost:3000 npm start
 */
const { app, BrowserWindow, Menu, shell, dialog, session, ipcMain } = require("electron");
const path = require("path");

const APP_URL = process.env.VISIONCUT_URL || "https://visioncut-ai-mu.vercel.app";
const ORIGIN = new URL(APP_URL).origin;

let mainWindow = null;

// One instance only — a second launch focuses the existing window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: "#09090b",
    title: "VisionCut AI",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.loadURL(APP_URL);
  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Keep navigation inside the app origin; anything external opens in the
  // user's default browser (docs, socials...).
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(ORIGIN)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(ORIGIN)) {
      mainWindow.loadURL(url);
    } else {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Exports and media downloads go through a native Save dialog.
  mainWindow.webContents.session.on("will-download", (event, item) => {
    const save = dialog.showSaveDialog(mainWindow, { defaultPath: item.getFilename() });
    save
      .then(({ canceled, filePath }) => {
        if (canceled || !filePath) {
          event.preventDefault();
        } else {
          item.setSavePath(filePath);
        }
      })
      .catch(() => event.preventDefault());
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    {
      label: "File",
      submenu: [
        {
          label: "Dashboard",
          accelerator: "CmdOrCtrl+1",
          click: () => mainWindow && mainWindow.webContents.executeJavaScript("window.location.hash = '#/dashboard'"),
        },
        {
          label: "New Project",
          accelerator: "CmdOrCtrl+N",
          click: () => mainWindow && mainWindow.webContents.executeJavaScript("window.location.hash = '#/dashboard'"),
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "resetZoom" },
        { type: "separator" },
        { role: "togglefullscreen" },
        { role: "toggleDevTools" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: "VisionCut AI Website",
          click: () => shell.openExternal("https://visioncut-ai-mu.vercel.app"),
        },
        { type: "separator" },
        {
          label: "Privacy Policy",
          click: () => shell.openExternal(`${ORIGIN}/#/privacy`),
        },
        {
          label: "Terms of Service",
          click: () => shell.openExternal(`${ORIGIN}/#/terms`),
        },
        {
          label: "Support Email",
          click: () => shell.openExternal("mailto:support@visioncut.ai"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.setAppUserModelId("ai.visioncut.app");

app.whenReady().then(() => {
  // Block intrusive permission prompts (the editor needs none).
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "clipboard-sanitized-access");
  });

  ipcMain.handle("visioncut:info", () => ({
    name: "VisionCut AI Desktop",
    version: app.getVersion(),
    url: APP_URL,
    platform: process.platform,
  }));

  buildMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
