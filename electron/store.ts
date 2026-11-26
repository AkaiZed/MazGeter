import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { AppSettings, DownloadTask } from './types';

interface StoreSchema {
  settings: AppSettings;
  mediaHistory: DownloadTask[];
}

function getDefaultSettings(): AppSettings {
  return {
    downloadDir: path.join(app.getPath('downloads'), 'MazGeter'),
    maxConcurrentDownloads: 5,
    aria2Split: 16,
    maxConnectionPerServer: 16,
    speedLimitKbps: 0,
    closeToTray: true,
    theme: 'dark',
  };
}

export class AppStore {
  private filePath: string;
  private data: StoreSchema;

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'mazgeter-store.json');
    this.data = this.load();
    this.ensureDownloadDir();
  }

  private ensureDownloadDir() {
    try {
      if (!fs.existsSync(this.data.settings.downloadDir)) {
        fs.mkdirSync(this.data.settings.downloadDir, { recursive: true });
      }
    } catch {
      // fallback to standard downloads folder if custom path unavailable
      this.data.settings.downloadDir = app.getPath('downloads');
    }
  }

  private load(): StoreSchema {
    const defaults: StoreSchema = {
      settings: getDefaultSettings(),
      mediaHistory: [],
    };
    try {
      if (!fs.existsSync(this.filePath)) {
        return defaults;
      }
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoreSchema>;
      return {
        settings: { ...defaults.settings, ...(parsed.settings || {}) },
        mediaHistory: Array.isArray(parsed.mediaHistory) ? parsed.mediaHistory : [],
      };
    } catch {
      return defaults;
    }
  }

  private save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[AppStore] save error:', err);
    }
  }

  getSettings(): AppSettings {
    return { ...this.data.settings };
  }

  updateSettings(partial: Partial<AppSettings>): AppSettings {
    this.data.settings = { ...this.data.settings, ...partial };
    this.ensureDownloadDir();
    this.save();
    return this.getSettings();
  }

  getMediaHistory(): DownloadTask[] {
    return [...this.data.mediaHistory];
  }

  upsertMediaHistory(task: DownloadTask) {
    const idx = this.data.mediaHistory.findIndex((t) => t.id === task.id);
    if (idx >= 0) {
      this.data.mediaHistory[idx] = task;
    } else {
      this.data.mediaHistory.unshift(task);
    }
    if (this.data.mediaHistory.length > 200) {
      this.data.mediaHistory = this.data.mediaHistory.slice(0, 200);
    }
    this.save();
  }

  removeMediaHistory(id: string) {
    this.data.mediaHistory = this.data.mediaHistory.filter((t) => t.id !== id);
    this.save();
  }

  clearMediaHistory() {
    this.data.mediaHistory = [];
    this.save();
  }
}
