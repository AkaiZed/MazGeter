import React, { useEffect, useMemo, useState } from 'react';
import { AddTaskModal } from './components/AddTaskModal';
import { MediaToolsView } from './components/MediaToolsView';
import { SettingsView } from './components/SettingsView';
import { Sidebar } from './components/Sidebar';
import { TaskList } from './components/TaskList';
import { TitleBar } from './components/TitleBar';
import { AppSettings, DownloadTask, GlobalStats, NavTab } from './types';

const INITIAL_STATS: GlobalStats = {
  downloadSpeed: 0,
  uploadSpeed: 0,
  activeCount: 0,
  waitingCount: 0,
  stoppedCount: 0,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('download');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [stats, setStats] = useState<GlobalStats>(INITIAL_STATS);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    window.mazgeter?.getSettings().then(setSettings).catch(() => {});
    window.mazgeter?.refreshTasks().catch(() => {});

    const unsub = window.mazgeter?.onTasksUpdate((data) => {
      setTasks(data.tasks);
      setStats(data.stats);
    });
    return () => unsub?.();
  }, []);

  const filteredTasks = useMemo(() => {
    if (activeTab === 'queue') {
      return tasks
        .filter((t) => t.status === 'active' || t.status === 'waiting' || t.status === 'paused')
        .sort((a, b) => (a.status === 'active' ? -1 : b.status === 'active' ? 1 : 0));
    }
    if (activeTab === 'stopped') {
      return tasks.filter((t) => t.status === 'complete' || t.status === 'error');
    }
    return [];
  }, [tasks, activeTab]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0b0e14] text-slate-100 overflow-hidden">
      <TitleBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      <div className="flex-1 flex min-h-0">
        <Sidebar
          open={sidebarOpen}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          stats={stats}
        />

        <main className="flex-1 flex flex-col min-w-0 bg-[#0b0e14]">
          {activeTab === 'download' && (
            <AddTaskModal
              settings={settings}
              sidebarOpen={sidebarOpen}
              onToggleSidebar={() => setSidebarOpen((v) => !v)}
              onTaskCreated={() => setActiveTab('queue')}
            />
          )}
          {activeTab === 'queue' && (
            <TaskList
              title="Đang tải & Tạm dừng"
              tasks={filteredTasks}
              onOpenNewTask={() => setActiveTab('download')}
            />
          )}
          {activeTab === 'stopped' && (
            <TaskList
              title="Đã hoàn thành & Lịch sử"
              tasks={filteredTasks}
              showClearAll
              onOpenNewTask={() => setActiveTab('download')}
            />
          )}
          {activeTab === 'tools' && <MediaToolsView />}
          {activeTab === 'settings' && (
            <SettingsView settings={settings} onSettingsUpdated={setSettings} />
          )}
        </main>
      </div>
    </div>
  );
}
