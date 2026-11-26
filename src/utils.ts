export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, i);
  return `${val >= 100 ? val.toFixed(0) : val.toFixed(1)} ${units[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

const MEDIA_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'music.youtube.com',
  'tiktok.com',
  'vt.tiktok.com',
  'facebook.com',
  'fb.watch',
  'instagram.com',
  'x.com',
  'twitter.com',
  'bilibili.com',
  'b23.tv',
  'vimeo.com',
  'dailymotion.com',
  'twitch.tv',
  'soundcloud.com',
  'reddit.com',
  'douyin.com',
  'pinterest.com',
  'threads.net',
];

export function detectUrlType(input: string): 'media' | 'torrent' | 'direct' {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return 'media';
  if (trimmed.startsWith('magnet:') || trimmed.endsWith('.torrent')) {
    return 'torrent';
  }
  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, '');
    if (MEDIA_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
      return 'media';
    }
    const directExts = [
      '.zip', '.rar', '.7z', '.tar', '.gz', '.iso', '.exe', '.msi', '.dmg',
      '.apk', '.pdf', '.bin', '.img', '.deb', '.rpm', '.pkg',
    ];
    if (directExts.some((ext) => u.pathname.toLowerCase().endsWith(ext))) {
      return 'direct';
    }
  } catch {
    // not a valid URL yet
  }
  return 'media';
}
