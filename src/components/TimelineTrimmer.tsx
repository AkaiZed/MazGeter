import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  Volume2,
  ZoomIn,
} from 'lucide-react';

interface TimelineTrimmerProps {
  mode: 'audio' | 'video';
  duration: number; // total seconds (fallback 60 if not analyzed yet)
  title?: string;
  audioUrl?: string | null;
  videoUrl?: string | null;
  thumbnail?: string | null;
  peaks: number[];
  loadingPeaks?: boolean;
  startSec: number;
  endSec: number;
  onChangeRange: (start: number, end: number) => void;
}

export function formatPreciseTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00.0';
  const totalTenths = Math.round(sec * 10);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}.${tenths}`;
  return `${pad(m)}:${pad(s)}.${tenths}`;
}

export function parsePreciseTime(str: string): number | null {
  const cleaned = str.trim();
  if (!cleaned) return null;
  const parts = cleaned.split(':').map((p) => parseFloat(p));
  if (parts.some((n) => Number.isNaN(n) || n < 0)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

// Fallback smooth waveform when link hasn't been analyzed yet
function generatePlaceholderPeaks(count: number): number[] {
  const arr: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    // Simulate realistic speech bursts + JLPT pause gaps
    const burst = Math.sin(t * 24) > -0.35 ? 1 : 0.12;
    const wave =
      0.35 +
      0.35 * Math.abs(Math.sin(i * 0.43)) +
      0.25 * Math.abs(Math.cos(i * 0.19));
    arr.push(Number(Math.min(1, Math.max(0.06, wave * burst)).toFixed(3)));
  }
  return arr;
}

export const TimelineTrimmer: React.FC<TimelineTrimmerProps> = ({
  mode,
  duration,
  title,
  audioUrl,
  videoUrl,
  thumbnail,
  peaks,
  loadingPeaks,
  startSec,
  endSec,
  onChangeRange,
}) => {
  const safeDuration = Math.max(1, duration || 60);
  const [zoom, setZoom] = useState(1); // 1x -> 20x (CapCut style)
  const [viewStart, setViewStart] = useState(0); // visible window start in seconds
  const [playhead, setPlayhead] = useState(startSec);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dragging, setDragging] = useState<'start' | 'end' | 'playhead' | null>(null);

  // Editable text inputs synced with startSec / endSec
  const [startText, setStartText] = useState(formatPreciseTime(startSec));
  const [endText, setEndText] = useState(formatPreciseTime(endSec));

  const trackRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const visibleSpan = safeDuration / zoom;
  const viewEnd = Math.min(safeDuration, viewStart + visibleSpan);

  const displayPeaks = useMemo(() => {
    return peaks.length > 10 ? peaks : generatePlaceholderPeaks(220);
  }, [peaks]);

  // Sync text fields when props change
  useEffect(() => {
    setStartText(formatPreciseTime(startSec));
  }, [startSec]);

  useEffect(() => {
    setEndText(formatPreciseTime(endSec));
  }, [endSec]);

  // Reset zoom/view when duration changes
  useEffect(() => {
    setZoom(1);
    setViewStart(0);
    setPlayhead(0);
    setIsPlaying(false);
  }, [safeDuration, audioUrl, videoUrl]);

  const activeMediaEl = mode === 'video' && videoUrl ? videoRef.current : audioRef.current;

  const seekMedia = useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(safeDuration, time));
      setPlayhead(clamped);
      const el = mode === 'video' && videoUrl ? videoRef.current : audioRef.current;
      if (el && Number.isFinite(el.duration || safeDuration)) {
        try {
          el.currentTime = clamped;
        } catch {
          // ignore if metadata not loaded yet
        }
      }
    },
    [mode, videoUrl, safeDuration]
  );

  // Playback loop bounded to [startSec, endSec]
  useEffect(() => {
    const el = activeMediaEl;
    if (!el) return;
    const onTimeUpdate = () => {
      const t = el.currentTime;
      setPlayhead(t);
      if (t >= endSec) {
        el.pause();
        el.currentTime = startSec;
        setPlayhead(startSec);
        setIsPlaying(false);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
    };
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
    };
  }, [activeMediaEl, startSec, endSec]);

  const togglePlay = () => {
    const el = mode === 'video' && videoUrl ? videoRef.current : audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      if (playhead < startSec || playhead >= endSec - 0.1) {
        el.currentTime = startSec;
        setPlayhead(startSec);
      }
      el.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  // Convert clientX on track to time in seconds
  const clientXToTime = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return 0;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const t = viewStart + ratio * visibleSpan;
      return Math.max(0, Math.min(safeDuration, Number(t.toFixed(1))));
    },
    [viewStart, visibleSpan, safeDuration]
  );

  // Dragging handles smoothly
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const t = clientXToTime(e.clientX);
      if (dragging === 'start') {
        const nextStart = Math.min(t, Math.max(0, endSec - 0.2));
        onChangeRange(nextStart, endSec);
        seekMedia(nextStart);
      } else if (dragging === 'end') {
        const nextEnd = Math.max(t, Math.min(safeDuration, startSec + 0.2));
        onChangeRange(startSec, nextEnd);
        seekMedia(nextEnd);
      } else if (dragging === 'playhead') {
        seekMedia(t);
      }
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, clientXToTime, startSec, endSec, safeDuration, onChangeRange, seekMedia]);

  // CapCut-style Mouse Wheel Zoom (works on both waveform & video preview)
  const handleWheelZoom = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = trackRef.current?.getBoundingClientRect();
    let anchorRatio = 0.5;
    if (rect && rect.width > 0 && e.clientX >= rect.left && e.clientX <= rect.right) {
      anchorRatio = (e.clientX - rect.left) / rect.width;
    } else {
      // If wheel is over the video preview, anchor around current playhead
      anchorRatio = Math.max(0, Math.min(1, (playhead - viewStart) / visibleSpan));
    }

    const anchorTime = viewStart + anchorRatio * visibleSpan;
    const factor = e.deltaY < 0 ? 1.3 : 1 / 1.3;
    const nextZoom = Math.max(1, Math.min(20, Number((zoom * factor).toFixed(2))));
    const nextSpan = safeDuration / nextZoom;
    const nextViewStart = Math.max(
      0,
      Math.min(safeDuration - nextSpan, anchorTime - anchorRatio * nextSpan)
    );

    setZoom(nextZoom);
    setViewStart(nextZoom === 1 ? 0 : nextViewStart);
  };

  const timeToPercent = (t: number) => {
    return ((t - viewStart) / visibleSpan) * 100;
  };

  const startPct = timeToPercent(startSec);
  const endPct = timeToPercent(endSec);
  const playheadPct = timeToPercent(playhead);

  const handleReset = () => {
    onChangeRange(0, safeDuration);
    setZoom(1);
    setViewStart(0);
    seekMedia(0);
    if (isPlaying) {
      activeMediaEl?.pause();
      setIsPlaying(false);
    }
  };

  const commitStartInput = () => {
    const parsed = parsePreciseTime(startText);
    if (parsed !== null) {
      const clamped = Math.max(0, Math.min(parsed, endSec - 0.2));
      onChangeRange(Number(clamped.toFixed(1)), endSec);
      seekMedia(clamped);
    } else {
      setStartText(formatPreciseTime(startSec));
    }
  };

  const commitEndInput = () => {
    const parsed = parsePreciseTime(endText);
    if (parsed !== null) {
      const clamped = Math.min(safeDuration, Math.max(parsed, startSec + 0.2));
      onChangeRange(startSec, Number(clamped.toFixed(1)));
      seekMedia(clamped);
    } else {
      setEndText(formatPreciseTime(endSec));
    }
  };

  // Slice visible waveform bars according to zoom window
  const visibleBars = useMemo(() => {
    const total = displayPeaks.length;
    const iStart = Math.floor((viewStart / safeDuration) * total);
    const iEnd = Math.max(iStart + 4, Math.ceil((viewEnd / safeDuration) * total));
    return displayPeaks.slice(iStart, iEnd);
  }, [displayPeaks, viewStart, viewEnd, safeDuration]);

  const canPlayPreview = Boolean(mode === 'video' ? videoUrl || audioUrl : audioUrl);

  return (
    <div className="rounded-xl bg-[#0a192f] border border-cyan-500/20 overflow-hidden select-none">
      {/* Hidden Audio element for MP3/Audio mode */}
      {mode === 'audio' && audioUrl && (
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
      )}

      {/* Top Strip: Mode Label + Zoom Indicator + Reset */}
      <div className="px-3.5 py-2 bg-[#081324] border-b border-white/[0.06] flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2 text-cyan-300 font-medium">
          <Scissors className="w-3.5 h-3.5" />
          <span>
            {mode === 'audio'
              ? 'Cắt âm thanh • Sóng âm (Ngắt quãng JLPT)'
              : 'Cắt đoạn Video • Cuộn chuột để phóng to tinh chỉnh'}
          </span>
          {loadingPeaks && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-300/90 ml-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Đang quét sóng âm...
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`flex items-center gap-1 font-mono px-1.5 py-0.5 rounded ${
              zoom > 1
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400'
            }`}
            title="Di con lăn chuột trên thanh cắt hoặc video để phóng to (CapCut style)"
          >
            <ZoomIn className="w-3 h-3" />
            {zoom.toFixed(1)}x
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Đặt lại</span>
          </button>
        </div>
      </div>

      {/* Video Preview Area (only in Video mode — wheel zooms timeline CapCut-style!) */}
      {mode === 'video' && (
        <div
          onWheel={handleWheelZoom}
          className="relative bg-black/70 flex items-center justify-center h-36 border-b border-white/[0.06] overflow-hidden group"
          title="Cuộn con lăn chuột ở đây để phóng to trục thời gian kiểu CapCut"
        >
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              preload="metadata"
              playsInline
              className="h-full max-w-full object-contain"
            />
          ) : thumbnail ? (
            <img
              src={thumbnail}
              alt={title || 'Video preview'}
              className="h-full max-w-full object-contain opacity-80"
            />
          ) : (
            <div className="text-xs text-slate-500 flex flex-col items-center gap-1">
              <span>Dán link & bấm Phân tích để xem khung hình video trực tiếp</span>
            </div>
          )}

          {/* Subtle CapCut zoom hint overlay */}
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/65 backdrop-blur text-[10px] text-cyan-300 border border-white/10 pointer-events-none">
            {formatPreciseTime(playhead)} • Lăn chuột để zoom ({zoom.toFixed(1)}x)
          </div>
        </div>
      )}

      {/* Waveform / Timeline Track (mp3cut.net style) */}
      <div className="px-3.5 pt-4 pb-2">
        <div
          ref={trackRef}
          onWheel={handleWheelZoom}
          onMouseDown={(e) => {
            // Click directly on track moves playhead
            const t = clientXToTime(e.clientX);
            seekMedia(t);
            setDragging('playhead');
          }}
          className="relative h-24 rounded-lg bg-[#0d2748] border border-cyan-400/20 overflow-hidden cursor-crosshair"
        >
          {/* Optional filename watermark like mp3cut.net */}
          {title && (
            <div className="absolute top-1.5 inset-x-0 text-center text-[10px] text-cyan-200/40 truncate px-8 pointer-events-none">
              {title}
            </div>
          )}

          {/* Waveform Bars (vivid green on navy, showing silence gaps clearly) */}
          <div className="absolute inset-0 flex items-center justify-between gap-[1px] px-1 pointer-events-none">
            {visibleBars.map((peak, idx) => {
              const barHeightPct = Math.max(5, Math.round(peak * 86));
              return (
                <div
                  key={idx}
                  className="flex-1 rounded-full transition-[height] duration-150"
                  style={{
                    height: `${barHeightPct}%`,
                    backgroundColor:
                      mode === 'audio' ? '#10f26b' : 'rgba(56, 189, 248, 0.72)',
                    opacity: peak < 0.09 ? 0.35 : 0.92,
                  }}
                />
              );
            })}
          </div>

          {/* Left Trimmed-out Dimmed Overlay */}
          {startPct > 0 && (
            <div
              className="absolute inset-y-0 left-0 bg-[#040b16]/75 pointer-events-none"
              style={{ width: `${Math.min(100, Math.max(0, startPct))}%` }}
            />
          )}

          {/* Right Trimmed-out Dimmed Overlay */}
          {endPct < 100 && (
            <div
              className="absolute inset-y-0 right-0 bg-[#040b16]/75 pointer-events-none"
              style={{ width: `${Math.min(100, Math.max(0, 100 - endPct))}%` }}
            />
          )}

          {/* Active Selection Top/Bottom Cyan Border */}
          <div
            className="absolute inset-y-0 border-y-2 border-cyan-400/80 pointer-events-none"
            style={{
              left: `${Math.max(0, startPct)}%`,
              width: `${Math.max(0, Math.min(100, endPct) - Math.max(0, startPct))}%`,
            }}
          />

          {/* Left Start Handle (Cyan Bar) */}
          {startPct >= -2 && startPct <= 102 && (
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                setDragging('start');
              }}
              style={{ left: `${startPct}%` }}
              className="absolute inset-y-0 -translate-x-1/2 w-3.5 flex items-center justify-center cursor-ew-resize z-20 group"
              title={`Điểm đầu: ${formatPreciseTime(startSec)}`}
            >
              <div className="w-1.5 h-full bg-cyan-400 group-hover:bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.85)] rounded-full" />
            </div>
          )}

          {/* Right End Handle (Cyan Bar) */}
          {endPct >= -2 && endPct <= 102 && (
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                setDragging('end');
              }}
              style={{ left: `${endPct}%` }}
              className="absolute inset-y-0 -translate-x-1/2 w-3.5 flex items-center justify-center cursor-ew-resize z-20 group"
              title={`Điểm cuối: ${formatPreciseTime(endSec)}`}
            >
              <div className="w-1.5 h-full bg-cyan-400 group-hover:bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.85)] rounded-full" />
            </div>
          )}

          {/* Playhead Needle + White Cap (mp3cut.net style) */}
          {playheadPct >= 0 && playheadPct <= 100 && (
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                setDragging('playhead');
              }}
              style={{ left: `${playheadPct}%` }}
              className="absolute inset-y-0 -translate-x-1/2 flex flex-col items-center z-30 cursor-grab active:cursor-grabbing"
            >
              <div className="w-5 h-2.5 rounded-b-md bg-white shadow-md" />
              <div className="w-[1.5px] flex-1 bg-white/90" />
            </div>
          )}
        </div>

        {/* Time endpoints + Zoom Pan Slider */}
        <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-cyan-300/75">
          <span>{formatPreciseTime(viewStart)}</span>
          {zoom > 1 ? (
            <input
              type="range"
              min={0}
              max={Math.max(0.1, safeDuration - visibleSpan)}
              step={0.1}
              value={viewStart}
              onChange={(e) => setViewStart(parseFloat(e.target.value))}
              className="w-1/2 h-1 accent-cyan-400 cursor-pointer"
              title="Trượt để di chuyển vùng đang phóng to"
            />
          ) : (
            <span className="text-slate-500">
              Đoạn chọn: {formatPreciseTime(Math.max(0, endSec - startSec))}
            </span>
          )}
          <span>{formatPreciseTime(viewEnd)}</span>
        </div>
      </div>

      {/* Bottom Minimalist Control Bar (matching Hình 2) */}
      <div className="px-3.5 py-2.5 bg-[#081324] border-t border-white/[0.06] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={!canPlayPreview}
            onClick={togglePlay}
            className="w-9 h-8 rounded-lg bg-[#132645] hover:bg-[#1a335c] border border-white/10 text-white flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
            title={
              canPlayPreview
                ? 'Nghe / Xem thử đoạn đã chọn'
                : 'Bấm Phân tích link trước để nghe thử trực tiếp'
            }
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-white" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
            )}
          </button>

          {/* Compact Start - End time pill (exact Hình 2 vibe) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0d1c33] border border-white/10">
            <input
              type="text"
              value={startText}
              onChange={(e) => setStartText(e.target.value)}
              onBlur={commitStartInput}
              onKeyDown={(e) => e.key === 'Enter' && commitStartInput()}
              className="w-16 bg-transparent text-xs font-mono text-cyan-200 text-center outline-none"
              title="Thời gian bắt đầu (mm:ss.d)"
            />
            <span className="text-slate-500 text-xs">–</span>
            <input
              type="text"
              value={endText}
              onChange={(e) => setEndText(e.target.value)}
              onBlur={commitEndInput}
              onKeyDown={(e) => e.key === 'Enter' && commitEndInput()}
              className="w-16 bg-transparent text-xs font-mono text-cyan-200 text-center outline-none"
              title="Thời gian kết thúc (mm:ss.d)"
            />
          </div>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            {canPlayPreview
              ? 'Kéo 2 thanh xanh hoặc lăn chuột để căn chỉnh'
              : 'Bấm Phân tích để tải sóng âm thật'}
          </span>
        </div>
      </div>
    </div>
  );
};
