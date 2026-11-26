import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  nativeImage,
  session,
  shell,
} from 'electron';
import fs from 'fs';
import path from 'path';
import { Aria2Engine } from './aria2Engine';
import { getBinaryStatus } from './binResolver';
import { MediaEngine } from './mediaEngine';
import { AppStore } from './store';
import {
  AddAria2TaskPayload,
  AddMediaTaskPayload,
  AppSettings,
  DownloadTask,
  GlobalStats,
  MediaToolPayload,
} from './types';

let mainWindow: BrowserWindow | null = null;
let pollTimer: NodeJS.Timeout | null = null;

app.setName('MazGeter');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.akaized.mazgeter');
}

// Enforce Single Instance: only 1 MazGeter session at a time
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

const store = new AppStore();
const aria2 = new Aria2Engine();
const media = new MediaEngine();

async function broadcastTasks() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const ariaTasks = await aria2.getAllTasks();
  const activeMedia = media.getActiveTasks();
  const historyMedia = store.getMediaHistory();

  // Merge without duplicating active media ids
  const activeIds = new Set(activeMedia.map((t) => t.id));
  const merged: DownloadTask[] = [
    ...activeMedia,
    ...ariaTasks,
    ...historyMedia.filter((h) => !activeIds.has(h.id)),
  ];

  const stats: GlobalStats = {
    downloadSpeed: merged.reduce((acc, t) => acc + (t.status === 'active' ? t.downloadSpeed : 0), 0),
    uploadSpeed: merged.reduce((acc, t) => acc + (t.status === 'active' ? t.uploadSpeed : 0), 0),
    activeCount: merged.filter((t) => t.status === 'active').length,
    waitingCount: merged.filter((t) => t.status === 'waiting' || t.status === 'paused').length,
    stoppedCount: merged.filter((t) => t.status === 'complete' || t.status === 'error').length,
  };

  mainWindow.webContents.send('tasks:update', { tasks: merged, stats });
}

function resolveAppIcon(): Electron.NativeImage | undefined {
  const candidates = [
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(process.resourcesPath, 'icon.png'),
    path.join(__dirname, '../resources/icon.ico'),
    path.join(__dirname, '../resources/icon.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) return img;
    }
  }
  return undefined;
}

function createWindow() {
  const appIcon = resolveAppIcon();

  mainWindow = new BrowserWindow({
    width: 1220,
    height: 780,
    minWidth: 980,
    minHeight: 640,
    show: false,
    frame: false,
    icon: appIcon,
    backgroundColor: '#0b0e14',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || (!app.isPackaged ? 'http://localhost:5173' : '');
  if (devUrl && !fs.existsSync(path.join(__dirname, '../dist/index.html'))) {
    mainWindow.loadURL(devUrl);
  } else if (!app.isPackaged && process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
}

function registerIpc() {
  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  // Settings & Binaries
  ipcMain.handle('settings:get', () => store.getSettings());
  ipcMain.handle('settings:update', async (_e, partial: Partial<AppSettings>) => {
    const next = store.updateSettings(partial);
    await aria2.applySettings(next);
    return next;
  });
  ipcMain.handle('binaries:status', () => getBinaryStatus());

  // Dialogs & Clipboard
  ipcMain.handle('dialog:selectFolder', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    });
    return res.canceled ? null : res.filePaths[0];
  });

  ipcMain.handle('dialog:selectFile', async (_e, filters?: Electron.FileFilter[]) => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters,
    });
    return res.canceled ? null : res.filePaths[0];
  });

  ipcMain.handle('clipboard:read', () => clipboard.readText());

  // Media analysis (XGetter)
  ipcMain.handle('media:analyze', async (_e, url: string) => {
    return media.analyzeUrl(url);
  });

  ipcMain.handle('media:waveform', async (_e, audioUrl: string, bars?: number, filesize?: number | null) => {
    return media.extractWaveform(audioUrl, bars, filesize);
  });

  // Add tasks
  ipcMain.handle('task:addMedia', async (_e, payload: AddMediaTaskPayload) => {
    const settings = store.getSettings();
    const task = media.startDownload(
      payload,
      settings.downloadDir,
      () => {
        broadcastTasks();
      },
      (completedTask) => {
        store.upsertMediaHistory(completedTask);
        broadcastTasks();
      }
    );
    await broadcastTasks();
    return task;
  });

  ipcMain.handle('task:addAria2', async (_e, payload: AddAria2TaskPayload) => {
    const settings = store.getSettings();
    const gid = await aria2.addUri(payload, settings);
    await broadcastTasks();
    return gid;
  });

  ipcMain.handle('task:addTorrent', async (_e, filePath: string, dir?: string) => {
    const settings = store.getSettings();
    const gid = await aria2.addTorrent(filePath, dir || settings.downloadDir);
    await broadcastTasks();
    return gid;
  });

  // Task actions
  ipcMain.handle('task:pause', async (_e, id: string, engine: 'aria2' | 'yt-dlp') => {
    if (engine === 'aria2') {
      await aria2.pause(id);
    } else {
      media.cancelTask(id);
    }
    await broadcastTasks();
  });

  ipcMain.handle('task:resume', async (_e, id: string, engine: 'aria2' | 'yt-dlp') => {
    if (engine === 'aria2') {
      await aria2.resume(id);
    }
    await broadcastTasks();
  });

  ipcMain.handle('task:remove', async (_e, id: string, engine: 'aria2' | 'yt-dlp') => {
    if (engine === 'aria2') {
      await aria2.remove(id);
    } else {
      media.cancelTask(id);
      store.removeMediaHistory(id);
    }
    await broadcastTasks();
  });

  ipcMain.handle('task:clearCompleted', async () => {
    await aria2.clearCompleted();
    store.clearMediaHistory();
    await broadcastTasks();
  });

  ipcMain.handle('task:openFolder', async (_e, targetPath: string) => {
    if (!targetPath) return;
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
      shell.showItemInFolder(targetPath);
    } else if (fs.existsSync(targetPath)) {
      await shell.openPath(targetPath);
    }
  });

  ipcMain.handle('task:openFile', async (_e, filePath: string) => {
    if (filePath && fs.existsSync(filePath)) {
      await shell.openPath(filePath);
    }
  });

  ipcMain.handle('tasks:refresh', async () => {
    await broadcastTasks();
  });

  // FFmpeg local media tools
  ipcMain.handle('tools:run', async (_e, payload: MediaToolPayload) => {
    const settings = store.getSettings();
    return media.runFfmpegTool(payload, settings.downloadDir, (progress) => {
      mainWindow?.webContents.send('tools:progress', progress);
    });
  });
}

if (gotTheLock) {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // Allow Web Audio API GainNode (0-200% volume boost) on remote media preview streams
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const headers = { ...(details.responseHeaders || {}) };
      const hasAcao = Object.keys(headers).some((k) => k.toLowerCase() === 'access-control-allow-origin');
      if (!hasAcao && details.url.startsWith('http') && !details.url.startsWith('http://127.0.0.1')) {
        headers['Access-Control-Allow-Origin'] = ['*'];
      }
      callback({ responseHeaders: headers });
    });

    registerIpc();
    await aria2.start(store.getSettings());
    createWindow();

    pollTimer = setInterval(() => {
      broadcastTasks().catch(() => {});
    }, 1000);
  });
}

app.on('before-quit', () => {
  if (pollTimer) clearInterval(pollTimer);
  media.stopAll();
  aria2.stop();
});

app.on('window-all-closed', () => {
  app.quit();
});
