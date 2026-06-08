import { useState, useEffect, useRef, useCallback } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { FlashCard, Block } from '../types';
import { computeSM2 } from '../mockData';
import { RotateCcw, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';

// ─── SM-2 ratings ─────────────────────────────────────────────────────────────

const RATINGS = [
  { label: 'Forgot', score: 0, cls: 'bg-rose-900/60 border-rose-500/40 text-rose-300 hover:bg-rose-900' },
  { label: 'Hard', score: 1, cls: 'bg-amber-900/60 border-amber-500/40 text-amber-300 hover:bg-amber-900' },
  { label: 'Good', score: 2, cls: 'bg-blue-900/60 border-blue-500/40 text-blue-300 hover:bg-blue-900' },
  { label: 'Easy', score: 3, cls: 'bg-emerald-900/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900' },
];

// ─── Confetti ─────────────────────────────────────────────────────────────────

function Confetti() {
  const pieces = Array.from({ length: 40 });
  const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#f43f5e'];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 1.5;
        const dur = 2 + Math.random() * 2;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = 6 + Math.random() * 8;
        const shape = Math.random() > 0.5 ? 'rounded-full' : 'rounded-sm';
        return (
          <div
            key={i}
            className={`absolute ${shape} animate-confetti`}
            style={{ left: `${left}%`, top: -10, width: size, height: size, background: color, animationDelay: `${delay}s`, animationDuration: `${dur}s`, opacity: 0 }}
          />
        );
      })}
    </div>
  );
}

// ─── Extract #card blocks ─────────────────────────────────────────────────────

