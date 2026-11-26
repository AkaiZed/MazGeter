import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  FileVideo,
  FolderOpen,
  Loader2,
  Music,
  RefreshCw,
  Scissors,
  Sparkles,
} from 'lucide-react';
import { MediaToolProgress } from '../types';

export const MediaToolsView: React.FC = () => {
  const [inputPath, setInputPath] = useState('');
  const [action, setAction] = useState<'convert' | 'extract-audio' | 'trim'>('convert');
  const [targetFormat, setTargetFormat] = useState<'mp4' | 'mp3' | 'mkv' | 'webm' | 'wav' | 'm4a'>('mp4');
  const [trimStart, setTrimStart] = useState('00:00:00');
  const [trimEnd, setTrimEnd] = useState('00:01:00');
  const [audioBitrate, setAudioBitrate] = useState('192');
  const [progress, setProgress] = useState<MediaToolProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = window.mazgeter?.onMediaToolProgress((p) => {
      setProgress(p);
    });
    return () => unsub?.();
  }, []);

  const handleSelectInput = async () => {
    const file = await window.mazgeter?.selectFile([
      {
        name: 'Media Files',
        extensions: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'mp3', 'm4a', 'wav', 'flac'],
      },
    ]);
    if (file) {
      setInputPath(file);
      setError(null);
      setProgress(null);
    }
  };

  const handleRun = async () => {
    if (!inputPath) {
      setError('Vui lòng chọn tệp video hoặc âm thanh trước.');
      return;
    }
    setError(null);
    try {
      await window.mazgeter!.runMediaTool({
        inputPath,
        action,
        targetFormat,
        trimStart: action === 'trim' ? trimStart : undefined,
        trimEnd: action === 'trim' ? trimEnd : undefined,
        audioBitrate,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi khởi chạy FFmpeg.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="w-full space-y-5">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <span>Media Tools (FFmpeg Studio)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Chuyển đổi định dạng, tách nhạc MP3/WAV và cắt đoạn video nhanh chóng ngay trên máy tính.
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              id: 'convert' as const,
              title: 'Chuyển định dạng',
              desc: 'MP4, MKV, WebM, MP3...',
              icon: <RefreshCw className="w-5 h-5 text-indigo-400" />,
            },
            {
              id: 'extract-audio' as const,
              title: 'Tách âm thanh',
              desc: 'Trích xuất MP3 / M4A / WAV',
              icon: <Music className="w-5 h-5 text-emerald-400" />,
            },
            {
              id: 'trim' as const,
              title: 'Cắt đoạn nhanh',
              desc: 'Cắt theo mốc thời gian',
              icon: <Scissors className="w-5 h-5 text-violet-400" />,
            },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setAction(item.id);
                if (item.id === 'extract-audio') setTargetFormat('mp3');
                else if (targetFormat === 'mp3') setTargetFormat('mp4');
              }}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                action === item.id
                  ? 'bg-indigo-500/15 border-indigo-500/40'
                  : 'bg-[#111724] border-white/[0.06] hover:border-white/[0.14]'
              }`}
            >
              <div className="mb-2.5">{item.icon}</div>
              <div className="text-sm font-semibold text-white">{item.title}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
            </button>
          ))}
        </div>

        {/* Form Card */}
        <div className="rounded-2xl bg-[#111724] border border-white/[0.06] p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">
              Tệp đầu vào
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={inputPath}
                placeholder="Chọn file video/audio từ máy tính..."
                className="flex-1 bg-[#0b0e14] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-mono outline-none"
              />
              <button
                onClick={handleSelectInput}
                className="px-4 py-2.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.08] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
              >
                <FileVideo className="w-4 h-4" />
                <span>Chọn file</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                Định dạng đầu ra
              </label>
              <select
                value={targetFormat}
                onChange={(e) => setTargetFormat(e.target.value as typeof targetFormat)}
                className="w-full bg-[#0b0e14] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-white outline-none"
              >
                {action !== 'extract-audio' && (
                  <>
                    <option value="mp4">MP4 (Video phổ biến)</option>
                    <option value="mkv">MKV (Chất lượng gốc)</option>
                    <option value="webm">WebM (Nhẹ cho Web)</option>
                  </>
                )}
                <option value="mp3">MP3 (Âm thanh)</option>
                <option value="m4a">M4A (AAC)</option>
                <option value="wav">WAV (Lossless)</option>
              </select>
            </div>

            {['mp3', 'm4a'].includes(targetFormat) ? (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1.5">
                  Chất lượng âm thanh
                </label>
                <select
                  value={audioBitrate}
                  onChange={(e) => setAudioBitrate(e.target.value)}
                  className="w-full bg-[#0b0e14] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                >
                  <option value="320">320 kbps</option>
                  <option value="192">192 kbps</option>
                  <option value="128">128 kbps</option>
                </select>
              </div>
            ) : action === 'trim' ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1.5">
                    Bắt đầu
                  </label>
                  <input
                    type="text"
                    value={trimStart}
                    onChange={(e) => setTrimStart(e.target.value)}
                    className="w-full bg-[#0b0e14] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1.5">
                    Kết thúc
                  </label>
                  <input
                    type="text"
                    value={trimEnd}
                    onChange={(e) => setTrimEnd(e.target.value)}
                    className="w-full bg-[#0b0e14] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-white font-mono outline-none"
                  />
                </div>
              </div>
            ) : (
              <div />
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300">
              {error}
            </div>
          )}

          {progress && (
            <div className="p-4 rounded-xl bg-[#0b0e14] border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-200 font-medium flex items-center gap-2">
                  {progress.status === 'running' && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  )}
                  {progress.status === 'complete' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                  {progress.stage}
                </span>
                <span className="font-mono text-slate-400">{progress.percent}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    progress.status === 'error'
                      ? 'bg-rose-500'
                      : progress.status === 'complete'
                      ? 'bg-emerald-500'
                      : 'bg-indigo-500'
                  }`}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              {progress.status === 'complete' && progress.outputPath && (
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 truncate max-w-md font-mono">
                    {progress.outputPath}
                  </span>
                  <button
                    onClick={() => window.mazgeter?.openFolder(progress.outputPath!)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Mở thư mục
                  </button>
                </div>
              )}
              {progress.error && (
                <p className="text-xs text-rose-400 font-mono">{progress.error}</p>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleRun}
              disabled={progress?.status === 'running'}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 disabled:opacity-50 cursor-pointer"
            >
              Thực hiện xử lý
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
