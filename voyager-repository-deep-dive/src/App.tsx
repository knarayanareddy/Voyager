import { DatabaseProvider, useDatabase } from './context/DatabaseContext';
import { LogseqApp } from './components/LogseqApp';

function MainApp() {
  const { loading } = useDatabase();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white select-none">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
          {/* Sleek animated ring */}
          <div className="w-12 h-12 rounded-full border-4 border-neutral-900 border-t-blue-500 animate-spin"></div>
          
          <div className="flex flex-col items-center gap-1">
            <h2 className="text-xs font-bold tracking-widest text-neutral-300 uppercase font-mono">Voyager OS</h2>
            <span className="text-[9px] text-neutral-600 font-mono tracking-wide">Initializing Secure Local-First IndexedDB...</span>
          </div>
        </div>
      </div>
    );
  }

  return <LogseqApp />;
}

export default function App() {
  return (
    <DatabaseProvider>
      <MainApp />
    </DatabaseProvider>
  );
}
