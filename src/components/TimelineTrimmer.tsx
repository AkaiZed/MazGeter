import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Gauge,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Volume1,
  Volume2,
  VolumeX,
  ZoomIn,
} from 'lucide-react';

interface TimelineTrimmerProps {
  mode: 'audio' | 'video';
  duration: number; // total seconds (fallback 60 if not analyzed yet)
  title?: string;
  audioUrl?: string | null;
  videoUrl?: string | null;
  videoHasAudio?: boolean;
  thumbnail?: string | null;
  peaks: number[];
  loadingPeaks?: boolean;
  expanded?: boolean;
  startSec: number;
  endSec: number;
  volumePercent?: number;
  onChangeVolumePercent?: (percent: number) => void;
  onChangeRange: (start: number, end: number) => void;
}

// Persistent per-element Web Audio GainNode map for true 0% - 200% in-app audio boost
const mediaGainMap = new WeakMap<
  HTMLMediaElement,
  { ctx: AudioContext; gain: GainNode }
>();

function ensureMediaGainNode(
  el: HTMLMediaElement
): { ctx: AudioContext; gain: GainNode } | null {
  const existing = mediaGainMap.get(el);
  if (existing) return existing;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    const source = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    source.connect(gain);
    gain.connect(ctx.destination);
    const entry = { ctx, gain };
    mediaGainMap.set(el, entry);
    return entry;
  } catch {
    return null;
  }
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
  videoHasAudio = false,
  thumbnail,
  peaks,
  loadingPeaks,
  expanded = false,
  startSec,
  endSec,
  volumePercent,
  onChangeVolumePercent,
  onChangeRange,
}) => {
  const safeDuration = Math.max(1, duration || 60);
  const [zoom, setZoom] = useState(1); // 1x -> 20x (CapCut style)
  const [viewStart, setViewStart] = useState(0); // visible window start in seconds
  const [playhead, setPlayhead] = useState(startSec);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dragging, setDragging] = useState<'start' | 'end' | 'playhead' | null>(null);
  const [volume, setVolumeState] = useState(() =>
    typeof volumePercent === 'number' ? Math.max(0, Math.min(2, volumePercent / 100)) : 1
  );
  const [isMuted, setIsMuted] = useState(false);

  const setVolume = useCallback(
    (nextVal: number) => {
      const clamped = Math.max(0, Math.min(2, Math.round(nextVal * 100) / 100));
      setVolumeState(clamped);
      onChangeVolumePercent?.(Math.round(clamped * 100));
    },
    [onChangeVolumePercent]
  );

  useEffect(() => {
    if (typeof volumePercent === 'number') {
      const synced = Math.max(0, Math.min(2, volumePercent / 100));
      setVolumeState(synced);
    }
  }, [volumePercent]);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [speedText, setSpeedText] = useState('1');
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [panDragging, setPanDragging] = useState(false);

  // Editable text inputs synced with startSec / endSec
  const [startText, setStartText] = useState(formatPreciseTime(startSec));
  const [endText, setEndText] = useState(formatPreciseTime(endSec));

  const trackRef = useRef<HTMLDivElement | null>(null);
  const videoAreaRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const speedBoxRef = useRef<HTMLDivElement | null>(null);
  const panBarRef = useRef<HTMLDivElement | null>(null);
  const volumeBoxRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const visibleSpan = safeDuration / zoom;
  const viewEnd = Math.min(safeDuration, viewStart + visibleSpan);

  const displayPeaks = useMemo(() => {
    return peaks.length > 10 ? peaks : generatePlaceholderPeaks(3200);
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

  const needsSeparateAudio = mode === 'audio' || (mode === 'video' && !videoHasAudio);
  const soundEl = needsSeparateAudio && audioUrl ? audioRef.current : videoRef.current;
  const activeMediaEl = mode === 'video' && videoUrl ? videoRef.current : audioRef.current;

  // Sync in-app player volume (0-200% via Web Audio GainNode), mute & playback speed
  useEffect(() => {
    const vEl = videoRef.current;
    const aEl = audioRef.current;

    if (vEl) {
      vEl.playbackRate = playbackSpeed;
      if (mode === 'video' && !videoHasAudio && aEl) {
        vEl.muted = true;
      }
    }
    if (aEl) {
      aEl.playbackRate = playbackSpeed;
    }

    const targetSoundEl = needsSeparateAudio && aEl ? aEl : vEl;
    if (!targetSoundEl) return;
    targetSoundEl.muted = isMuted;

    const effective = isMuted ? 0 : volume;
    if (effective > 1) {
      const node = ensureMediaGainNode(targetSoundEl);
      if (node) {
        targetSoundEl.volume = 1;
        node.gain.gain.value = effective;
        if (node.ctx.state === 'suspended') {
          node.ctx.resume().catch(() => {});
        }
        return;
      }
    } else {
      const existing = mediaGainMap.get(targetSoundEl);
      if (existing) {
        targetSoundEl.volume = 1;
        existing.gain.gain.value = effective;
        return;
      }
    }
    targetSoundEl.volume = Math.min(1, effective);
  }, [mode, videoUrl, audioUrl, videoHasAudio, needsSeparateAudio, volume, isMuted, playbackSpeed]);

  const seekMedia = useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(safeDuration, time));
      setPlayhead(clamped);
      const targets = [audioRef.current, videoRef.current].filter(Boolean) as HTMLMediaElement[];
      for (const el of targets) {
        if (Number.isFinite(el.duration || safeDuration)) {
          try {
            el.currentTime = clamped;
          } catch {
            // ignore if metadata not loaded yet
          }
        }
      }
    },
    [safeDuration]
  );

  // Playback loop bounded to [startSec, endSec] + keep DASH video synced to audio clock
  useEffect(() => {
    const masterEl = (needsSeparateAudio && audioRef.current) ? audioRef.current : activeMediaEl;
    if (!masterEl) return;
    const onTimeUpdate = () => {
      const t = masterEl.currentTime;
      setPlayhead(t);
      if (mode === 'video' && !videoHasAudio && videoRef.current && audioRef.current) {
        if (Math.abs(videoRef.current.currentTime - t) > 0.35) {
          try {
            videoRef.current.currentTime = t;
          } catch {
            // ignore
          }
        }
      }
      if (t >= endSec) {
        audioRef.current?.pause();
        videoRef.current?.pause();
        seekMedia(startSec);
        setIsPlaying(false);
      }
    };
    const onEnded = () => {
      audioRef.current?.pause();
      videoRef.current?.pause();
      setIsPlaying(false);
    };
    masterEl.addEventListener('timeupdate', onTimeUpdate);
    masterEl.addEventListener('ended', onEnded);
    return () => {
      masterEl.removeEventListener('timeupdate', onTimeUpdate);
      masterEl.removeEventListener('ended', onEnded);
    };
  }, [activeMediaEl, soundEl, mode, videoHasAudio, needsSeparateAudio, startSec, endSec, seekMedia]);

  const togglePlay = () => {
    const vEl = mode === 'video' && videoUrl ? videoRef.current : null;
    const aEl = needsSeparateAudio && audioUrl ? audioRef.current : null;
    const primary = aEl || vEl;
    if (!primary) return;

    if (isPlaying) {
      aEl?.pause();
      vEl?.pause();
      setIsPlaying(false);
    } else {
      const targetStart = playhead < startSec || playhead >= endSec - 0.1 ? startSec : playhead;
      if (aEl) aEl.currentTime = targetStart;
      if (vEl) vEl.currentTime = targetStart;
      setPlayhead(targetStart);

      const plays: Array<Promise<void>> = [];
      if (aEl) plays.push(aEl.play());
      if (vEl) plays.push(vEl.play());
      Promise.all(plays)
        .then(() => setIsPlaying(true))
        .catch(() => {
          // If one stream failed, try keeping the other playing
          if (primary && !primary.paused) setIsPlaying(true);
          else setIsPlaying(false);
        });
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

  // Non-passive native wheel listener on Volume control (scroll up/down ±5% without scrolling modal)
  const volStateRef = useRef({ volume, isMuted });
  volStateRef.current = { volume, isMuted };

  useEffect(() => {
    const volEl = volumeBoxRef.current;
    if (!volEl) return;
    const onVolWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const { volume: curVol, isMuted: curMuted } = volStateRef.current;
      const base = curMuted ? 0 : curVol;
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      const next = Math.max(0, Math.min(2, Math.round((base + delta) * 100) / 100));
      setVolume(next);
      setIsMuted(next === 0);
    };
    volEl.addEventListener('wheel', onVolWheel, { passive: false });
    return () => volEl.removeEventListener('wheel', onVolWheel);
  }, [setVolume]);

  // Non-passive native wheel listener so outer modal/page NEVER scrolls when zooming waveform
  const zoomStateRef = useRef({ zoom, viewStart, visibleSpan, safeDuration, playhead });
  zoomStateRef.current = { zoom, viewStart, visibleSpan, safeDuration, playhead };

  useEffect(() => {
    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const { zoom: curZoom, viewStart: curViewStart, visibleSpan: curSpan, safeDuration: curDur, playhead: curPlay } =
        zoomStateRef.current;

      const rect = trackRef.current?.getBoundingClientRect();
      let anchorRatio = 0.5;
      if (rect && rect.width > 0 && e.clientX >= rect.left && e.clientX <= rect.right) {
        anchorRatio = (e.clientX - rect.left) / rect.width;
      } else {
        anchorRatio = Math.max(0, Math.min(1, (curPlay - curViewStart) / curSpan));
      }

      const anchorTime = curViewStart + anchorRatio * curSpan;
      const factor = e.deltaY < 0 ? 1.3 : 1 / 1.3;
      const nextZoom = Math.max(1, Math.min(20, Number((curZoom * factor).toFixed(2))));
      const nextSpan = curDur / nextZoom;
      const nextViewStart = Math.max(
        0,
        Math.min(curDur - nextSpan, anchorTime - anchorRatio * nextSpan)
      );

      setZoom(nextZoom);
      setViewStart(nextZoom === 1 ? 0 : nextViewStart);
    };

    const trackEl = trackRef.current;
    const videoEl = videoAreaRef.current;
    trackEl?.addEventListener('wheel', onNativeWheel, { passive: false });
    videoEl?.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      trackEl?.removeEventListener('wheel', onNativeWheel);
      videoEl?.removeEventListener('wheel', onNativeWheel);
    };
  }, [mode, expanded]);

  // High-density continuous Canvas waveform (matching Hình 2)
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const track = trackRef.current;
    if (!canvas || !track) return;

    const width = track.clientWidth;
    const height = track.clientHeight;
    if (width <= 0 || height <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.floor(width * dpr);
    const targetH = Math.floor(height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const midY = height / 2;
    const total = displayPeaks.length;

    // Subtle vertical beat/time grid lines
    const gridCount = Math.max(6, Math.min(24, Math.floor(width / 48)));
    ctx.strokeStyle = 'rgba(16, 242, 107, 0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let g = 1; g < gridCount; g++) {
      const gx = Math.round((g / gridCount) * width) + 0.5;
      ctx.moveTo(gx, 6);
      ctx.lineTo(gx, height - 6);
    }
    ctx.stroke();

    // Subtle center axis
    ctx.fillStyle = mode === 'audio' ? 'rgba(16, 242, 107, 0.3)' : 'rgba(56, 189, 248, 0.3)';
    ctx.fillRect(0, midY - 0.5, width, 1);

    // Crisp 1px vertical bars every 1px (mp3cut.net style: dense clusters + crisp valleys + solid baseline)
    const maxHalfH = height * 0.36;
    const barStep = 1;
    const barWidth = 1;
    const barColor = mode === 'audio' ? '#10f26b' : 'rgba(56, 189, 248, 0.9)';
    const coreColor = mode === 'audio' ? 'rgba(167, 255, 203, 0.35)' : 'rgba(186, 230, 253, 0.3)';

    // Continuous solid center baseline so silent parts never look dotted
    ctx.fillStyle = barColor;
    ctx.fillRect(0, midY - 0.75, width, 1.5);

    for (let x = 0; x < width; x += barStep) {
      const t = viewStart + (x / width) * visibleSpan;
      const exactIdx = (t / safeDuration) * (total - 1);
      const i0 = Math.max(0, Math.min(total - 1, Math.floor(exactIdx)));
      const i1 = Math.max(0, Math.min(total - 1, i0 + 1));
      const frac = exactIdx - i0;
      const peak = displayPeaks[i0] * (1 - frac) + displayPeaks[i1] * frac;

      if (peak >= 0.03) {
        const halfH = Math.max(1.2, peak * maxHalfH);
        ctx.fillRect(x, midY - halfH, barWidth, halfH * 2);
      }
    }

    // Subtle crisp inner highlight along the waveform spine
    ctx.fillStyle = coreColor;
    for (let x = 0; x < width; x += barStep) {
      const t = viewStart + (x / width) * visibleSpan;
      const exactIdx = (t / safeDuration) * (total - 1);
      const i0 = Math.max(0, Math.min(total - 1, Math.floor(exactIdx)));
      const i1 = Math.max(0, Math.min(total - 1, i0 + 1));
      const frac = exactIdx - i0;
      const peak = displayPeaks[i0] * (1 - frac) + displayPeaks[i1] * frac;

      if (peak >= 0.08) {
        const innerH = peak * maxHalfH * 0.42;
        ctx.fillRect(x, midY - innerH, barWidth, innerH * 2);
      }
    }
  }, [displayPeaks, viewStart, visibleSpan, safeDuration, mode]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => drawWaveform());
    ro.observe(track);
    return () => ro.disconnect();
  }, [drawWaveform]);

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
    setVolume(1);
    setIsMuted(false);
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

  const applySpeedValue = (val: number) => {
    const clamped = Math.max(0.1, Math.min(10, Math.round(val * 100) / 100));
    setPlaybackSpeed(clamped);
    setSpeedText(String(clamped));
  };

  const handleSpeedInputChange = (raw: string) => {
    // Allow only digits and at most one decimal dot (no '-', no letters, no symbols)
    const digitsAndDots = raw.replace(/[^0-9.]/g, '');
    const firstDot = digitsAndDots.indexOf('.');
    const sanitized =
      firstDot === -1
        ? digitsAndDots
        : digitsAndDots.slice(0, firstDot + 1) + digitsAndDots.slice(firstDot + 1).replace(/\./g, '');

    setSpeedText(sanitized);
    if (sanitized !== '' && sanitized !== '.') {
      const parsed = parseFloat(sanitized);
      if (Number.isFinite(parsed) && parsed >= 0.1 && parsed <= 10) {
        setPlaybackSpeed(Math.round(parsed * 100) / 100);
      }
    }
  };

  const commitSpeedInput = () => {
    const parsed = parseFloat(speedText);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setSpeedText(String(playbackSpeed));
      return;
    }
    applySpeedValue(parsed);
  };

  // Close speed dropdown on outside click
  useEffect(() => {
    if (!speedMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (speedBoxRef.current && !speedBoxRef.current.contains(e.target as Node)) {
        setSpeedMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [speedMenuOpen]);

  // Dragging zoom-pan scrollbar thumb
  useEffect(() => {
    if (!panDragging) return;
    const updatePan = (clientX: number) => {
      const rect = panBarRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const centeredStart = ratio * safeDuration - visibleSpan / 2;
      setViewStart(Math.max(0, Math.min(safeDuration - visibleSpan, centeredStart)));
    };
    const onMove = (e: MouseEvent) => updatePan(e.clientX);
    const onUp = () => setPanDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [panDragging, safeDuration, visibleSpan]);

  const canPlayPreview = Boolean(mode === 'video' ? videoUrl || audioUrl : audioUrl);

  return (
    <div className="rounded-xl bg-[#0a192f] border border-cyan-500/20 select-none relative">
      {/* Hidden Audio element (used in Audio mode AND synced with DASH video-only streams in Video mode) */}
      {needsSeparateAudio && audioUrl && (
        <audio ref={audioRef} src={audioUrl} crossOrigin="anonymous" preload="metadata" />
      )}

      {/* Top Strip: Compact Split Speed Button (Hình 2) + Zoom Indicator + Reset */}
      <div className="px-3.5 py-2 bg-[#081324] rounded-t-xl border-b border-white/[0.06] flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2.5">
          {/* Split-button Speed Control (like GitHub Star button in Hình 2) */}
          <div ref={speedBoxRef} className="relative">
            <div
              className="inline-flex items-center rounded-lg bg-[#0d1c33] border border-white/15 overflow-hidden focus-within:border-cyan-400/70"
              title="Tốc độ phát (0.1x – 10x): nhập số trực tiếp hoặc bấm mũi tên để chọn nhanh"
            >
              <div className="flex items-center gap-1 pl-2 pr-1.5 py-1">
                <Gauge className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <input
                  type="text"
                  inputMode="decimal"
                  value={speedText}
                  onChange={(e) => handleSpeedInputChange(e.target.value)}
                  onBlur={commitSpeedInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitSpeedInput();
                      (e.currentTarget as HTMLInputElement).blur();
                    }
                  }}
                  className="w-8 bg-transparent text-white font-mono text-[11px] font-semibold text-center outline-none"
                  placeholder="1"
                />
                <span className="text-slate-400 font-mono text-[10.5px]">x</span>
              </div>
              <button
                type="button"
                onClick={() => setSpeedMenuOpen((v) => !v)}
                className="px-1.5 py-1.5 border-l border-white/15 text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer flex items-center justify-center"
                title="Chọn nhanh tốc độ phát"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {speedMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-32 rounded-lg bg-[#0b1729] border border-cyan-500/30 shadow-2xl py-1 z-50">
                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 5, 10].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      applySpeedValue(preset);
                      setSpeedMenuOpen(false);
                    }}
                    className={`w-full px-3 py-1 text-left font-mono text-[11px] flex items-center justify-between transition-colors cursor-pointer ${
                      playbackSpeed === preset
                        ? 'bg-cyan-500/20 text-cyan-200 font-semibold'
                        : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <span>{preset}x</span>
                    {preset === 1 && <span className="text-[9.5px] text-slate-400">Chuẩn</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loadingPeaks && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-300/90">
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
          ref={videoAreaRef}
          className={`relative bg-black/70 flex items-center justify-center ${
            expanded ? 'h-56' : 'h-36'
          } border-b border-white/[0.06] overflow-hidden group transition-all`}
          title="Cuộn con lăn chuột ở đây để phóng to trục thời gian kiểu CapCut"
        >
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              crossOrigin="anonymous"
              muted={!videoHasAudio}
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

      {/* Waveform / Timeline Track (mp3cut.net dense style) */}
      <div className="px-3.5 pt-4 pb-2">
        <div
          ref={trackRef}
          onMouseDown={(e) => {
            // Click directly on track moves playhead
            const t = clientXToTime(e.clientX);
            seekMedia(t);
            setDragging('playhead');
          }}
          className="relative h-28 rounded-lg bg-[#0b2545] border border-cyan-400/20 overflow-hidden cursor-crosshair transition-all"
        >
          {/* Optional filename watermark like mp3cut.net */}
          {title && (
            <div className="absolute top-1.5 inset-x-0 text-center text-[10px] text-cyan-200/45 truncate px-8 pointer-events-none z-10">
              {title}
            </div>
          )}

          {/* High-resolution Canvas Waveform */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

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
          {/* Off-screen Start/End Handle Indicators when zoomed in */}
          {startPct < 0 && (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setViewStart(Math.max(0, startSec - visibleSpan * 0.15))}
              className="absolute left-1.5 bottom-1.5 px-1.5 py-0.5 rounded bg-cyan-950/90 border border-cyan-400/40 text-[9.5px] font-mono text-cyan-200 hover:bg-cyan-900 z-30 cursor-pointer"
              title="Bấm để nhảy tới điểm đầu đang nằm ngoài khung nhìn"
            >
              ← Đầu: {formatPreciseTime(startSec)}
            </button>
          )}
          {endPct > 100 && (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() =>
                setViewStart(Math.min(safeDuration - visibleSpan, endSec - visibleSpan * 0.85))
              }
              className="absolute right-1.5 bottom-1.5 px-1.5 py-0.5 rounded bg-cyan-950/90 border border-cyan-400/40 text-[9.5px] font-mono text-cyan-200 hover:bg-cyan-900 z-30 cursor-pointer"
              title="Bấm để nhảy tới điểm cuối đang nằm ngoài khung nhìn"
            >
              Cuối: {formatPreciseTime(endSec)} →
            </button>
          )}
        </div>

        {/* Distinct Zoom Scrollbar (NOT a player seekbar) — only appears when zoom > 1 */}
        {zoom > 1 && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[9.5px] text-cyan-300/80 whitespace-nowrap font-medium">
              ⇄ Cuộn vùng zoom
            </span>
            <div
              ref={panBarRef}
              onMouseDown={(e) => {
                setPanDragging(true);
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const centeredStart = ratio * safeDuration - visibleSpan / 2;
                setViewStart(Math.max(0, Math.min(safeDuration - visibleSpan, centeredStart)));
              }}
              className="relative flex-1 h-2.5 rounded bg-[#061326] border border-cyan-500/25 cursor-grab active:cursor-grabbing overflow-hidden"
              title="Thanh cuộn vùng đang phóng to (không phải thanh tua phát) — kéo để xê dịch sóng âm"
            >
              <div
                className="absolute inset-y-0 rounded bg-cyan-400/60 hover:bg-cyan-300/80 border border-cyan-200/50"
                style={{
                  left: `${(viewStart / safeDuration) * 100}%`,
                  width: `${Math.max(6, (visibleSpan / safeDuration) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Time endpoints + Playhead / Total time */}
        <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-cyan-300/75">
          <span>{formatPreciseTime(viewStart)}</span>
          <div className="text-[11px] font-mono text-slate-300">
            <span className="text-white font-semibold">{formatPreciseTime(playhead)}</span>
            <span className="text-slate-500 mx-1">/</span>
            <span className="text-cyan-300/80">{formatPreciseTime(safeDuration)}</span>
          </div>
          <span>{formatPreciseTime(viewEnd)}</span>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="px-3.5 py-2.5 bg-[#081324] rounded-b-xl border-t border-white/[0.06] flex items-center justify-between gap-2 flex-wrap">
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

        {/* In-App Audio Volume & Boost Control (0% - 200%, default 100%, wheel ±5%) */}
        <div
          ref={volumeBoxRef}
          className={`flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#0d1c33] border ${
            !isMuted && volume > 1 ? 'border-amber-400/50' : 'border-white/10'
          }`}
          title="Âm lượng & kích âm thanh 0% – 200% (mặc định 100%, áp dụng cho cả nghe thử và file tải về)"
        >
          <button
            type="button"
            onClick={() => {
              if (isMuted || volume === 0) {
                setIsMuted(false);
                if (volume === 0) setVolume(1);
              } else {
                setIsMuted(true);
              }
            }}
            className="text-slate-200 hover:text-cyan-300 transition-colors cursor-pointer flex items-center justify-center"
            title={isMuted || volume === 0 ? 'Bật tiếng' : 'Tắt tiếng'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : volume < 0.5 ? (
              <Volume1 className="w-4 h-4 text-emerald-400" />
            ) : volume > 1 ? (
              <Volume2 className="w-4 h-4 text-amber-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              setIsMuted(v === 0);
            }}
            className={`w-28 h-1 cursor-pointer ${
              !isMuted && volume > 1 ? 'accent-amber-400' : 'accent-emerald-400'
            }`}
          />
          <button
            type="button"
            onClick={() => {
              setIsMuted(false);
              setVolume(1);
            }}
            className={`w-10 text-right text-[10px] font-mono cursor-pointer transition-colors ${
              !isMuted && volume > 1
                ? 'text-amber-300 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Bấm để đặt lại về 100%"
          >
            {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
          </button>
        </div>
      </div>
    </div>
  );
};
