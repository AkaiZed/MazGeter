export type TaskEngine = 'aria2' | 'yt-dlp';

export type TaskStatus =
  | 'active'
  | 'waiting'
  | 'paused'
  | 'complete'
  | 'error'
  | 'removed';

export interface DownloadTask {
  id: string;
  engine: TaskEngine;
  name: string;
  url: string;
  status: TaskStatus;
  totalLength: number;
  completedLength: number;
  downloadSpeed: number;
  uploadSpeed: number;
  progress: number;
  eta: string;
  dir: string;
  filePath?: string;
  thumbnail?: string;
  formatLabel?: string;
  connections?: number;
  errorMessage?: string;
  createdAt: number;
}

export interface GlobalStats {
  downloadSpeed: number;
  uploadSpeed: number;
  activeCount: number;
  waitingCount: number;
  stoppedCount: number;
}

export interface QualityOption {
  value: string;
  label: string;
  ext?: string;
  filesize?: number | null;
}

export interface MediaInfo {
  id: string;
  title: string;
  thumbnail: string | null;
  duration: number | null;
  durationText: string;
  uploader: string;
  webpageUrl: string;
  extractor: string;
  isPlaylist: boolean;
  playlistCount?: number;
  audioStreamUrl?: string | null;
  waveformAudioUrl?: string | null;
  waveformFilesize?: number | null;
  videoStreamUrl?: string | null;
  videoHasAudio?: boolean;
  videoQualities: QualityOption[];
  audioQualities: QualityOption[];
  subtitles: string[];
}

export interface AddMediaTaskPayload {
  url: string;
  title?: string;
  thumbnail?: string | null;
  format: 'mp4' | 'mp3' | 'mkv' | 'm4a' | 'wav';
  quality: string;
  dir?: string;
  downloadSubtitles?: boolean;
  subtitleLang?: string;
  trimStart?: string;
  trimEnd?: string;
  volumePercent?: number;
  isPlaylist?: boolean;
}

export interface AddAria2TaskPayload {
  urls: string[];
  dir?: string;
  out?: string;
  split?: number;
  maxConnectionPerServer?: number;
  userAgent?: string;
  referer?: string;
}

export interface AppSettings {
  downloadDir: string;
  maxConcurrentDownloads: number;
  aria2Split: number;
  maxConnectionPerServer: number;
  speedLimitKbps: number;
  closeToTray: boolean;
  theme: 'dark' | 'light';
}

export interface BinaryInfo {
  name: string;
  path: string | null;
  available: boolean;
  version?: string;
}

export interface BinaryStatus {
  aria2c: BinaryInfo;
  ytDlp: BinaryInfo;
  ffmpeg: BinaryInfo;
  ffprobe: BinaryInfo;
}

export interface MediaToolPayload {
  inputPath: string;
  outputDir?: string;
  action: 'convert' | 'extract-audio' | 'trim';
  targetFormat: 'mp4' | 'mp3' | 'mkv' | 'webm' | 'wav' | 'm4a';
  trimStart?: string;
  trimEnd?: string;
  audioBitrate?: string;
}

export interface MediaToolProgress {
  jobId: string;
  status: 'running' | 'complete' | 'error';
  percent: number;
  stage: string;
  outputPath?: string;
  error?: string;
}

export type NavTab = 'active' | 'waiting' | 'stopped' | 'tools' | 'settings';

export interface MazGeterAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>;
  getBinaryStatus: () => Promise<BinaryStatus>;
  selectFolder: () => Promise<string | null>;
  selectFile: (filters?: Array<{ name: string; extensions: string[] }>) => Promise<string | null>;
  readClipboard: () => Promise<string>;
  analyzeMedia: (url: string) => Promise<MediaInfo>;
  extractWaveform: (audioUrl: string, bars?: number, filesize?: number | null) => Promise<number[]>;
  addMediaTask: (payload: AddMediaTaskPayload) => Promise<DownloadTask>;
  addAria2Task: (payload: AddAria2TaskPayload) => Promise<string>;
  addTorrentTask: (filePath: string, dir?: string) => Promise<string>;
  pauseTask: (id: string, engine: TaskEngine) => Promise<void>;
  resumeTask: (id: string, engine: TaskEngine) => Promise<void>;
  removeTask: (id: string, engine: TaskEngine) => Promise<void>;
  clearCompleted: () => Promise<void>;
  openFolder: (targetPath: string) => Promise<void>;
  openFile: (filePath: string) => Promise<void>;
  refreshTasks: () => Promise<void>;
  onTasksUpdate: (cb: (data: { tasks: DownloadTask[]; stats: GlobalStats }) => void) => () => void;
  runMediaTool: (payload: MediaToolPayload) => Promise<string>;
  onMediaToolProgress: (cb: (progress: MediaToolProgress) => void) => () => void;
}

declare global {
  interface Window {
    mazgeter?: MazGeterAPI;
  }
}
