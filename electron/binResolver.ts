import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { app } from 'electron';
import { BinaryInfo, BinaryStatus } from './types';

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function findInPath(exeName: string): string | null {
  try {
    const out = execFileSync('where.exe', [exeName], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    const first = out.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    return first && fileExists(first) ? first : null;
  } catch {
    return null;
  }
}

function getCandidateDirs(): string[] {
  const dirs: string[] = [];
  if (app?.isPackaged) {
    dirs.push(path.join(process.resourcesPath, 'bin'));
  }
  const appRoot = app?.getAppPath ? app.getAppPath() : process.cwd();
  dirs.push(path.join(appRoot, 'resources', 'bin'));
  dirs.push(path.join(process.cwd(), 'resources', 'bin'));

  // Standard user environment folders (E:\ProfileGit\Enviroment)
  dirs.push('E:\\ProfileGit\\Enviroment\\aria2');
  dirs.push('E:\\ProfileGit\\Enviroment\\ffmpeg\\bin');
  dirs.push('E:\\ProfileGit\\Enviroment\\python\\mediadownloader-venv\\Scripts');
  dirs.push('E:\\ProfileGit\\Enviroment\\yt-dlp');
  return dirs;
}

export function resolveBinary(exeName: string): string | null {
  for (const dir of getCandidateDirs()) {
    const full = path.join(dir, exeName);
    if (fileExists(full)) {
      return full;
    }
  }
  return findInPath(exeName);
}

function getVersion(binPath: string | null, args: string[]): string | undefined {
  if (!binPath) return undefined;
  try {
    const out = execFileSync(binPath, args, {
      encoding: 'utf8',
      timeout: 4000,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    return out.split(/\r?\n/)[0]?.trim();
  } catch {
    return undefined;
  }
}

export function getBinaryStatus(): BinaryStatus {
  const aria2Path = resolveBinary('aria2c.exe');
  const ytDlpPath = resolveBinary('yt-dlp.exe');
  const ffmpegPath = resolveBinary('ffmpeg.exe');
  const ffprobePath = resolveBinary('ffprobe.exe');

  const mk = (name: string, p: string | null, verArgs: string[]): BinaryInfo => ({
    name,
    path: p,
    available: Boolean(p),
    version: getVersion(p, verArgs),
  });

  return {
    aria2c: mk('aria2c', aria2Path, ['--version']),
    ytDlp: mk('yt-dlp', ytDlpPath, ['--version']),
    ffmpeg: mk('ffmpeg', ffmpegPath, ['-version']),
    ffprobe: mk('ffprobe', ffprobePath, ['-version']),
  };
}