function extractFlashcards(
  db: Record<string, { blocks: Block[]; id: string }>,
  sm2Schedules: Record<string, { easeFactor: number; interval: number; nextReview: string; reviewCount: number }>,
): FlashCard[] {
  const cards: FlashCard[] = [];

  function walkBlocks(blocks: Block[], pageId: string) {
    for (const block of blocks) {
      if (block.refs.includes('card') || block.content.includes('#card')) {
        const schedule = sm2Schedules[block.id];
        cards.push({
          id: block.id,
          front: block.content.replace(/#card\b/g, '').trim(),
          back: block.children.map(c => c.content),
          pageId,
          easeFactor: schedule?.easeFactor ?? 2.5,
          interval: schedule?.interval ?? 0,
          nextReview: schedule?.nextReview ?? new Date().toISOString(),
          reviewCount: schedule?.reviewCount ?? 0,
        });
      }
      if (block.children.length) walkBlocks(block.children, pageId);
    }
  }

  for (const page of Object.values(db)) {
    walkBlocks(page.blocks, page.id);
  }
  return cards;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Flashcards() {
  const { state, dispatch } = useDatabase();
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionScores, setSessionScores] = useState<{ card: FlashCard; score: number }[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildDeck = useCallback(() => {
    const all = extractFlashcards(state.db, state.sm2Schedules);
    const now = new Date();
    const sorted = [...all].sort((a, b) => {
      const aDue = new Date(a.nextReview) <= now;
      const bDue = new Date(b.nextReview) <= now;
      if (aDue !== bDue) return aDue ? -1 : 1;
      return a.easeFactor - b.easeFactor;
    });
    setCards(sorted);
    setIdx(0);
    setFlipped(false);
    setDone(false);
    setSessionScores([]);
  }, [state.db, state.sm2Schedules]);

  useEffect(() => { buildDeck(); }, [buildDeck]);

  const current = cards[idx];

  const handleRate = (score: number) => {
    if (!current) return;
    const result = computeSM2(current.easeFactor, current.interval, current.reviewCount, score);
    dispatch({
      type: 'UPDATE_SM2',
      cardId: current.id,
      easeFactor: result.easeFactor,
      interval: result.interval,
      nextReview: result.nextReview,
      reviewCount: current.reviewCount + 1,
    });
    setSessionScores(prev => [...prev, { card: current, score }]);
    if (idx + 1 >= cards.length) {
      setDone(true);
      setShowConfetti(true);
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 4000);
    } else {
      setIdx(i => i + 1);
      setFlipped(false);
    }
  };

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <BookOpen size={40} className="text-slate-700" />
        <div>
          <p className="text-white font-semibold text-base">No flashcards yet</p>
          <p className="text-slate-500 text-xs mt-1">
            Add <code className="bg-slate-800 px-1 rounded">#card</code> to any block to create flashcards
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    const total = sessionScores.length;
    const good = sessionScores.filter(s => s.score >= 2).length;
    const acc = total > 0 ? Math.round((good / total) * 100) : 0;
    return (
      <div className="relative flex flex-col items-center justify-center h-full gap-5 px-5 overflow-hidden">
        {showConfetti && <Confetti />}
        <div className="text-5xl">🎉</div>
        <div className="text-center">
          <p className="text-white font-bold text-lg">Session Complete!</p>
          <p className="text-slate-400 text-sm mt-1">You reviewed {total} cards</p>
        </div>
        <div className="w-full bg-slate-900 rounded-2xl p-4 border border-slate-800 grid grid-cols-3 gap-3 text-center">
          <div><p className="text-2xl font-bold text-emerald-400">{good}</p><p className="text-slate-500 text-[10px]">Knew it</p></div>
          <div><p className="text-2xl font-bold text-white">{total}</p><p className="text-slate-500 text-[10px]">Total</p></div>
          <div><p className="text-2xl font-bold text-indigo-400">{acc}%</p><p className="text-slate-500 text-[10px]">Accuracy</p></div>
        </div>
        <div className="w-full max-h-32 overflow-y-auto space-y-1.5">
          {sessionScores.map(({ card, score }, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${RATINGS[score]?.cls ?? ''}`}>{RATINGS[score]?.label}</span>
              <span className="text-slate-400 truncate flex-1">{card.front}</span>
            </div>
          ))}
        </div>
        <button onClick={buildDeck} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-sm font-semibold transition-colors shadow-lg shadow-indigo-600/30">
          <RotateCcw size={16} /> Study Again
        </button>
      </div>
    );
  }

  const progress = (idx / cards.length) * 100;

  return (
    <div className="flex flex-col h-full px-3 py-3 gap-3">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-slate-400 text-xs">{idx + 1} / {cards.length}</span>
          <span className="text-slate-400 text-xs">{cards.filter(c => new Date(c.nextReview) <= new Date()).length} due</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 transition-all duration-500 rounded-full" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div
          onClick={() => setFlipped(f => !f)}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 cursor-pointer hover:border-slate-700 transition-all select-none flex flex-col"
          style={{ minHeight: 180 }}
        >
          {!flipped ? (
            <div className="flex flex-col h-full">
              <span className="text-slate-600 text-[10px] font-medium uppercase tracking-widest mb-3">Question</span>
              <div className="flex-1 flex items-center justify-center">
                <p className="text-white text-base font-medium text-center leading-relaxed">{current?.front}</p>
              </div>
              <p className="text-slate-600 text-xs text-center mt-auto pt-3">Tap to reveal answer</p>
            </div>
          ) : (
            <div className="flex flex-col h-full animate-fade-in">
              <span className="text-slate-600 text-[10px] font-medium uppercase tracking-widest mb-3">Answer</span>
              <div className="flex-1 space-y-2 overflow-y-auto">
                {current?.back.map((line, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-indigo-400 text-xs mt-0.5">•</span>
                    <p className="text-slate-200 text-sm leading-relaxed">{line}</p>
                  </div>
                ))}
                {(!current?.back || current.back.length === 0) && (
                  <p className="text-slate-500 text-sm italic">No answer blocks</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {flipped && (
        <div className="grid grid-cols-4 gap-2 animate-slide-in-up">
          {RATINGS.map(r => (
            <button key={r.score} onClick={() => handleRate(r.score)} className={`py-2.5 rounded-xl text-xs font-semibold border transition-all hover:scale-105 active:scale-95 ${r.cls}`}>
              {r.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={() => { setIdx(i => Math.max(0, i - 1)); setFlipped(false); }} disabled={idx === 0} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 disabled:opacity-30 hover:text-white hover:bg-slate-700 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <button onClick={() => setFlipped(f => !f)} className="px-5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors">
          {flipped ? 'Show Question' : 'Show Answer'}
        </button>
        <button onClick={() => { setIdx(i => Math.min(cards.length - 1, i + 1)); setFlipped(false); }} disabled={idx >= cards.length - 1} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 disabled:opacity-30 hover:text-white hover:bg-slate-700 transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
