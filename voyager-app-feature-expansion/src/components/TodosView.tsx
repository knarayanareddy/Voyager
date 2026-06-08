import { useDatabase } from '../context/DatabaseContext';
import { Block } from '../types';
import { CheckCircle, Circle, Clock, AlertCircle, ArrowRight, BookOpen } from 'lucide-react';

interface TaskItem {
  block: Block;
  pageId: string;
  pageName: string;
}

function collectTasks(blocks: Block[], pageId: string, pageName: string): TaskItem[] {
  const tasks: TaskItem[] = [];
  function walk(blks: Block[]) {
    blks.forEach(b => {
      if (b.taskStatus) tasks.push({ block: b, pageId, pageName });
      if (b.children.length) walk(b.children);
    });
  }
  walk(blocks);
  return tasks;
}

export default function TodosView() {
  const { state, dispatch, navigateTo } = useDatabase();
  const allTasks: TaskItem[] = [];
  Object.values(state.db).forEach(p => allTasks.push(...collectTasks(p.blocks, p.id, p.name)));

  const groups: Record<string, TaskItem[]> = { NOW: [], DOING: [], TODO: [], LATER: [], DONE: [], CANCELLED: [] };
  allTasks.forEach(t => { if (t.block.taskStatus) groups[t.block.taskStatus]?.push(t); });

  const cycleStatus = (pageId: string, blockId: string, current: Block['taskStatus']) => {
    const cycle: Block['taskStatus'][] = ['TODO', 'DOING', 'DONE', 'LATER', 'NOW', 'CANCELLED', null];
    const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];
    dispatch({ type: 'UPDATE_BLOCK_STATUS', pageId, blockId, status: next });
  };

  const icons: Record<string, React.ReactNode> = {
    NOW: <AlertCircle size={12} className="text-rose-400" />,
    DOING: <Clock size={12} className="text-amber-400" />,
    TODO: <Circle size={12} className="text-slate-400" />,
    LATER: <ArrowRight size={12} className="text-slate-500" />,
    DONE: <CheckCircle size={12} className="text-emerald-400" />,
    CANCELLED: <CheckCircle size={12} className="text-slate-600" />,
  };

  const statusColors: Record<string, string> = {
    NOW: 'border-rose-500/30 bg-rose-950/20',
    DOING: 'border-amber-500/30 bg-amber-950/20',
    TODO: 'border-slate-700 bg-slate-900',
    LATER: 'border-slate-800 bg-slate-900/50',
    DONE: 'border-emerald-800/30 bg-emerald-950/10',
    CANCELLED: 'border-slate-800 bg-slate-900/30',
  };

  const SECTIONS = [
    { key: 'NOW', label: 'Now' },
    { key: 'DOING', label: 'In Progress' },
    { key: 'TODO', label: 'To Do' },
    { key: 'LATER', label: 'Scheduled Later' },
    { key: 'DONE', label: 'Completed' },
    { key: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-y-auto">
      <div className="p-3 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Active', count: (groups.NOW?.length || 0) + (groups.DOING?.length || 0) + (groups.TODO?.length || 0), color: 'text-indigo-400' },
            { label: 'Done', count: groups.DONE?.length || 0, color: 'text-emerald-400' },
            { label: 'Total', count: allTasks.length, color: 'text-white' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 rounded-xl p-2.5 text-center border border-slate-800">
              <div className={`text-xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-slate-500 text-[10px] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Task Sections */}
        {SECTIONS.map(({ key, label }) => {
          const tasks = groups[key] || [];
          if (tasks.length === 0) return null;
          return (
            <div key={key}>
              <div className="flex items-center gap-1.5 mb-2">
                {icons[key]}
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{label}</span>
                <span className="bg-slate-800 text-slate-500 text-[9px] px-1.5 py-0.5 rounded-full">{tasks.length}</span>
              </div>
              <div className="space-y-1">
                {tasks.map(({ block, pageId, pageName }) => (
                  <div key={block.id} className={`flex items-start gap-2 px-2.5 py-2 rounded-xl border transition-colors ${statusColors[key]}`}>
                    <button onClick={() => cycleStatus(pageId, block.id, block.taskStatus)} className="shrink-0 mt-0.5">
                      {icons[key]}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-relaxed ${key === 'DONE' || key === 'CANCELLED' ? 'line-through text-slate-600' : 'text-slate-200'}`}>
                        {block.content.replace(/^(TODO|DOING|DONE|LATER|NOW|CANCELLED)\s/, '')}
                      </p>
                      <button onClick={() => navigateTo(pageId)} className="flex items-center gap-1 mt-0.5 text-slate-600 hover:text-indigo-400 transition-colors">
                        <BookOpen size={8} />
                        <span className="text-[9px]">{pageName}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {allTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-600">
            <CheckCircle size={32} className="mb-3 opacity-30" />
            <p className="text-sm">No tasks yet</p>
            <p className="text-xs mt-1">Add TODO, DOING, DONE markers to your blocks</p>
          </div>
        )}
      </div>
    </div>
  );
}
