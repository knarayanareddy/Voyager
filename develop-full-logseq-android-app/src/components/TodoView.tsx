import { useDatabase } from '../context/DatabaseContext';
import { Block } from '../types';
import { CheckSquare, Clock, Zap, Calendar, Circle, XCircle, TrendingUp } from 'lucide-react';
import { parseInlineMarkdown } from '../utils/markdown';

const STATUS_CONFIG: Record<string, { icon: typeof CheckSquare; color: string; bg: string; label: string }> = {
  TODO:      { icon: Circle,      color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',   label: 'To Do' },
  NOW:       { icon: Zap,         color: 'text-rose-400',   bg: 'bg-rose-500/10 border-rose-500/20',   label: 'Now' },
  DOING:     { icon: TrendingUp,  color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20', label: 'Doing' },
  LATER:     { icon: Clock,       color: 'text-gray-400',   bg: 'bg-gray-500/10 border-gray-500/20',   label: 'Later' },
  DONE:      { icon: CheckSquare, color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20', label: 'Done' },
  CANCELLED: { icon: XCircle,     color: 'text-gray-500',   bg: 'bg-gray-500/10 border-gray-500/10',   label: 'Cancelled' },
};

const STATUS_ORDER = ['NOW', 'DOING', 'TODO', 'LATER', 'DONE', 'CANCELLED'];

export default function TodoView() {
  const { getTasks, navigateTo, dispatch } = useDatabase();
  const tasks = getTasks();

  const grouped = STATUS_ORDER.reduce<Record<string, { block: Block; page: any }[]>>((acc, status) => {
    acc[status] = tasks.filter(t => t.block.taskStatus === status);
    return acc;
  }, {});

  const activeCount = tasks.filter(t => ['NOW', 'DOING', 'TODO'].includes(t.block.taskStatus || '')).length;
  const doneCount = tasks.filter(t => t.block.taskStatus === 'DONE').length;

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)] overflow-y-auto">
      <div className="px-4 pt-4 pb-2 shrink-0">
        <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">✅ Tasks</h2>
        <div className="flex items-center gap-3 text-xs text-[var(--color-text-tertiary)] mb-4">
          <span className="text-amber-400 font-medium">{activeCount} active</span>
          <span>·</span>
          <span className="text-green-400 font-medium">{doneCount} done</span>
          <span>·</span>
          <span>{tasks.length} total</span>
        </div>

        {/* Progress bar */}
        {tasks.length > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-[var(--color-text-tertiary)] mb-1">
              <span>Overall Progress</span>
              <span>{Math.round((doneCount / tasks.length) * 100)}%</span>
            </div>
            <div className="h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--color-accent)] to-green-400 rounded-full transition-all"
                style={{ width: `${(doneCount / tasks.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pb-4 space-y-4">
        {STATUS_ORDER.map(status => {
          const items = grouped[status];
          if (items.length === 0) return null;
          const cfg = STATUS_CONFIG[status];
          const Icon = cfg.icon;
          return (
            <div key={status}>
              <div className={`flex items-center gap-2 mb-2`}>
                <Icon size={13} className={cfg.color} />
                <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
                <span className="text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded-full">{items.length}</span>
              </div>
              <div className="space-y-1.5">
                {items.map(({ block, page }) => (
                  <div
                    key={block.id}
                    className={`rounded-xl border p-3 ${cfg.bg} cursor-pointer hover:opacity-90 transition-opacity`}
                    onClick={() => navigateTo(page.id)}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        className={`mt-0.5 shrink-0 ${cfg.color}`}
                        onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_TASK', pageId: page.id, blockId: block.id }); }}
                      >
                        <Icon size={14} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${status === 'DONE' || status === 'CANCELLED' ? 'line-through opacity-50' : 'text-[var(--color-text-primary)]'} leading-snug`}>
                          {parseInlineMarkdown(block.content, navigateTo)}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Calendar size={10} className="text-[var(--color-text-tertiary)]" />
                          <span className="text-[10px] text-[var(--color-text-tertiary)]">
                            {page.isJournal ? page.name : page.name}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-tertiary)]">
            <CheckSquare size={40} className="mb-3 opacity-30" />
            <p className="text-sm">No tasks yet</p>
            <p className="text-xs mt-1">Add TODO/DOING/DONE to any block</p>
          </div>
        )}
      </div>
    </div>
  );
}
