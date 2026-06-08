import { X, Pin, ArrowRightLeft } from 'lucide-react';
import { Page, Block } from '../types';
import LogseqEditor from './LogseqEditor';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  pageName: string | null;
  pages: Page[];
  onUpdatePageBlocks: (pageName: string, newBlocks: Block[]) => void;
  onNavigate: (pageName: string) => void;
  theme: 'dark' | 'light';
  fontSize: number;
}

export default function Sidebar({
  isOpen,
  onClose,
  pageName,
  pages,
  onUpdatePageBlocks,
  onNavigate,
  theme,
  fontSize
}: SidebarProps) {
  const sidebarPage = pageName ? pages.find(p => p.name === pageName) : null;

  return (
    <div
      className={`absolute inset-y-0 right-0 z-40 w-[85%] bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-out flex flex-col ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
        <div className="flex items-center space-x-2">
          <ArrowRightLeft size={14} className="text-emerald-500" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Right Sidebar
          </span>
        </div>
        <div className="flex items-center space-x-1">
          {pageName && (
            <button
              onClick={() => {
                onNavigate(pageName);
                onClose();
              }}
              title="Open in Main View"
              className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 dark:text-slate-400 cursor-pointer transition-colors"
            >
              <Pin size={13} className="rotate-45" />
            </button>
          )}
          <button
            onClick={onClose}
            title="Close Sidebar"
            className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 dark:text-slate-400 cursor-pointer transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Sidebar Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {sidebarPage ? (
          <div className="space-y-4">
            <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-50">
                {sidebarPage.name}
              </h2>
              {sidebarPage.isJournal && (
                <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full mt-1 inline-block">
                  Journal
                </span>
              )}
            </div>

            <LogseqEditor
              page={sidebarPage}
              pages={pages}
              onUpdateBlocks={(newBlocks: Block[]) => onUpdatePageBlocks(sidebarPage.name, newBlocks)}
              onNavigate={onNavigate}
              theme={theme}
              fontSize={fontSize}
              isSidebarView={true}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400 dark:text-slate-500">
            <ArrowRightLeft size={24} className="mb-2 opacity-40" />
            <p className="text-xs font-semibold">Sidebar is Empty</p>
            <p className="text-[10px] mt-1 max-w-[180px]">
              Shift-click any link or press the sidebar icon on top of a page to open it here for split-pane editing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
