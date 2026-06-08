import { useState, useMemo, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { FlashCard, Block } from '../types';
import { parseInlineMarkdown } from '../utils/markdown';
import { Brain, RefreshCw, RotateCcw, ChevronRight, Award, Zap, Clock, TrendingUp } from 'lucide-react';

// SM-2 algorithm
function sm2(card: FlashCard, rating: 0 | 1 | 3 | 5): FlashCard {
  const { easeFactor, interval, reviewCount } = card;
  let newEase = Math.max(1.3, easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)));
  let newInterval = 1;
  if (rating < 3) {
    newInterval = 1;
  } else if (reviewCount === 0) {
    newInterval = 1;
  } else if (reviewCount === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(interval * newEase);
  }
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + newInterval);
  return {
    ...card,
    easeFactor: newEase,
    interval: newInterval,
    reviewCount: reviewCount + 1,
    nextReview: nextReview.toISOString(),
  };
}

function extractCards(db: Record<string, any>): FlashCard[] {
  const cards: FlashCard[] = [];
  function walk(blocks: Block[], pageId: string) {
    blocks.forEach(block => {
      if (block.content.toLowerCase().includes('#card') || block.refs?.includes('card')) {
        cards.push({
          id: block.id,
          front: block.content.replace(/#card/gi, '').trim(),
          back: block.children.map((c: Block) => c.content),
          pageId,
          easeFactor: 2.5,
          interval: 1,
          nextReview: new Date().toISOString(),
          reviewCount: 0,
        });
      }
      if (block.children.length) walk(block.children, pageId);
    });
  }
  Object.values(db).forEach((page: any) => walk(page.blocks, page.id));
  return cards;
}

// Confetti component
function Confetti() {
  const pieces = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
      color: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'][Math.floor(Math.random() * 6)],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
    })),
  []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map(p => (
        <div
          key={p.id}
          className="absolute top-0 animate-bounce"
          style={{
            left: `${p.x}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export default function Flashcards() {
  const { state, navigateTo } = useDatabase();
  const [sessionCards, setSessionCards] = useState<FlashCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [savedCards, setSavedCards] = useState<Record<string, FlashCard>>({});

  const allCards = useMemo(() => extractCards(state.db), [state.db]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('logseq-flashcards');
      if (stored) setSavedCards(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const dueCards = useMemo(() => {
    const now = new Date();
    return allCards.filter(c => {
      const saved = savedCards[c.id];
      if (!saved) return true;
      return new Date(saved.nextReview) <= now;
    });
  }, [allCards, savedCards]);

  const startSession = () => {
    const cards = dueCards.length > 0 ? dueCards : allCards;
    setSessionCards(cards.sort(() => Math.random() - 0.5).slice(0, Math.min(20, cards.length)));
    setCurrentIndex(0);
    setFlipped(false);
    setRatings({});
    setDone(false);
    setSessionStarted(true);
  };

  const rate = (rating: 0 | 1 | 3 | 5) => {
    const card = sessionCards[currentIndex];
    const merged = { ...card, ...(savedCards[card.id] || {}) };
    const updated = sm2(merged, rating);
    const newSaved = { ...savedCards, [card.id]: updated };
    setSavedCards(newSaved);
    try { localStorage.setItem('logseq-flashcards', JSON.stringify(newSaved)); } catch { /* ignore */ }
    setRatings(r => ({ ...r, [card.id]: rating }));

    if (currentIndex + 1 >= sessionCards.length) {
      setDone(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    } else {
      setCurrentIndex(i => i + 1);
      setFlipped(false);
    }
  };

  const ratingLabels = [
    { value: 0 as const, label: 'Forgot', emoji: '😰', color: 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30' },
    { value: 1 as const, label: 'Hard', emoji: '😓', color: 'bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30' },
    { value: 3 as const, label: 'Good', emoji: '🙂', color: 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30' },
    { value: 5 as const, label: 'Easy', emoji: '😎', color: 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30' },
  ];

  if (!sessionStarted) {
    const stats = {
      total: allCards.length,
      due: dueCards.length,
      mastered: allCards.filter(c => (savedCards[c.id]?.interval || 0) > 14).length,
      reviewed: Object.keys(savedCards).length,
    };
    return (
      <div className="flex flex-col h-full overflow-y-auto bg-[var(--color-bg)]">
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="text-[var(--color-accent)]" size={20} />
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Spaced Repetition</h2>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { icon: <Brain size={14}/>, label: 'Total Cards', value: stats.total, color: 'text-[var(--color-accent)]' },
              { icon: <Clock size={14}/>, label: 'Due Today', value: stats.due, color: 'text-amber-400' },
              { icon: <TrendingUp size={14}/>, label: 'Reviewed', value: stats.reviewed, color: 'text-blue-400' },
              { icon: <Award size={14}/>, label: 'Mastered', value: stats.mastered, color: 'text-green-400' },
            ].map(s => (
              <div key={s.label} className="bg-[var(--color-surface)] rounded-xl p-3 border border-[var(--color-border)]">
                <div className={`flex items-center gap-1 ${s.color} mb-1`}>{s.icon}<span className="text-[10px] uppercase tracking-wide">{s.label}</span></div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Card list preview */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              {dueCards.length > 0 ? `📚 ${dueCards.length} cards due for review` : '✅ All caught up!'}
            </h3>
            {allCards.slice(0, 5).map(card => (
              <div key={card.id} className="bg-[var(--color-surface)] rounded-lg p-2 mb-1.5 border border-[var(--color-border)] flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-secondary)] truncate flex-1">{card.front}</span>
                <span className="text-[10px] text-[var(--color-text-tertiary)] ml-2 shrink-0">
                  {savedCards[card.id] ? `int: ${savedCards[card.id].interval}d` : 'New'}
                </span>
              </div>
            ))}
            {allCards.length > 5 && (
              <div className="text-xs text-[var(--color-text-tertiary)] text-center mt-1">+{allCards.length - 5} more cards</div>
            )}
          </div>

          {allCards.length === 0 && (
            <div className="text-center py-6">
              <div className="text-4xl mb-2">🃏</div>
              <p className="text-[var(--color-text-secondary)] text-sm mb-1">No flashcards yet!</p>
              <p className="text-[var(--color-text-tertiary)] text-xs">Add <code className="bg-[var(--color-surface)] px-1 rounded">#card</code> to any block to create a card</p>
            </div>
          )}

          <button
            onClick={startSession}
            disabled={allCards.length === 0}
            className="w-full py-3 rounded-xl bg-[var(--color-accent)] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition-transform"
          >
            <Zap size={16} />
            {dueCards.length > 0 ? `Review ${dueCards.length} due cards` : 'Practice all cards'}
          </button>
          {dueCards.length > 0 && (
            <button
              onClick={() => { setSessionCards(allCards.sort(() => Math.random() - 0.5)); setCurrentIndex(0); setFlipped(false); setRatings({}); setDone(false); setSessionStarted(true); }}
              className="w-full py-2 mt-2 rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm flex items-center justify-center gap-2 hover:bg-[var(--color-surface-hover)]"
            >
              <RefreshCw size={14} />
              Practice all ({allCards.length})
            </button>
          )}
        </div>
      </div>
    );
  }

  if (done) {
    const ratingCounts = Object.values(ratings);
    const goodCount = ratingCounts.filter(r => r >= 3).length;
    const hardCount = ratingCounts.filter(r => r < 3).length;
    return (
      <div className="flex flex-col h-full items-center justify-center px-4 bg-[var(--color-bg)]">
        {showConfetti && <Confetti />}
        <div className="text-5xl mb-3">🎉</div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">Session Complete!</h2>
        <p className="text-[var(--color-text-secondary)] text-sm mb-6">{sessionCards.length} cards reviewed</p>
        <div className="w-full max-w-xs space-y-2 mb-6">
          <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2">
            <span className="text-green-400 text-sm">😎 Easy + Good</span>
            <span className="text-green-400 font-bold">{goodCount}</span>
          </div>
          <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
            <span className="text-red-400 text-sm">😰 Hard + Forgot</span>
            <span className="text-red-400 font-bold">{hardCount}</span>
          </div>
          <div className="flex items-center justify-between bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-2">
            <span className="text-[var(--color-text-secondary)] text-sm">Retention rate</span>
            <span className="text-[var(--color-text-primary)] font-bold">{Math.round((goodCount / sessionCards.length) * 100)}%</span>
          </div>
        </div>
        <button onClick={() => setSessionStarted(false)} className="w-full max-w-xs py-3 rounded-xl bg-[var(--color-accent)] text-white font-semibold text-sm flex items-center justify-center gap-2">
          <RotateCcw size={16} /> Back to Deck
        </button>
        <button onClick={startSession} className="w-full max-w-xs py-2 mt-2 rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm flex items-center justify-center gap-2">
          <RefreshCw size={14} /> Study Again
        </button>
      </div>
    );
  }

  const card = sessionCards[currentIndex];
  const progress = ((currentIndex) / sessionCards.length) * 100;

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)]">
      {/* Header */}
      <div className="px-4 py-2 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setSessionStarted(false)} className="text-[var(--color-text-tertiary)] text-sm hover:text-[var(--color-text-primary)]">← Back</button>
          <span className="text-sm text-[var(--color-text-secondary)]">{currentIndex + 1} / {sessionCards.length}</span>
          <button onClick={startSession} className="text-[var(--color-text-tertiary)] text-sm hover:text-[var(--color-text-primary)]"><RefreshCw size={14} /></button>
        </div>
        <div className="w-full h-1.5 bg-[var(--color-surface)] rounded-full overflow-hidden">
          <div className="h-full bg-[var(--color-accent)] rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col">
        <div
          className={`flex-1 rounded-2xl border ${flipped ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5' : 'border-[var(--color-border)] bg-[var(--color-surface)]'} p-5 cursor-pointer transition-all active:scale-98 min-h-32`}
          onClick={() => !flipped && setFlipped(true)}
        >
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-tertiary)] mb-3 font-semibold">
            {flipped ? '💡 Answer' : '❓ Question'}
          </div>
          <div className="text-[var(--color-text-primary)] text-base leading-relaxed">
            {parseInlineMarkdown(card.front, navigateTo)}
          </div>
          {flipped && card.back.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--color-accent)]/20 space-y-1.5">
              {card.back.map((line, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                  <ChevronRight size={12} className="mt-0.5 text-[var(--color-accent)] shrink-0" />
                  <span>{parseInlineMarkdown(line, navigateTo)}</span>
                </div>
              ))}
            </div>
          )}
          {!flipped && (
            <div className="mt-6 text-center text-[var(--color-text-tertiary)] text-xs animate-pulse">
              Tap to reveal answer
            </div>
          )}
        </div>

        {/* Rating buttons */}
        {flipped && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {ratingLabels.map(r => (
              <button
                key={r.value}
                onClick={() => rate(r.value)}
                className={`py-3 rounded-xl text-sm font-medium transition-all active:scale-95 ${r.color}`}
              >
                <div className="text-xl mb-0.5">{r.emoji}</div>
                {r.label}
              </button>
            ))}
          </div>
        )}

        {!flipped && (
          <button
            onClick={() => setFlipped(true)}
            className="mt-4 w-full py-3 rounded-xl bg-[var(--color-accent)] text-white font-semibold text-sm"
          >
            Show Answer
          </button>
        )}
      </div>
    </div>
  );
}
