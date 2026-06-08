import { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
// types imported via useDatabase hooks
import { CheckSquare, Clock, Zap, Archive, ChevronRight } from 'lucide-react';
import { parseInlineMarkdown } from './MarkdownRenderer';
import { format } from 'date-fns';

type TaskFilter = 'all' | 'active' | 'done';

const TASK_ORDER = { NOW: 0, DOING: 1, TODO: 2, LATER: 3, DONE: 4, CANCELLED: 5 };

export default function TodoView() {
  const { getTasks, navigateTo } = useDatabase();
  const [filter, setFilter] = useState<TaskFilter>('active');
  const allTasks = getTasks();

  const filtered = allTasks
    .filter(({ block }) => {
      if (filter === 'active') return block.taskStatus && !['DONE', 'CANCELLED'].includes(block.taskStatus);
      if (filter === 'done') return block.taskStatus === 'DONE' || block.taskStatus === 'CANCELLED';
      return true;
    })
    .sort((a, b) => {
      const ao = TASK_ORDER[a.block.taskStatus as keyof typeof TASK_ORDER] ?? 99;
      const bo = TASK_ORDER[b.block.taskStatus as keyof typeof TASK_ORDER] ?? 99;
      return ao - bo;
    });

  const counts = {
    all: allTasks.length,
    active: allTasks.filter(({ block }) => block.taskStatus && !['DONE', 'CANCELLED'].includes(block.taskStatus)).length,
    done: allTasks.filter(({ block }) => ['DONE', 'CANCELLED'].includes(block.taskStatus || '')).length,
  };

  const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    TODO:      { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: <CheckSquare size={11} />, label: 'TODO' },
    DOING:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: <Clock size={11} />,       label: 'DOING' },
    DONE:      { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: <CheckSquare size={11} />, label: 'DONE' },
    LATER:     { color: '#64748b', bg: 'rgba(100,116,139,0.12)', icon: <Archive size={11} />,     label: 'LATER' },
    NOW:       { color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',   icon: <Zap size={11} />,         label: 'NOW' },
    CANCELLED: { color: '#475569', bg: 'rgba(71,85,105,0.12)',   icon: <CheckSquare size={11} />, label: 'CANCELLED' },
  };

  const getPageName = (page: { name: string; isJournal: boolean }) => {
    if (page.isJournal) {
      try { return format(new Date(page.name + 'T12:00:00'), 'MMM d'); }
      catch { return page.name; }
    }
    return page.name;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <CheckSquare size={16} className="text-indigo-400" />
          Task Board
        </h2>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-3 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {[
            { id: 'active' as TaskFilter, label: 'Active', count: counts.active },
            { id: 'all' as TaskFilter, label: 'All', count: counts.all },
            { id: 'done' as TaskFilter, label: 'Done', count: counts.done },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                filter === tab.id
                  ? 'bg-indigo-500/30 text-indigo-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{
                  background: filter === tab.id ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)',
                  color: filter === tab.id ? '#a5b4fc' : '#475569',
                }}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-xs text-slate-400 font-medium">
              {filter === 'active' ? 'No active tasks!' : filter === 'done' ? 'No completed tasks yet' : 'No tasks found'}
            </p>
            <p className="text-[10px] text-slate-600 mt-1">
              Create tasks with TODO/DOING in the editor
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 mt-2">
            {filtered.map(({ block, page }) => {
              const cfg = statusConfig[block.taskStatus || 'TODO'];
              return (
                <button
                  key={block.id}
                  className="w-full flex items-start gap-2.5 p-3 rounded-xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.color}22` }}
                  onClick={() => navigateTo(page.id)}
                >
                  {/* Status badge */}
                  <div
                    className="shrink-0 mt-0.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                    style={{ background: `${cfg.color}22`, color: cfg.color }}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-xs text-slate-200 leading-relaxed ${block.taskStatus === 'DONE' || block.taskStatus === 'CANCELLED' ? 'line-through opacity-50' : ''}`}
                    >
                      {parseInlineMarkdown(block.content, navigateTo)}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[9px] text-slate-600">
                        {page.isJournal ? '📅' : '📄'} {getPageName(page)}
                      </span>
                    </div>
                  </div>

                  <ChevronRight size={11} className="text-slate-600 mt-0.5 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
