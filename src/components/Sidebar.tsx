import React from 'react';
import {
  ArrowDown,
  ArrowDownCircle,
  ArrowUp,
  CheckCircle2,
  Download,
  Scissors,
  Settings,
} from 'lucide-react';
import { GlobalStats, NavTab } from '../types';
import { formatSpeed } from '../utils';

interface SidebarProps {
  open: boolean;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  stats: GlobalStats;
}

export const Sidebar: React.FC<SidebarProps> = ({
  open,
  activeTab,
  onSelectTab,
  stats,
}) => {
  const queueCount = stats.activeCount + stats.waitingCount;

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    {
      id: 'download',
      label: 'Tải xuống mới',
      icon: <Download className="w-4 h-4" />,
    },
    {
      id: 'queue',
      label: 'Đang tải & Tạm dừng',
      icon: <ArrowDownCircle className="w-4 h-4" />,
      badge: queueCount,
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
    <aside
      className={`${
        open ? 'w-60 p-3 border-r border-white/[0.06] opacity-100' : 'w-0 p-0 border-r-0 opacity-0 pointer-events-none'
      } bg-[#0f141f] flex flex-col justify-between shrink-0 overflow-hidden transition-all duration-300 ease-out`}
    >
      <div className="w-[216px]">
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
                <span className="flex items-center gap-2.5 truncate">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
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

      {/* Global Speed Monitor Footer */}
      <div className="w-[216px] rounded-xl bg-[#0b0e14] border border-white/[0.06] p-3 space-y-2">
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
