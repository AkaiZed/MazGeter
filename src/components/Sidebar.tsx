import React from 'react';
import {
  ArrowDownCircle,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Clock,
  Plus,
  Scissors,
  Settings,
} from 'lucide-react';
import { GlobalStats, NavTab } from '../types';
import { formatSpeed } from '../utils';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenNewTask: () => void;
  stats: GlobalStats;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenNewTask,
  stats,
}) => {
  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    {
      id: 'active',
      label: 'Đang tải',
      icon: <ArrowDownCircle className="w-4 h-4" />,
      badge: stats.activeCount,
    },
    {
      id: 'waiting',
      label: 'Đang chờ / Tạm dừng',
      icon: <Clock className="w-4 h-4" />,
      badge: stats.waitingCount,
    },
    {
      id: 'stopped',
      label: 'Hoàn thành',
      icon: <CheckCircle2 className="w-4 h-4" />,
      badge: stats.stoppedCount,
    },
    {
      id: 'tools',
      label: 'Media Tools',
      icon: <Scissors className="w-4 h-4" />,
    },
    {
      id: 'settings',
      label: 'Cài đặt',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  return (
    <aside className="w-60 bg-[#0f141f] border-r border-white/[0.06] flex flex-col justify-between p-3 shrink-0">
      <div>
        <button
          onClick={onOpenNewTask}
          className="w-full mb-5 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Tạo tác vụ mới</span>
        </button>

        <div className="space-y-1">
          <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Trình tải AIO
          </div>
          {navItems.slice(0, 3).map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      active
                        ? 'bg-indigo-500/30 text-indigo-200'
                        : 'bg-white/[0.06] text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="px-2.5 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Công cụ & Hệ thống
          </div>
          {navItems.slice(3).map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Speed Monitor Footer (Motrix-style) */}
      <div className="rounded-xl bg-[#0b0e14] border border-white/[0.06] p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <ArrowDown className="w-3.5 h-3.5" />
            Tải xuống
          </span>
          <span className="font-mono text-slate-200 font-semibold">
            {formatSpeed(stats.downloadSpeed)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-sky-400 font-medium">
            <ArrowUp className="w-3.5 h-3.5" />
            Tải lên
          </span>
          <span className="font-mono text-slate-400">
            {formatSpeed(stats.uploadSpeed)}
          </span>
        </div>
      </div>
    </aside>
  );
};
