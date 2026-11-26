import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { resolveBinary } from './binResolver';
import {
  AddMediaTaskPayload,
  DownloadTask,
  MediaInfo,
  MediaToolPayload,
  MediaToolProgress,
  QualityOption,
} from './types';

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds)) return '00:00';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function parseSizeToBytes(numStr: string, unit: string): number {
  const val = parseFloat(numStr);
  if (Number.isNaN(val)) return 0;
  const u = unit.toLowerCase();
  if (u.startsWith('g')) return Math.round(val * 1024 * 1024 * 1024);
  if (u.startsWith('m')) return Math.round(val * 1024 * 1024);
  if (u.startsWith('k')) return Math.round(val * 1024);
  return Math.round(val);
}

export class MediaEngine {
  private activeProcesses = new Map<string, ChildProcess>();
  private activeTasks = new Map<string, DownloadTask>();

  getActiveTasks(): DownloadTask[] {
    return Array.from(this.activeTasks.values());
  }

  async analyzeUrl(url: string): Promise<MediaInfo> {
    const ytDlp = resolveBinary('yt-dlp.exe');
    if (!ytDlp) {
      throw new Error('Không tìm thấy yt-dlp.exe trên hệ thống.');
    }

    const args = [
      '--dump-single-json',
      '--no-warnings',
      '--skip-download',
      '--no-check-certificates',
      '--flat-playlist',
      url,
    ];

    const rawJson = await new Promise<string>((resolve, reject) => {
      const child = spawn(ytDlp, args, { windowsHide: true });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          resolve(stdout.trim());
        } else {
          reject(new Error(stderr.trim() || `yt-dlp thoát với mã lỗi ${code}`));
        }
      });
    });

    const data = JSON.parse(rawJson);
    const isPlaylist = data._type === 'playlist' && Array.isArray(data.entries);

    const heights = new Set<number>();
    if (Array.isArray(data.formats)) {
      for (const f of data.formats) {
        if (f.vcodec && f.vcodec !== 'none' && typeof f.height === 'number' && f.height >= 144) {
          heights.add(f.height);
        }
      }
    }

    const sortedHeights = Array.from(heights).sort((a, b) => b - a);
    const standardBuckets = [4320, 2160, 1440, 1080, 720, 480, 360, 240];
    const pickedHeights =
      sortedHeights.length > 0
        ? standardBuckets.filter((b) => sortedHeights.some((h) => h >= b * 0.9 && h <= b * 1.15))
        : [1080, 720, 480, 360];

    const finalHeights = pickedHeights.length > 0 ? pickedHeights : sortedHeights.slice(0, 6);

    const labelForHeight = (h: number) => {
      if (h >= 4320) return '8K Ultra HD (4320p)';
      if (h >= 2160) return '4K Ultra HD (2160p)';
      if (h >= 1440) return '2K QHD (1440p)';
      if (h >= 1080) return 'Full HD (1080p)';
      if (h >= 720) return 'HD (720p)';
      return `${h}p`;
    };

    const videoQualities: QualityOption[] = [
      { value: 'best', label: 'Tốt nhất tự động (Best Available)' },
      ...finalHeights.map((h) => ({ value: String(h), label: labelForHeight(h) })),
    ];

    const audioQualities: QualityOption[] = [
      { value: '320', label: '320 kbps (Chất lượng cao nhất)' },
      { value: '192', label: '192 kbps (Tiêu chuẩn)' },
      { value: '128', label: '128 kbps (Nhẹ)' },
    ];

    const subLangs = new Set<string>();
    if (data.subtitles && typeof data.subtitles === 'object') {
      Object.keys(data.subtitles).forEach((k) => subLangs.add(k));
    }
    if (data.automatic_captions && typeof data.automatic_captions === 'object') {
      ['vi', 'en'].forEach((k) => {
        if (data.automatic_captions[k]) subLangs.add(k);
      });
    }

    const thumbnail =
      data.thumbnail ||
      (Array.isArray(data.thumbnails) && data.thumbnails.length > 0
        ? data.thumbnails[data.thumbnails.length - 1]?.url
        : null);

    // Pick direct playable preview streams for audio waveform & video scrubbing
    let audioStreamUrl: string | null = null;
    let waveformAudioUrl: string | null = null;
    let waveformFilesize: number | null = null;
    let videoStreamUrl: string | null = null;
    if (Array.isArray(data.formats)) {
      const httpFormats = data.formats.filter(
        (f: { url?: string; protocol?: string }) =>
          typeof f.url === 'string' &&
          f.url.startsWith('http') &&
          (!f.protocol || f.protocol === 'https' || f.protocol === 'http')
      );

      // Audio-only streams — ALWAYS prefer original/default track (avoid YouTube AI auto-dub tracks!)
      const allAudioOnly = httpFormats.filter(
        (f: { acodec?: string; vcodec?: string }) =>
          f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none')
      );

      const originalAudioOnly = allAudioOnly.filter(
        (f: { language_preference?: number; format_note?: string }) => {
          const note = (f.format_note || '').toLowerCase();
          return (
            (typeof f.language_preference === 'number' && f.language_preference > 0) ||
            note.includes('original') ||
            note.includes('default')
          );
        }
      );

      const audioOnly = originalAudioOnly.length > 0 ? originalAudioOnly : allAudioOnly;

      // Best playable audio-only stream (prefer m4a/mp4 for HTML5 <audio> playback)
      const audioCandidates = [...audioOnly].sort(
        (
          a: { abr?: number; ext?: string; language_preference?: number },
          b: { abr?: number; ext?: string; language_preference?: number }
        ) => {
          const prefDiff = (b.language_preference || 0) - (a.language_preference || 0);
          if (prefDiff !== 0) return prefDiff;
          const scoreA = (a.ext === 'm4a' ? 500 : 0) + (a.abr || 0);
          const scoreB = (b.ext === 'm4a' ? 500 : 0) + (b.abr || 0);
          return scoreB - scoreA;
        }
      );

      // Smallest / lowest-bitrate ORIGINAL audio-only stream for ultra-fast waveform scan (~48kbps)
      const smallestAudio = [...audioOnly].sort(
        (
          a: { abr?: number; filesize?: number; filesize_approx?: number },
          b: { abr?: number; filesize?: number; filesize_approx?: number }
        ) => {
          const sizeA = a.filesize || a.filesize_approx || (a.abr || 999) * 10000;
          const sizeB = b.filesize || b.filesize_approx || (b.abr || 999) * 10000;
          return sizeA - sizeB;
        }
      )[0];

      // Best progressive MP4 (both audio + video, <= 720p for fast scrub preview)
      const progressiveVideos = httpFormats
        .filter(
          (f: { acodec?: string; vcodec?: string; ext?: string }) =>
            f.acodec && f.acodec !== 'none' && f.vcodec && f.vcodec !== 'none' && f.ext === 'mp4'
        )
        .sort((a: { height?: number }, b: { height?: number }) => (a.height || 0) - (b.height || 0));

      const preferredPreview =
        progressiveVideos.find((f: { height?: number }) => (f.height || 0) >= 360 && (f.height || 0) <= 720) ||
        progressiveVideos[progressiveVideos.length - 1] ||
        null;

      videoStreamUrl = preferredPreview?.url || null;
      audioStreamUrl = audioCandidates[0]?.url || videoStreamUrl || (typeof data.url === 'string' ? data.url : null);
      waveformAudioUrl = smallestAudio?.url || audioStreamUrl;
      waveformFilesize = smallestAudio?.filesize || smallestAudio?.filesize_approx || null;
    } else if (typeof data.url === 'string') {
      audioStreamUrl = data.url;
      waveformAudioUrl = data.url;
      videoStreamUrl = data.url;
    }

    return {
      id: String(data.id || Date.now()),
      title: String(data.title || 'Untitled Media'),
      thumbnail,
      duration: typeof data.duration === 'number' ? data.duration : null,
      durationText: formatDuration(data.duration),
      uploader: String(data.uploader || data.channel || data.extractor_key || 'Unknown'),
      webpageUrl: String(data.webpage_url || url),
      extractor: String(data.extractor_key || data.extractor || 'Media'),
      isPlaylist,
      playlistCount: isPlaylist ? data.entries.length : undefined,
      audioStreamUrl,
      waveformAudioUrl,
      waveformFilesize,
      videoStreamUrl,
      videoQualities,
      audioQualities,
      subtitles: Array.from(subLangs).slice(0, 15),
    };
  }

  private async fetchAudioFast(url: string, knownSize?: number | null): Promise<Buffer | null> {
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    };

    try {
      let totalSize = knownSize && knownSize > 0 ? knownSize : 0;
      if (!totalSize) {
        const head = await fetch(url, { method: 'HEAD', headers });
        const len = Number(head.headers.get('content-length') || 0);
        if (len > 0) totalSize = len;
      }

      // Cap download at 15MB so huge multi-hour streams never stall
      const maxBytes = 15 * 1024 * 1024;
      const targetSize = totalSize > 0 ? Math.min(totalSize, maxBytes) : 0;

      // Parallel 8-chunk Range fetch bypasses YouTube's single-stream throttle (~0.5-1.5s for 15min!)
      if (targetSize >= 256 * 1024) {
        const chunks = 8;
        const partSize = Math.ceil(targetSize / chunks);
        const ranges: Array<[number, number]> = [];
        for (let i = 0; i < chunks; i++) {
          const start = i * partSize;
          const end = Math.min(targetSize - 1, start + partSize - 1);
          if (start <= end) ranges.push([start, end]);
        }

        const parts = await Promise.all(
          ranges.map(async ([start, end]) => {
            const res = await fetch(url, {
              headers: { ...headers, Range: `bytes=${start}-${end}` },
            });
            if (!res.ok && res.status !== 206) {
              throw new Error(`HTTP ${res.status}`);
            }
            return Buffer.from(await res.arrayBuffer());
          })
        );
        return Buffer.concat(parts);
      }

      // Single fast fetch for small files
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  async extractWaveform(audioUrl: string, bars = 280, filesize?: number | null): Promise<number[]> {
    const ffmpeg = resolveBinary('ffmpeg.exe');
    if (!ffmpeg || !audioUrl) return [];

    // 1. Download tiny low-bitrate audio into RAM in parallel (~0.5-1.5s)
    const audioBuf = await this.fetchAudioFast(audioUrl, filesize);

    // 2. Decode locally via FFmpeg (~0.1-0.2s)
    return new Promise<number[]>((resolve) => {
      const args = [
        '-v',
        'error',
        '-i',
        audioBuf ? 'pipe:0' : audioUrl,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '8000',
        '-f',
        's16le',
        'pipe:1',
      ];

      const child = spawn(ffmpeg, args, { windowsHide: true });
      const chunks: Buffer[] = [];
      let done = false;

      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        const buf = Buffer.concat(chunks);
        const sampleCount = Math.floor(buf.length / 2);
        if (sampleCount < 10) {
          resolve([]);
          return;
        }

        const bucketSize = Math.max(1, Math.floor(sampleCount / bars));
        const rawVals: number[] = [];
        let maxVal = 1;

        for (let b = 0; b < bars; b++) {
          const start = b * bucketSize;
          const end = Math.min(sampleCount, start + bucketSize);
          let sumSq = 0;
          let count = 0;
          // Sample stride for speed while preserving accurate speech RMS envelope
          const step = Math.max(1, Math.floor((end - start) / 400));
          for (let i = start; i < end; i += step) {
            const val = buf.readInt16LE(i * 2);
            sumSq += val * val;
            count++;
          }
          const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
          rawVals.push(rms);
          if (rms > maxVal) maxVal = rms;
        }

        const normalized = rawVals.map((p) => Number(Math.min(1, Math.pow(p / maxVal, 0.75)).toFixed(3)));
        resolve(normalized);
      };

      const timer = setTimeout(() => {
        try {
          child.kill();
        } catch {
          // ignore
        }
        finish();
      }, 12000);

      child.stdout.on('data', (c: Buffer) => chunks.push(c));
      child.on('close', finish);
      child.on('error', () => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve([]);
        }
      });

      if (audioBuf) {
        child.stdin.on('error', () => {});
        child.stdin.end(audioBuf);
      }
    });
  }

  startDownload(
    payload: AddMediaTaskPayload,
    defaultDir: string,
    onUpdate: (task: DownloadTask) => void,
    onComplete: (task: DownloadTask) => void
  ): DownloadTask {
    const ytDlp = resolveBinary('yt-dlp.exe');
    const ffmpeg = resolveBinary('ffmpeg.exe');
    if (!ytDlp) {
      throw new Error('Không tìm thấy yt-dlp.exe.');
    }

    const dir = payload.dir || defaultDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const id = `yt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const isAudio = ['mp3', 'm4a', 'wav'].includes(payload.format);
    const qualityTag = isAudio
      ? `${payload.format.toUpperCase()} ${payload.quality}k`
      : `${payload.format.toUpperCase()} ${payload.quality === 'best' ? 'BEST' : `${payload.quality}p`}`;

    const task: DownloadTask = {
      id,
      engine: 'yt-dlp',
      name: payload.title || payload.url,
      url: payload.url,
      status: 'active',
      totalLength: 0,
      completedLength: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      progress: 0,
      eta: 'Đang khởi tạo...',
      dir,
      thumbnail: payload.thumbnail || undefined,
      formatLabel: qualityTag,
      createdAt: Date.now(),
    };

    const outputTemplate = payload.isPlaylist
      ? path.join(dir, '%(playlist_title)s', '%(playlist_index)02d - %(title).120s.%(ext)s')
      : path.join(dir, '%(title).140s.%(ext)s');

    const args: string[] = [
      '--newline',
      '--no-warnings',
      '--no-check-certificates',
      '--progress',
      '-o',
      outputTemplate,
    ];

    if (!payload.isPlaylist) {
      args.push('--no-playlist');
    }

    if (ffmpeg) {
      args.push('--ffmpeg-location', path.dirname(ffmpeg));
    }

    if (isAudio) {
      args.push(
        '-f',
        'bestaudio/best',
        '-x',
        '--audio-format',
        payload.format,
        '--audio-quality',
        `${payload.quality || '192'}K`
      );
    } else {
      const h = payload.quality && payload.quality !== 'best' ? payload.quality : null;
      const fmtSelector = h
        ? `bestvideo[height<=${h}]+bestaudio/best[height<=${h}]/best`
        : 'bestvideo+bestaudio/best';
      args.push('-f', fmtSelector, '--merge-output-format', payload.format);
    }

    if (payload.downloadSubtitles) {
      args.push(
        '--write-subs',
        '--write-auto-subs',
        '--sub-langs',
        payload.subtitleLang || 'vi,en',
        '--convert-subs',
        'srt'
      );
    }

    if (payload.trimStart || payload.trimEnd) {
      const start = payload.trimStart?.trim() || '00:00:00';
      const end = payload.trimEnd?.trim() || 'inf';
      args.push('--download-sections', `*${start}-${end}`, '--force-keyframes-at-cuts');
    }

    args.push(payload.url);

    this.activeTasks.set(id, task);
    onUpdate({ ...task });

    const child = spawn(ytDlp, args, { windowsHide: true });
    this.activeProcesses.set(id, child);

    let lastStderr = '';

    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Capture destination filename
      const destMatch = trimmed.match(/\[(?:download|Merger|ExtractAudio)\]\s+(?:Destination:\s+|Merging formats into\s+"?)(.+?)"?$/i);
      if (destMatch && destMatch[1]) {
        const candidate = destMatch[1].replace(/^"|"$/g, '').trim();
        task.filePath = candidate;
        task.name = path.basename(candidate);
      }

      // Parse progress: [download]  42.3% of ~ 125.40MiB at   12.30MiB/s ETA 00:08
      const progMatch = trimmed.match(
        /\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?\s*([\d.]+)([KMG]?i?B)(?:\s+at\s+([\d.]+)([KMG]?i?B)\/s)?(?:\s+ETA\s+(\S+))?/i
      );
      if (progMatch) {
        const pct = parseFloat(progMatch[1]);
        const total = parseSizeToBytes(progMatch[2], progMatch[3]);
        const speed = progMatch[4] && progMatch[5] ? parseSizeToBytes(progMatch[4], progMatch[5]) : 0;
        const eta = progMatch[6] || '--';

        task.progress = Math.min(99.9, Number(pct.toFixed(1)));
        task.totalLength = total;
        task.completedLength = Math.round((total * pct) / 100);
        task.downloadSpeed = speed;
        task.eta = eta;
        onUpdate({ ...task });
        return;
      }

      if (trimmed.includes('[Merger]') || trimmed.includes('[ExtractAudio]')) {
        task.progress = 99;
        task.downloadSpeed = 0;
        task.eta = 'Đang ghép/chuyển đổi FFmpeg...';
        onUpdate({ ...task });
      }
    };

    child.stdout.on('data', (chunk) => {
      chunk.toString().split(/\r?\n/).forEach(handleLine);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      lastStderr = text.trim() || lastStderr;
    });

    child.on('close', (code) => {
      this.activeProcesses.delete(id);
      if (task.status === 'removed') {
        this.activeTasks.delete(id);
        return;
      }
      if (code === 0) {
        task.status = 'complete';
        task.progress = 100;
        task.downloadSpeed = 0;
        task.completedLength = task.totalLength || task.completedLength;
        task.eta = 'Xong';
      } else {
        task.status = 'error';
        task.downloadSpeed = 0;
        task.eta = 'Lỗi';
        task.errorMessage = lastStderr.slice(0, 240) || `yt-dlp thoát với mã ${code}`;
      }
      this.activeTasks.delete(id);
      onComplete({ ...task });
    });

    child.on('error', (err) => {
      this.activeProcesses.delete(id);
      task.status = 'error';
      task.errorMessage = err.message;
      this.activeTasks.delete(id);
      onComplete({ ...task });
    });

    return { ...task };
  }

  cancelTask(id: string): boolean {
    const task = this.activeTasks.get(id);
    const proc = this.activeProcesses.get(id);
    if (task) {
      task.status = 'removed';
      this.activeTasks.delete(id);
    }
    if (proc) {
      try {
        proc.kill('SIGKILL');
      } catch {
        // ignore
      }
      this.activeProcesses.delete(id);
      return true;
    }
    return false;
  }

  stopAll() {
    for (const proc of this.activeProcesses.values()) {
      try {
        proc.kill();
      } catch {
        // ignore
      }
    }
    this.activeProcesses.clear();
    this.activeTasks.clear();
  }

  runFfmpegTool(
    payload: MediaToolPayload,
    defaultDir: string,
    onProgress: (p: MediaToolProgress) => void
  ): string {
    const ffmpeg = resolveBinary('ffmpeg.exe');
    if (!ffmpeg) {
      throw new Error('Không tìm thấy ffmpeg.exe.');
    }

    const jobId = `ff-${Date.now()}`;
    const outDir = payload.outputDir || path.dirname(payload.inputPath) || defaultDir;
    const baseName = path.basename(payload.inputPath, path.extname(payload.inputPath));
    const suffix =
      payload.action === 'trim'
        ? '_trimmed'
        : payload.action === 'extract-audio'
        ? '_audio'
        : '_converted';
    const outputPath = path.join(outDir, `${baseName}${suffix}.${payload.targetFormat}`);

    const args: string[] = ['-y'];
    if (payload.action === 'trim' && payload.trimStart?.trim()) {
      args.push('-ss', payload.trimStart.trim());
    }
    args.push('-i', payload.inputPath);
    if (payload.action === 'trim' && payload.trimEnd?.trim()) {
      args.push('-to', payload.trimEnd.trim());
    }

    if (payload.action === 'extract-audio' || ['mp3', 'm4a', 'wav'].includes(payload.targetFormat)) {
      args.push('-vn');
      if (payload.targetFormat === 'mp3') {
        args.push('-c:a', 'libmp3lame', '-b:a', `${payload.audioBitrate || '192'}k`);
      } else if (payload.targetFormat === 'm4a') {
        args.push('-c:a', 'aac', '-b:a', `${payload.audioBitrate || '192'}k`);
      }
    } else if (payload.action === 'trim' && path.extname(payload.inputPath).slice(1).toLowerCase() === payload.targetFormat) {
      args.push('-c', 'copy');
    }

    args.push(outputPath);

    onProgress({
      jobId,
      status: 'running',
      percent: 15,
      stage: 'Đang xử lý bằng FFmpeg...',
      outputPath,
    });

    const child = spawn(ffmpeg, args, { windowsHide: true });
    let lastErr = '';
    let tick = 20;

    child.stderr.on('data', (chunk) => {
      const s = chunk.toString();
      lastErr = s.trim() || lastErr;
      if (s.includes('time=')) {
        tick = Math.min(95, tick + 4);
        const timeMatch = s.match(/time=(\d+:\d+:\d+\.\d+)/);
        onProgress({
          jobId,
          status: 'running',
          percent: tick,
          stage: timeMatch ? `Đang xử lý (${timeMatch[1]})...` : 'Đang chuyển đổi...',
          outputPath,
        });
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        onProgress({
          jobId,
          status: 'complete',
          percent: 100,
          stage: 'Hoàn thành!',
          outputPath,
        });
      } else {
        onProgress({
          jobId,
          status: 'error',
          percent: 0,
          stage: 'Lỗi FFmpeg',
          error: lastErr.slice(-240) || `FFmpeg thoát với mã ${code}`,
        });
      }
    });

    return jobId;
  }
}
