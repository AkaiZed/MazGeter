import React from 'react';
import { Minus, Square, X, Zap } from 'lucide-react';

export const TitleBar: React.FC = () => {
  return (
    <header className="h-10 bg-[#0d111a] border-b border-white/[0.06] flex items-center justify-between px-3 drag-region shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Zap className="w-3.5 h-3.5 text-white fill-white" />
        </div>
        <span className="text-xs font-semibold tracking-wide text-slate-200">
          MazGeter
        </span>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
          AIO v1.0
        </span>
      </div>

      <div className="flex items-center no-drag">
        <button
          onClick={() => window.mazgeter?.minimize()}
          className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] transition-colors"
          title="Thu nhỏ"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => window.mazgeter?.maximize()}
          className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] transition-colors"
          title="Phóng to / Khôi phục"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={() => window.mazgeter?.close()}
          className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-500/90 transition-colors"
          title="Đóng"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
