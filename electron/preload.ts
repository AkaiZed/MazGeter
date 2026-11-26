import { contextBridge, ipcRenderer } from 'electron';
import type {
  AddAria2TaskPayload,
  AddMediaTaskPayload,
  AppSettings,
  BinaryStatus,
  DownloadTask,
  GlobalStats,
  MediaInfo,
  MediaToolPayload,
  MediaToolProgress,
} from './types';

const api = {
  // Window
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Settings & Binaries
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  updateSettings: (partial: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update', partial),
  getBinaryStatus: (): Promise<BinaryStatus> => ipcRenderer.invoke('binaries:status'),

  // Dialogs & Clipboard
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectFolder'),
  selectFile: (filters?: Array<{ name: string; extensions: string[] }>): Promise<string | null> =>
    ipcRenderer.invoke('dialog:selectFile', filters),
  readClipboard: (): Promise<string> => ipcRenderer.invoke('clipboard:read'),

  // Media Analysis & Downloads
  analyzeMedia: (url: string): Promise<MediaInfo> => ipcRenderer.invoke('media:analyze', url),
  extractWaveform: (audioUrl: string, bars?: number, filesize?: number | null): Promise<number[]> =>
    ipcRenderer.invoke('media:waveform', audioUrl, bars, filesize),
  addMediaTask: (payload: AddMediaTaskPayload): Promise<DownloadTask> =>
    ipcRenderer.invoke('task:addMedia', payload),
  addAria2Task: (payload: AddAria2TaskPayload): Promise<string> =>
    ipcRenderer.invoke('task:addAria2', payload),
  addTorrentTask: (filePath: string, dir?: string): Promise<string> =>
    ipcRenderer.invoke('task:addTorrent', filePath, dir),

  // Task Controls
  pauseTask: (id: string, engine: 'aria2' | 'yt-dlp'): Promise<void> =>
    ipcRenderer.invoke('task:pause', id, engine),
  resumeTask: (id: string, engine: 'aria2' | 'yt-dlp'): Promise<void> =>
    ipcRenderer.invoke('task:resume', id, engine),
  removeTask: (id: string, engine: 'aria2' | 'yt-dlp'): Promise<void> =>
    ipcRenderer.invoke('task:remove', id, engine),
  clearCompleted: (): Promise<void> => ipcRenderer.invoke('task:clearCompleted'),
  openFolder: (targetPath: string): Promise<void> => ipcRenderer.invoke('task:openFolder', targetPath),
  openFile: (filePath: string): Promise<void> => ipcRenderer.invoke('task:openFile', filePath),
  refreshTasks: (): Promise<void> => ipcRenderer.invoke('tasks:refresh'),

  // Events
  onTasksUpdate: (
    callback: (data: { tasks: DownloadTask[]; stats: GlobalStats }) => void
  ): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { tasks: DownloadTask[]; stats: GlobalStats }) =>
      callback(data);
    ipcRenderer.on('tasks:update', listener);
    return () => ipcRenderer.removeListener('tasks:update', listener);
  },

  // Media Tools (FFmpeg)
  runMediaTool: (payload: MediaToolPayload): Promise<string> =>
    ipcRenderer.invoke('tools:run', payload),
  onMediaToolProgress: (callback: (progress: MediaToolProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: MediaToolProgress) =>
      callback(progress);
    ipcRenderer.on('tools:progress', listener);
    return () => ipcRenderer.removeListener('tools:progress', listener);
  },
};

contextBridge.exposeInMainWorld('mazgeter', api);
