import { useDatabase } from '../context/DatabaseContext';
import { Block } from '../types';

interface TaskItem {
  block: Block;
  pageId: string;
  pageName: string;
}

export default function TodosView() {
  const { state, dispatch, navigateTo } = useDatabase();

  // Collect all tasks from all pages
  const allTasks: TaskItem[] = [];

  function walk(blocks: Block[], pageId: string, pageName: string) {
    for (const b of blocks) {
      if (b.taskStatus) {
        allTasks.push({ block: b, pageId, pageName });
      }
      if (b.children.length) walk(b.children, pageId, pageName);
    }
  }

  for (const page of Object.values(state.db)) {
    walk(page.blocks, page.id, page.name);
  }

  type SectionKey = 'NOW' | 'DOING' | 'TODO' | 'LATER' | 'DONE' | 'CANCELLED';

  const groups = allTasks.reduce<Record<string, TaskItem[]>>((acc, t) => {
    const key = t.block.taskStatus as string;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const cycleStatus = (task: TaskItem) => {
    const TASK_CYCLE: Block['taskStatus'][] = ['TODO', 'DOING', 'DONE', 'LATER', 'NOW', 'CANCELLED', null];
    const curr = TASK_CYCLE.indexOf(task.block.taskStatus);
    const next = TASK_CYCLE[(curr + 1) % TASK_CYCLE.length];
    dispatch({
      type: 'UPDATE_BLOCK_STATUS',
      pageId: task.pageId,
      blockId: task.block.id,
      status: next,
    });
  };

  const SECTIONS: { key: SectionKey; label: string; icon: string; cls: string }[] = [
    { key: 'NOW', label: 'Now', icon: '🔥', cls: 'border-rose-500/30 bg-rose-950/20' },
    { key: 'DOING', label: 'In Progress', icon: '⚡', cls: 'border-amber-500/30 bg-amber-950/20' },
    { key: 'TODO', label: 'To Do', icon: '☐', cls: 'border-slate-700 bg-slate-900' },
    { key: 'LATER', label: 'Scheduled', icon: '⏰', cls: 'border-slate-800 bg-slate-900/50' },
    { key: 'DONE', label: 'Completed', icon: '✓', cls: 'border-emerald-800/30 bg-emerald-950/10' },
    { key: 'CANCELLED', label: 'Cancelled', icon: '✕', cls: 'border-slate-800 bg-slate-900/30' },
  ];

  const statusColors: Record<string, string> = {
    NOW: 'text-rose-400 bg-rose-900/60',
    DOING: 'text-amber-300 bg-amber-900/60',
    TODO: 'text-slate-300 bg-slate-800',
    LATER: 'text-slate-500 bg-slate-900',
    DONE: 'text-emerald-400 bg-emerald-900/60',
    CANCELLED: 'text-slate-600 bg-slate-900',
  };

  const active = (groups['NOW']?.length || 0) + (groups['DOING']?.length || 0) + (groups['TODO']?.length || 0);
  const done = groups['DONE']?.length || 0;
  const total = allTasks.length;

  return (
    <div className="h-full overflow-y-auto px-3 py-3">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Active', count: active, color: 'text-indigo-400' },
          { label: 'Done', count: done, color: 'text-emerald-400' },
          { label: 'Total', count: total, color: 'text-white' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 rounded-2xl p-3 border border-slate-800 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-slate-500 text-[10px] font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Sections */}
      {SECTIONS.map(({ key, label, icon, cls }) => {
        const tasks = groups[key] || [];
        if (tasks.length === 0) return null;
        return (
          <div key={key} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">{icon}</span>
              <span className="text-slate-400 text-xs font-semibold">{label}</span>
              <span className="text-slate-600 text-xs ml-auto">{tasks.length}</span>
            </div>
            <div className="space-y-1.5">
              {tasks.map(({ block, pageId, pageName }) => (
                <div
                  key={block.id}
                  className={`flex items-start gap-2 p-2.5 rounded-xl border ${cls} transition-colors`}
                >
                  <button
                    onClick={() => cycleStatus({ block, pageId, pageName })}
                    className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold mt-0.5 ${statusColors[block.taskStatus ?? '']}`}
                  >
                    {block.taskStatus}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-relaxed ${block.taskStatus === 'DONE' ? 'line-through text-slate-500' : block.taskStatus === 'CANCELLED' ? 'line-through text-slate-600' : 'text-slate-200'}`}>
                      {block.content.replace(/^(TODO|DOING|DONE|LATER|NOW|CANCELLED)\s/, '')}
                    </p>
                    <button
                      onClick={() => navigateTo(pageId)}
                      className="text-indigo-400 text-[10px] hover:text-indigo-300 mt-0.5"
                    >
                      {pageName}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {allTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-600">
          <span className="text-4xl">✅</span>
          <p className="text-sm">No tasks yet</p>
          <p className="text-xs text-center">Add TODO, DOING, DONE markers to your blocks using the / slash command</p>
        </div>
      )}
    </div>
  );
}
