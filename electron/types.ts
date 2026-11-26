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
  downloadSpeed: number; // bytes/sec
  uploadSpeed: number;   // bytes/sec
  progress: number;      // 0 - 100
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
  videoStreamUrl?: string | null;
  videoQualities: QualityOption[];
  audioQualities: QualityOption[];
  subtitles: string[];
}

export interface AddMediaTaskPayload {
  url: string;
  title?: string;
  thumbnail?: string | null;
  format: 'mp4' | 'mp3' | 'mkv' | 'm4a' | 'wav';
  quality: string; // e.g., '2160', '1080', '720', 'best', '320', '192'
  dir?: string;
  downloadSubtitles?: boolean;
  subtitleLang?: string;
  trimStart?: string; // HH:MM:SS or MM:SS
  trimEnd?: string;
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
  speedLimitKbps: number; // 0 = unlimited
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
