import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Film,
  FolderOpen,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { DownloadTask } from '../types';
import { formatBytes, formatSpeed } from '../utils';

interface TaskListProps {
  title: string;
  tasks: DownloadTask[];
  showClearAll?: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenNewTask: () => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  title,
  tasks,
  showClearAll,
  sidebarOpen,
  onToggleSidebar,
  onOpenNewTask,
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top Toolbar */}
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between shrink-0 bg-[#0d111a]/60">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
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
            <h1 className="text-base font-bold text-white leading-tight">{title}</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {tasks.length} tác vụ trong danh sách
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showClearAll && tasks.length > 0 && (
            <button
              onClick={() => window.mazgeter?.clearCompleted()}
              className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-rose-500/15 hover:text-rose-300 border border-white/[0.08] text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa lịch sử</span>
            </button>
          )}
        </div>
      </div>

      {/* Task Cards */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {tasks.length === 0 ? (
          <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
              <Globe className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">
              Chưa có tác vụ nào ở mục này
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1.5">
              Dán link YouTube, TikTok, Facebook để tải video/MP3 siêu tốc hoặc dán link trực tiếp / Magnet Torrent để tải đa luồng.
            </p>
            <button
              onClick={onOpenNewTask}
              className="mt-5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm tác vụ đầu tiên</span>
            </button>
          </div>
        ) : (
          tasks.map((task) => {
            const isActive = task.status === 'active';
            const isPaused = task.status === 'paused' || task.status === 'waiting';
            const isComplete = task.status === 'complete';
            const isError = task.status === 'error';

            return (
              <div
                key={task.id}
                className="group rounded-2xl bg-[#111724] hover:bg-[#151c2c] border border-white/[0.06] hover:border-white/[0.12] p-4 transition-all"
              >
                <div className="flex items-start gap-3.5">
                  {/* Thumbnail or Engine Icon */}
                  {task.thumbnail ? (
                    <img
                      src={task.thumbnail}
                      alt={task.name}
                      className="w-20 h-12 rounded-lg object-cover border border-white/10 shrink-0"
                    />
                  ) : (
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                        task.engine === 'yt-dlp'
                          ? 'bg-indigo-500/15 border-indigo-500/25 text-indigo-300'
                          : 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300'
                      }`}
                    >
                      {task.engine === 'yt-dlp' ? (
                        <Film className="w-5 h-5" />
                      ) : (
                        <Globe className="w-5 h-5" />
                      )}
                    </div>
                  )}

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-sm font-semibold text-slate-100 truncate">
                          {task.name}
                        </h3>
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                            task.engine === 'yt-dlp'
                              ? 'bg-indigo-500/20 text-indigo-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {task.formatLabel || task.engine}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {isActive && task.engine === 'aria2' && (
                          <button
                            onClick={() => window.mazgeter?.pauseTask(task.id, task.engine)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 cursor-pointer"
                            title="Tạm dừng"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        )}
                        {isPaused && task.engine === 'aria2' && (
                          <button
                            onClick={() => window.mazgeter?.resumeTask(task.id, task.engine)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"
                            title="Tiếp tục"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        {isComplete && task.filePath && (
                          <button
                            onClick={() => window.mazgeter?.openFile(task.filePath!)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 cursor-pointer"
                            title="Mở file"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            window.mazgeter?.openFolder(task.filePath || task.dir)
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] cursor-pointer"
                          title="Mở thư mục"
                        >
                          <FolderOpen className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => window.mazgeter?.removeTask(task.id, task.engine)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                          title="Xóa / Hủy"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2.5 h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isError
                            ? 'bg-rose-500'
                            : isComplete
                            ? 'bg-emerald-500'
                            : task.engine === 'yt-dlp'
                            ? 'bg-gradient-to-r from-indigo-500 to-violet-500'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }}
                      />
                    </div>

                    {/* Meta row */}
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center gap-3">
                        <span className="font-mono">
                          {task.totalLength > 0
                            ? `${formatBytes(task.completedLength)} / ${formatBytes(task.totalLength)}`
                            : isComplete
                            ? 'Đã lưu'
                            : 'Đang lấy dung lượng...'}
                        </span>
                        <span className="font-semibold text-slate-300">
                          {task.progress.toFixed(1)}%
                        </span>
                        {task.connections ? (
                          <span className="text-slate-500">{task.connections} luồng</span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-3">
                        {isActive && (
                          <>
                            <span className="font-mono text-emerald-400 font-semibold">
                              {formatSpeed(task.downloadSpeed)}
                            </span>
                            <span className="text-slate-400">ETA: {task.eta}</span>
                          </>
                        )}
                        {isComplete && (
                          <span className="flex items-center gap-1 text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Hoàn thành
                          </span>
                        )}
                        {isError && (
                          <span
                            className="flex items-center gap-1 text-rose-400 font-medium max-w-xs truncate"
                            title={task.errorMessage}
                          >
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {task.errorMessage || 'Lỗi tải xuống'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
