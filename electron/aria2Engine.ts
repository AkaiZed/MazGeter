import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { resolveBinary } from './binResolver';
import { AddAria2TaskPayload, AppSettings, DownloadTask, TaskStatus } from './types';

interface Aria2RpcResponse<T = unknown> {
  id: string;
  jsonrpc: string;
  result?: T;
  error?: { code: number; message: string };
}

interface Aria2RawTask {
  gid: string;
  status: string;
  totalLength: string;
  completedLength: string;
  downloadSpeed: string;
  uploadSpeed: string;
  connections?: string;
  dir: string;
  errorMessage?: string;
  bittorrent?: {
    info?: { name?: string };
  };
  files?: Array<{
    path?: string;
    uris?: Array<{ uri?: string }>;
  }>;
}

export class Aria2Engine {
  private proc: ChildProcess | null = null;
  private rpcPort = 16808;
  private rpcSecret = 'mazgeter-rpc-secret';
  private ready = false;
  private sessionFile: string;

  constructor() {
    this.sessionFile = path.join(app.getPath('userData'), 'aria2.session');
  }

  async start(settings: AppSettings): Promise<boolean> {
    const aria2Path = resolveBinary('aria2c.exe');
    if (!aria2Path) {
      console.warn('[Aria2Engine] aria2c.exe not found');
      return false;
    }

    try {
      if (!fs.existsSync(this.sessionFile)) {
        fs.writeFileSync(this.sessionFile, '', 'utf8');
      }
    } catch {
      // ignore
    }

    const args = [
      '--enable-rpc=true',
      '--rpc-listen-all=false',
      `--rpc-listen-port=${this.rpcPort}`,
      `--rpc-secret=${this.rpcSecret}`,
      '--rpc-allow-origin-all=true',
      `--dir=${settings.downloadDir}`,
      `--max-concurrent-downloads=${settings.maxConcurrentDownloads}`,
      `--split=${settings.aria2Split}`,
      `--max-connection-per-server=${settings.maxConnectionPerServer}`,
      '--min-split-size=1M',
      '--continue=true',
      '--auto-file-renaming=true',
      '--allow-overwrite=false',
      `--save-session=${this.sessionFile}`,
      `--input-file=${this.sessionFile}`,
      '--save-session-interval=30',
      '--bt-enable-lpd=true',
      '--enable-dht=true',
      '--enable-peer-exchange=true',
      '--seed-time=0',
      '--quiet=true',
    ];

    if (settings.speedLimitKbps > 0) {
      args.push(`--max-overall-download-limit=${settings.speedLimitKbps}K`);
    }

    this.proc = spawn(aria2Path, args, {
      windowsHide: true,
      stdio: 'ignore',
    });

    this.proc.on('exit', (code) => {
      console.log('[Aria2Engine] exited with code', code);
      this.ready = false;
      this.proc = null;
    });

    // Wait up to 4s for RPC to come online
    for (let i = 0; i < 20; i++) {
      try {
        await this.rpc('aria2.getVersion');
        this.ready = true;
        return true;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    return false;
  }

  stop() {
    if (this.ready) {
      this.rpc('aria2.saveSession').catch(() => {});
      this.rpc('aria2.shutdown').catch(() => {});
    }
    if (this.proc) {
      try {
        this.proc.kill();
      } catch {
        // ignore
      }
      this.proc = null;
    }
    this.ready = false;
  }

  isReady(): boolean {
    return this.ready;
  }

  private async rpc<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const payload = {
      jsonrpc: '2.0',
      id: `mg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      method,
      params: [`token:${this.rpcSecret}`, ...params],
    };

    const res = await fetch(`http://127.0.0.1:${this.rpcPort}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`aria2 RPC HTTP ${res.status}`);
    }
    const json = (await res.json()) as Aria2RpcResponse<T>;
    if (json.error) {
      throw new Error(json.error.message || 'aria2 RPC error');
    }
    return json.result as T;
  }

  async applySettings(settings: AppSettings) {
    if (!this.ready) return;
    try {
      await this.rpc('aria2.changeGlobalOption', [
        {
          dir: settings.downloadDir,
          'max-concurrent-downloads': String(settings.maxConcurrentDownloads),
          'max-overall-download-limit':
            settings.speedLimitKbps > 0 ? `${settings.speedLimitKbps}K` : '0',
        },
      ]);
    } catch (err) {
      console.error('[Aria2Engine] applySettings error:', err);
    }
  }

  async addUri(payload: AddAria2TaskPayload, defaultSettings: AppSettings): Promise<string> {
    if (!this.ready) {
      throw new Error('aria2c engine chưa sẵn sàng.');
    }
    const options: Record<string, string> = {
      dir: payload.dir || defaultSettings.downloadDir,
      split: String(payload.split || defaultSettings.aria2Split),
      'max-connection-per-server': String(
        payload.maxConnectionPerServer || defaultSettings.maxConnectionPerServer
      ),
    };
    if (payload.out) options.out = payload.out;
    if (payload.userAgent) options['user-agent'] = payload.userAgent;
    if (payload.referer) options.referer = payload.referer;

    return this.rpc<string>('aria2.addUri', [payload.urls, options]);
  }

  async addTorrent(torrentFilePath: string, dir?: string): Promise<string> {
    if (!this.ready) {
      throw new Error('aria2c engine chưa sẵn sàng.');
    }
    const b64 = fs.readFileSync(torrentFilePath).toString('base64');
    const options: Record<string, string> = {};
    if (dir) options.dir = dir;
    return this.rpc<string>('aria2.addTorrent', [b64, [], options]);
  }

  async pause(gid: string) {
    if (!this.ready) return;
    await this.rpc('aria2.forcePause', [gid]);
  }

  async resume(gid: string) {
    if (!this.ready) return;
    await this.rpc('aria2.unpause', [gid]);
  }

  async remove(gid: string) {
    if (!this.ready) return;
    try {
      await this.rpc('aria2.forceRemove', [gid]);
    } catch {
      // might already be stopped
    }
    try {
      await this.rpc('aria2.removeDownloadResult', [gid]);
    } catch {
      // ignore
    }
  }

  async clearCompleted() {
    if (!this.ready) return;
    await this.rpc('aria2.purgeDownloadResult');
  }

  async getAllTasks(): Promise<DownloadTask[]> {
    if (!this.ready) return [];
    try {
      const [active, waiting, stopped] = await Promise.all([
        this.rpc<Aria2RawTask[]>('aria2.tellActive'),
        this.rpc<Aria2RawTask[]>('aria2.tellWaiting', [0, 100]),
        this.rpc<Aria2RawTask[]>('aria2.tellStopped', [0, 100]),
      ]);
      const combined = [...active, ...waiting, ...stopped];
      return combined.map((t) => this.normalizeTask(t));
    } catch {
      return [];
    }
  }

  private normalizeTask(raw: Aria2RawTask): DownloadTask {
    const totalLength = Number(raw.totalLength || 0);
    const completedLength = Number(raw.completedLength || 0);
    const downloadSpeed = Number(raw.downloadSpeed || 0);
    const uploadSpeed = Number(raw.uploadSpeed || 0);
    const progress =
      totalLength > 0 ? Math.min(100, (completedLength / totalLength) * 100) : 0;

    const firstFile = raw.files?.[0];
    const filePath = firstFile?.path || undefined;
    const uri = firstFile?.uris?.[0]?.uri || '';

    let name = raw.bittorrent?.info?.name || '';
    if (!name && filePath) {
      name = path.basename(filePath);
    }
    if (!name && uri) {
      try {
        const u = new URL(uri);
        name = decodeURIComponent(path.basename(u.pathname)) || u.hostname;
      } catch {
        name = uri.slice(0, 60);
      }
    }
    if (!name) name = `Task ${raw.gid}`;

    let eta = '--';
    if (raw.status === 'active' && downloadSpeed > 0 && totalLength > completedLength) {
      const secs = Math.round((totalLength - completedLength) / downloadSpeed);
      eta = formatSeconds(secs);
    } else if (raw.status === 'complete') {
      eta = 'Xong';
    }

    const statusMap: Record<string, TaskStatus> = {
      active: 'active',
      waiting: 'waiting',
      paused: 'paused',
      complete: 'complete',
      error: 'error',
      removed: 'removed',
    };

    const isTorrent = Boolean(raw.bittorrent) || uri.startsWith('magnet:');

    return {
      id: raw.gid,
      engine: 'aria2',
      name,
      url: uri || (isTorrent ? 'BitTorrent / Magnet' : ''),
      status: statusMap[raw.status] || 'waiting',
      totalLength,
      completedLength,
      downloadSpeed,
      uploadSpeed,
      progress: Number(progress.toFixed(1)),
      eta,
      dir: raw.dir,
      filePath,
      formatLabel: isTorrent ? 'TORRENT' : 'MULTI-THREAD',
      connections: Number(raw.connections || 0),
      errorMessage: raw.errorMessage,
      createdAt: Date.now(),
    };
  }
}

function formatSeconds(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return '--';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
