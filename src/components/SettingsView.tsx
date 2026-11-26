import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Save,
  XCircle,
} from 'lucide-react';
import { AppSettings, BinaryStatus } from '../types';

interface SettingsViewProps {
  settings: AppSettings | null;
  onSettingsUpdated: (next: AppSettings) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSettingsUpdated,
  sidebarOpen,
  onToggleSidebar,
}) => {
  const [form, setForm] = useState<AppSettings | null>(settings);
  const [binaries, setBinaries] = useState<BinaryStatus | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const loadBinaries = async () => {
    const status = await window.mazgeter?.getBinaryStatus();
    if (status) setBinaries(status);
  };

  useEffect(() => {
    loadBinaries();
  }, []);

  if (!form) return null;

  const handleSave = async () => {
    const updated = await window.mazgeter!.updateSettings(form);
    onSettingsUpdated(updated);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const handleChooseDir = async () => {
    const dir = await window.mazgeter?.selectFolder();
    if (dir) setForm({ ...form, downloadDir: dir });
  };

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="w-full space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onToggleSidebar}
              className={`mt-0.5 p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                !sidebarOpen
                  ? 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25'
                  : 'text-indigo-400 hover:text-white hover:bg-white/[0.08]'
              }`}
              title={sidebarOpen ? 'Thu gọn thanh bên' : 'Hiện thanh bên'}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" />
              )}
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">Cài đặt hệ thống</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Cấu hình thư mục tải, thông số đa luồng aria2c và kiểm tra trạng thái các lõi engine.
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savedMsg ? 'Đã lưu!' : 'Lưu thay đổi'}</span>
          </button>
        </div>

        {/* General Settings */}
        <div className="rounded-2xl bg-[#111724] border border-white/[0.06] p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tải xuống & Kết nối
          </h2>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">
              Thư mục lưu mặc định
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.downloadDir}
                onChange={(e) => setForm({ ...form, downloadDir: e.target.value })}
                className="flex-1 bg-[#0b0e14] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono outline-none"
              />
              <button
                onClick={handleChooseDir}
                className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs text-white flex items-center gap-1.5 cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Chọn
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                Tác vụ đồng thời tối đa
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={form.maxConcurrentDownloads}
                onChange={(e) =>
                  setForm({ ...form, maxConcurrentDownloads: Number(e.target.value) || 1 })
                }
                className="w-full bg-[#0b0e14] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                Số luồng aria2 mặc định
              </label>
              <input
                type="number"
                min={1}
                max={64}
                value={form.aria2Split}
                onChange={(e) =>
                  setForm({
                    ...form,
                    aria2Split: Number(e.target.value) || 8,
                    maxConnectionPerServer: Number(e.target.value) || 8,
                  })
                }
                className="w-full bg-[#0b0e14] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                Giới hạn tốc độ (KB/s, 0 = không giới hạn)
              </label>
              <input
                type="number"
                min={0}
                value={form.speedLimitKbps}
                onChange={(e) =>
                  setForm({ ...form, speedLimitKbps: Math.max(0, Number(e.target.value) || 0) })
                }
                className="w-full bg-[#0b0e14] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
            </div>
          </div>
        </div>

        {/* Engine Binaries Status */}
        <div className="rounded-2xl bg-[#111724] border border-white/[0.06] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>Trạng thái các lõi Engine</span>
            </h2>
            <button
              onClick={loadBinaries}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Kiểm tra lại
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {binaries &&
              [binaries.aria2c, binaries.ytDlp, binaries.ffmpeg, binaries.ffprobe].map((bin) => (
                <div
                  key={bin.name}
                  className="p-3 rounded-xl bg-[#0b0e14] border border-white/[0.06] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{bin.name}</span>
                      {bin.version && (
                        <span className="text-[10px] text-slate-400 truncate max-w-xs">
                          {bin.version}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                      {bin.path || 'Chưa tìm thấy binary'}
                    </p>
                  </div>
                  {bin.available ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                      Sẵn sàng
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-rose-400 shrink-0">
                      <XCircle className="w-4 h-4" />
                      Thiếu
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
