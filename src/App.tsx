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
  const [activeTab, setActiveTab] = useState<NavTab>('active');
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [stats, setStats] = useState<GlobalStats>(INITIAL_STATS);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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
    if (activeTab === 'active') {
      return tasks.filter((t) => t.status === 'active');
    }
    if (activeTab === 'waiting') {
      return tasks.filter((t) => t.status === 'waiting' || t.status === 'paused');
    }
    if (activeTab === 'stopped') {
      return tasks.filter((t) => t.status === 'complete' || t.status === 'error');
    }
    return [];
  }, [tasks, activeTab]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0b0e14] text-slate-100 overflow-hidden">
      <TitleBar />

      <div className="flex-1 flex min-h-0">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenNewTask={() => setModalOpen(true)}
          stats={stats}
        />

        <main className="flex-1 flex flex-col min-w-0 bg-[#0b0e14]">
          {activeTab === 'active' && (
            <TaskList
              title="Đang tải xuống"
              tasks={filteredTasks}
              onOpenNewTask={() => setModalOpen(true)}
            />
          )}
          {activeTab === 'waiting' && (
            <TaskList
              title="Đang chờ & Tạm dừng"
              tasks={filteredTasks}
              onOpenNewTask={() => setModalOpen(true)}
            />
          )}
          {activeTab === 'stopped' && (
            <TaskList
              title="Đã hoàn thành & Lịch sử"
              tasks={filteredTasks}
              showClearAll
              onOpenNewTask={() => setModalOpen(true)}
            />
          )}
          {activeTab === 'tools' && <MediaToolsView />}
          {activeTab === 'settings' && (
            <SettingsView settings={settings} onSettingsUpdated={setSettings} />
          )}
        </main>
      </div>

      <AddTaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        settings={settings}
        onTaskCreated={() => setActiveTab('active')}
      />
    </div>
  );
}
