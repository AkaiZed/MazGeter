import React, { useEffect, useRef, useState } from 'react';
import {
  ClipboardPaste,
  Download,
  FileArchive,
  Film,
  FolderOpen,
  Globe,
  Loader2,
  Magnet,
  Maximize,
  Minimize,
  Music,
  Scissors,
  Search,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { AppSettings, MediaInfo } from '../types';
import { detectUrlType } from '../utils';
import { formatPreciseTime, TimelineTrimmer } from './TimelineTrimmer';

interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings | null;
  onTaskCreated: () => void;
}

type ModalMode = 'media' | 'direct';

export const AddTaskModal: React.FC<AddTaskModalProps> = ({
  open,
  onClose,
  settings,
  onTaskCreated,
}) => {
  const [mode, setMode] = useState<ModalMode>('media');
  const [urlInput, setUrlInput] = useState('');
  const [saveDir, setSaveDir] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Media mode state
  const [analyzing, setAnalyzing] = useState(false);
  const [downloadPlaylist, setDownloadPlaylist] = useState(false);
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [mediaFormat, setMediaFormat] = useState<'mp4' | 'mkv' | 'mp3' | 'm4a' | 'wav'>('mp4');
  const [quality, setQuality] = useState('1080');
  const [volumePercent, setVolumePercent] = useState(100);
  const analyzeRequestIdRef = useRef(0);
  const skipAutoUrlRef = useRef<string | null>(null);

  // Trimmer state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDetailTrimmer, setShowDetailTrimmer] = useState(false);
  const [trimStartSec, setTrimStartSec] = useState(0);
  const [trimEndSec, setTrimEndSec] = useState(60);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [loadingPeaks, setLoadingPeaks] = useState(false);
  const scannedWaveForRef = useRef<string | null>(null);

  // Direct/Torrent mode state (Motrix)
  const [customFileName, setCustomFileName] = useState('');
  const [splitThreads, setSplitThreads] = useState(16);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSaveDir(settings?.downloadDir || '');
      setSplitThreads(settings?.aria2Split || 16);
      setError(null);
    }
  }, [open, settings]);

  const isAudioFormat = ['mp3', 'm4a', 'wav'].includes(mediaFormat);
  const hasAnalyzedMedia = Boolean(mediaInfo);
  const isPlaylistMode = downloadPlaylist || Boolean(mediaInfo?.isPlaylist);
  const trimmerVisible = mode === 'media' && hasAnalyzedMedia && !isPlaylistMode && showDetailTrimmer;
  const totalDuration = mediaInfo?.duration || 60;

  // Automatically extract real audio waveform peaks when link is analyzed & trimmer is visible
  useEffect(() => {
    const waveUrl = mediaInfo?.waveformAudioUrl || mediaInfo?.audioStreamUrl;
    const scanKey = mediaInfo ? `${mediaInfo.id}:${waveUrl || ''}` : null;
    if (!open || !waveUrl || !scanKey || !trimmerVisible) return;
    if (scannedWaveForRef.current === scanKey) return;

    scannedWaveForRef.current = scanKey;
    let cancelled = false;
    setLoadingPeaks(true);

    window.mazgeter
      ?.extractWaveform(waveUrl, 8000, mediaInfo?.waveformFilesize)
      .then((peaks) => {
        if (!cancelled && Array.isArray(peaks) && peaks.length > 0) {
          setWaveformPeaks(peaks);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingPeaks(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, mediaInfo, trimmerVisible]);

  const handlePaste = async () => {
    try {
      const text = (await window.mazgeter?.readClipboard()) || '';
      if (!text.trim()) return;
      skipAutoUrlRef.current = null;
      setUrlInput(text.trim());
      setError(null);
      const detected = detectUrlType(text.trim());
      setMode(detected === 'media' ? 'media' : 'direct');
    } catch {
      setError('Không đọc được clipboard.');
    }
  };

  const handleChooseDir = async () => {
    const dir = await window.mazgeter?.selectFolder();
    if (dir) setSaveDir(dir);
  };

  const handleAnalyze = async (overrideUrl?: string, overridePlaylist?: boolean) => {
    const url = (overrideUrl ?? urlInput).trim();
    const usePlaylist = overridePlaylist ?? downloadPlaylist;
    if (!url) {
      setError('Vui lòng dán đường dẫn video/media.');
      return;
    }
    skipAutoUrlRef.current = `${url}::${usePlaylist ? 'pl' : 'one'}`;
    const reqId = ++analyzeRequestIdRef.current;

    setError(null);
    setAnalyzing(true);
    setMediaInfo(null);
    setWaveformPeaks([]);
    scannedWaveForRef.current = null;
    if (usePlaylist) {
      setShowDetailTrimmer(false);
    }
    try {
      const info = await window.mazgeter!.analyzeMedia(url, usePlaylist);
      if (analyzeRequestIdRef.current !== reqId) return;
      setMediaInfo(info);
      const dur = info.duration || 60;
      setTrimStartSec(0);
      setTrimEndSec(dur);
      setVolumePercent(100);
      if (info.isPlaylist) {
        setShowDetailTrimmer(false);
      }
      if (info.videoQualities.length > 0 && !isAudioFormat) {
        setQuality(info.videoQualities[1]?.value || info.videoQualities[0].value);
      }
    } catch (err: unknown) {
      if (analyzeRequestIdRef.current !== reqId) return;
      setError(err instanceof Error ? err.message : 'Không thể phân tích liên kết.');
    } finally {
      if (analyzeRequestIdRef.current === reqId) {
        setAnalyzing(false);
      }
    }
  };

  const handleStopAnalyze = () => {
    analyzeRequestIdRef.current += 1;
    skipAutoUrlRef.current = `${urlInput.trim()}::${downloadPlaylist ? 'pl' : 'one'}`;
    setAnalyzing(false);
  };

  // Instant auto-analyze as soon as a valid media URL is entered/pasted or playlist switch changes
  useEffect(() => {
    const trimmed = urlInput.trim();
    const key = `${trimmed}::${downloadPlaylist ? 'pl' : 'one'}`;
    if (!open || mode !== 'media' || analyzing) return;
    if (!/^https?:\/\/\S+/i.test(trimmed) || skipAutoUrlRef.current === key) return;

    const timer = window.setTimeout(() => {
      void handleAnalyze(trimmed, downloadPlaylist);
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open, mode, urlInput, downloadPlaylist, analyzing]);

  const handleAddTorrentFile = async () => {
    const file = await window.mazgeter?.selectFile([
      { name: 'Torrent Files', extensions: ['torrent'] },
    ]);
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      await window.mazgeter!.addTorrentTask(file, saveDir || undefined);
      onTaskCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể thêm file torrent.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartDownload = async () => {
    const raw = urlInput.trim();
    if (!raw) {
      setError('Vui lòng nhập ít nhất một đường dẫn.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'media') {
        const isTrimmed =
          trimmerVisible &&
          (trimStartSec > 0.05 || (mediaInfo?.duration ? trimEndSec < mediaInfo.duration - 0.1 : trimEndSec < 59.9));

        await window.mazgeter!.addMediaTask({
          url: raw,
          title: mediaInfo?.title,
          thumbnail: mediaInfo?.thumbnail,
          format: mediaFormat,
          quality,
          dir: saveDir || undefined,
          trimStart: isTrimmed ? formatPreciseTime(trimStartSec) : undefined,
          trimEnd: isTrimmed ? formatPreciseTime(trimEndSec) : undefined,
          volumePercent: trimmerVisible && volumePercent !== 100 ? volumePercent : undefined,
          isPlaylist: downloadPlaylist || Boolean(mediaInfo?.isPlaylist),
        });
      } else {
        const lines = raw
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        for (const line of lines) {
          await window.mazgeter!.addAria2Task({
            urls: [line],
            dir: saveDir || undefined,
            out: lines.length === 1 && customFileName.trim() ? customFileName.trim() : undefined,
            split: splitThreads,
            maxConnectionPerServer: splitThreads,
          });
        }
      }
      setUrlInput('');
      setMediaInfo(null);
      setWaveformPeaks([]);
      setCustomFileName('');
      setShowDetailTrimmer(false);
      setIsFullscreen(false);
      onTaskCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể bắt đầu tải xuống.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className={`fixed top-10 inset-x-0 bottom-0 z-40 bg-black/75 backdrop-blur-md flex items-center justify-center transition-all duration-300 ease-out ${
        isFullscreen ? 'p-0' : 'p-4'
      }`}
    >
      <div
        className={`w-full ${
          isFullscreen
            ? 'h-full max-w-none max-h-none rounded-none border-0 shadow-none scale-100'
            : `${trimmerVisible ? 'max-w-4xl' : 'max-w-2xl'} rounded-2xl max-h-[calc(100vh-5.5rem)] border border-white/[0.09] shadow-2xl scale-100`
        } bg-[#131926] overflow-hidden flex flex-col transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]`}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">Tạo tác vụ tải xuống</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsFullscreen((v) => !v)}
              className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                isFullscreen
                  ? 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
              title={isFullscreen ? 'Thu nhỏ' : 'Mở rộng toàn khung'}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#0b0e14] border border-white/[0.06]">
            <button
              onClick={() => setMode('media')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                mode === 'media'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Film className="w-4 h-4" />
              <span>Video / Âm thanh (70+ trang • yt-dlp)</span>
            </button>
            <button
              onClick={() => setMode('direct')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                mode === 'direct'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>File đa luồng / Torrent / Magnet (aria2)</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* URL input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                {mode === 'media'
                  ? 'Đường dẫn Video / Playlist (YouTube, TikTok, Facebook, Bilibili...)'
                  : 'Đường dẫn tải trực tiếp (HTTP/HTTPS/FTP/Magnet — mỗi dòng 1 link)'}
              </label>
              {mode === 'media' ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={downloadPlaylist}
                  onClick={() => {
                    skipAutoUrlRef.current = null;
                    setDownloadPlaylist((v) => !v);
                  }}
                  className="flex items-center gap-2 text-xs cursor-pointer group"
                  title="Tắt: chỉ tải 1 video đang dán • Bật: tải toàn bộ danh sách phát (Playlist)"
                >
                  <span
                    className={`font-medium transition-colors ${
                      downloadPlaylist ? 'text-amber-300' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  >
                    {downloadPlaylist ? 'Tải full danh sách' : 'Chỉ tải 1 video'}
                  </span>
                  <span
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      downloadPlaylist
                        ? 'bg-amber-500/80 border border-amber-400/60'
                        : 'bg-white/[0.1] border border-white/[0.12]'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
                        downloadPlaylist ? 'translate-x-4.5' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePaste}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  Dán link
                </button>
              )}
            </div>

            {mode === 'media' ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    skipAutoUrlRef.current = null;
                    setUrlInput(nextVal);
                    if (!nextVal.trim()) {
                      analyzeRequestIdRef.current += 1;
                      setAnalyzing(false);
                      setError(null);
                      setMediaInfo(null);
                      setWaveformPeaks([]);
                      scannedWaveForRef.current = null;
                      setShowDetailTrimmer(false);
                      setVolumePercent(100);
                    }
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && !analyzing && handleAnalyze()}
                  placeholder="Dán link video, nhạc hoặc playlist (YouTube, TikTok, Facebook...)..."
                  className="flex-1 bg-[#0b0e14] border border-white/[0.08] focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none"
                />
                {analyzing ? (
                  <button
                    type="button"
                    onClick={handleStopAnalyze}
                    className="px-4 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-xs font-semibold text-rose-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Dừng phân tích"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <Square className="w-3 h-3 fill-current" />
                    <span>Dừng</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAnalyze()}
                    className="px-4 py-2.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.08] text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Phân tích liên kết"
                  >
                    <Search className="w-4 h-4" />
                    <span>Phân tích</span>
                  </button>
                )}
              </div>
            ) : (
              <textarea
                rows={3}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/file.iso&#10;magnet:?xt=urn:btih:..."
                className="w-full bg-[#0b0e14] border border-white/[0.08] focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none resize-none font-mono"
              />
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Media Info Preview Card */}
          {mode === 'media' && mediaInfo && (
            <div className="rounded-xl bg-[#0b0e14] border border-indigo-500/25 p-3 flex gap-3.5 items-center">
              {mediaInfo.thumbnail ? (
                <img
                  src={mediaInfo.thumbnail}
                  alt={mediaInfo.title}
                  className="w-28 h-16 object-cover rounded-lg border border-white/10 shrink-0"
                />
              ) : (
                <div className="w-28 h-16 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Film className="w-6 h-6 text-indigo-400" />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    {mediaInfo.extractor}
                  </span>
                  {mediaInfo.isPlaylist && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      Playlist ({mediaInfo.playlistCount} mục)
                    </span>
                  )}
                  <span className="text-xs text-slate-400 font-mono">
                    {mediaInfo.durationText}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white truncate">{mediaInfo.title}</p>
                <p className="text-xs text-slate-400 truncate">{mediaInfo.uploader}</p>
              </div>
            </div>
          )}

          {/* Media Options */}
          {mode === 'media' ? (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1.5">
                    Định dạng
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {(['mp4', 'mkv', 'mp3', 'm4a', 'wav'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => {
                          setMediaFormat(fmt);
                          if (['mp3', 'm4a', 'wav'].includes(fmt)) {
                            setQuality('192');
                          } else {
                            setQuality(mediaInfo?.videoQualities[1]?.value || '1080');
                          }
                        }}
                        className={`py-2 rounded-lg text-[11px] font-bold uppercase border transition-all cursor-pointer ${
                          mediaFormat === fmt
                            ? 'bg-indigo-500/20 border-indigo-500 text-indigo-200'
                            : 'bg-[#0b0e14] border-white/[0.06] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1.5">
                    {isAudioFormat ? 'Bitrate âm thanh' : 'Độ phân giải video'}
                  </label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="w-full bg-[#0b0e14] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    {isAudioFormat ? (
                      <>
                        <option value="320">320 kbps (Cao nhất)</option>
                        <option value="192">192 kbps (Tiêu chuẩn)</option>
                        <option value="128">128 kbps (Nhẹ)</option>
                      </>
                    ) : mediaInfo ? (
                      mediaInfo.videoQualities.map((q) => (
                        <option key={q.value} value={q.value}>
                          {q.label}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="best">Tốt nhất tự động (lên tới 8K)</option>
                        <option value="2160">4K Ultra HD (2160p)</option>
                        <option value="1080">Full HD (1080p)</option>
                        <option value="720">HD (720p)</option>
                        <option value="480">480p</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Unified Detail Toggle for BOTH MP3/Audio & MP4/Video — hidden in full-playlist mode */}
              {hasAnalyzedMedia && !isPlaylistMode && (
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#0b0e14] border border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setShowDetailTrimmer((v) => !v)}
                    className="flex items-center gap-2 text-xs font-medium text-slate-200 hover:text-cyan-300 transition-colors cursor-pointer"
                  >
                    <Scissors className="w-4 h-4 text-cyan-400" />
                    <span>
                      {isAudioFormat
                        ? 'Hiển thị chi tiết MP3 / Âm thanh (Cắt đoạn • Sóng âm • Kích âm 200%)'
                        : 'Hiển thị chi tiết MP4 / Video (Xem trước • Cắt đoạn • Sóng âm • Zoom)'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDetailTrimmer((v) => !v)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all duration-200 cursor-pointer ${
                      showDetailTrimmer
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/35'
                        : 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 hover:bg-indigo-500/30'
                    }`}
                  >
                    {showDetailTrimmer ? 'Thu gọn' : 'Chi tiết'}
                  </button>
                </div>
              )}

              {/* Interactive Waveform / Video Timeline Trimmer */}
              {trimmerVisible && (
                <TimelineTrimmer
                  mode={isAudioFormat ? 'audio' : 'video'}
                  duration={totalDuration}
                  title={mediaInfo?.title}
                  audioUrl={mediaInfo?.audioStreamUrl}
                  videoUrl={mediaInfo?.videoStreamUrl}
                  videoHasAudio={mediaInfo?.videoHasAudio}
                  thumbnail={mediaInfo?.thumbnail}
                  peaks={waveformPeaks}
                  loadingPeaks={loadingPeaks}
                  expanded={isFullscreen}
                  startSec={trimStartSec}
                  endSec={trimEndSec}
                  volumePercent={volumePercent}
                  onChangeVolumePercent={setVolumePercent}
                  onChangeRange={(s, e) => {
                    setTrimStartSec(s);
                    setTrimEndSec(e);
                  }}
                />
              )}
            </div>
          ) : (
            /* Direct / Torrent Options (Motrix-style) */
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1.5">
                    Đổi tên file (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    placeholder="Tự động theo tên gốc"
                    className="w-full bg-[#0b0e14] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1.5">
                    Số luồng tải song song (aria2 split)
                  </label>
                  <select
                    value={splitThreads}
                    onChange={(e) => setSplitThreads(Number(e.target.value))}
                    className="w-full bg-[#0b0e14] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                  >
                    <option value={4}>4 luồng</option>
                    <option value={8}>8 luồng</option>
                    <option value={16}>16 luồng (Khuyên dùng)</option>
                    <option value={32}>32 luồng (Tối đa)</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddTorrentFile}
                className="w-full py-2.5 px-3 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Magnet className="w-4 h-4" />
                <span>Hoặc chọn file .torrent từ máy tính</span>
              </button>
            </div>
          )}

          {/* Save Directory */}
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">
              Thư mục lưu file
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={saveDir}
                onChange={(e) => setSaveDir(e.target.value)}
                className="flex-1 bg-[#0b0e14] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-slate-300 outline-none font-mono"
              />
              <button
                type="button"
                onClick={handleChooseDir}
                className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Chọn
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-white/[0.06] bg-[#0f141f] flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            {mode === 'media' ? (
              <>
                <Music className="w-3.5 h-3.5 text-indigo-400" />
                <span>Chạy bằng yt-dlp + FFmpeg trực tiếp trên IP máy bạn</span>
              </>
            ) : (
              <>
                <FileArchive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Chạy bằng aria2c JSON-RPC đa luồng + Resume</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleStartDownload}
              className={`px-5 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-2 shadow-lg transition-all disabled:opacity-50 cursor-pointer ${
                mode === 'media'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-600/25'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/25'
              }`}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Bắt đầu tải</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
