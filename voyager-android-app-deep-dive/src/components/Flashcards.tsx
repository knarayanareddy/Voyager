import { useState, useMemo, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { FlashCard, Block, Page } from '../types';
import { parseInlineMarkdown } from './MarkdownRenderer';
import { Brain, RotateCcw, ChevronRight } from 'lucide-react';

// SM-2 Algorithm
function sm2(card: FlashCard, rating: 0 | 1 | 3 | 5): FlashCard {
  let { easeFactor, interval, reviewCount } = card;
  if (rating < 3) {
    interval = 1;
    reviewCount = 0;
  } else {
    if (reviewCount === 0) interval = 1;
    else if (reviewCount === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
    reviewCount++;
  }
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);
  return { ...card, easeFactor, interval, reviewCount, nextReview: nextReview.toISOString() };
}

function extractCards(db: Record<string, Page>): FlashCard[] {
  const cards: FlashCard[] = [];
  function collectBlocks(blocks: Block[]): Block[] {
    return blocks.reduce<Block[]>((acc, b) => [...acc, b, ...collectBlocks(b.children)], []);
  }
  for (const page of Object.values(db)) {
    for (const block of collectBlocks(page.blocks)) {
      if (block.content.toLowerCase().includes('#card') && block.children.length > 0) {
        cards.push({
          id: block.id,
          front: block.content.replace(/#card/gi, '').trim(),
          back: block.children.map(c => c.content),
          pageId: page.id,
          easeFactor: 2.5,
          interval: 0,
          nextReview: new Date().toISOString(),
          reviewCount: 0,
        });
      }
    }
  }
  return cards;
}

// Confetti
function Confetti() {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 2,
    color: ['#6366f1','#10b981','#f59e0b','#f43f5e','#8b5cf6','#06b6d4'][Math.floor(Math.random()*6)],
    size: 6 + Math.random() * 8,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            top: '-10px',
            background: p.color,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
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
  const [isFlipping, setIsFlipping] = useState(false);

  const allCards = useMemo(() => extractCards(state.db), [state.db]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('voyager-flashcards');
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

  const handleFlip = () => {
    if (isFlipping) return;
    setIsFlipping(true);
    setTimeout(() => { setFlipped(f => !f); setIsFlipping(false); }, 150);
  };

  const rate = (rating: 0 | 1 | 3 | 5) => {
    const card = sessionCards[currentIndex];
    const merged = { ...card, ...(savedCards[card.id] || {}) };
    const updated = sm2(merged, rating);
    const newSaved = { ...savedCards, [card.id]: updated };
    setSavedCards(newSaved);
    try { localStorage.setItem('voyager-flashcards', JSON.stringify(newSaved)); } catch { /* ignore */ }
    setRatings(r => ({ ...r, [card.id]: rating }));
    if (currentIndex + 1 >= sessionCards.length) {
      setDone(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4500);
    } else {
      setCurrentIndex(i => i + 1);
      setFlipped(false);
    }
  };

  const ratingLabels: { value: 0 | 1 | 3 | 5; label: string; emoji: string; color: string }[] = [
    { value: 0, label: 'Forgot', emoji: '😰', color: 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30' },
    { value: 1, label: 'Hard',   emoji: '😓', color: 'bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30' },
    { value: 3, label: 'Good',   emoji: '🙂', color: 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30' },
    { value: 5, label: 'Easy',   emoji: '😎', color: 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30' },
  ];

  // Start screen
  if (!sessionStarted) {
    const stats = {
      total: allCards.length,
      due: dueCards.length,
      mastered: allCards.filter(c => (savedCards[c.id]?.interval || 0) > 14).length,
      reviewed: Object.keys(savedCards).length,
    };

    return (
      <div className="flex flex-col h-full px-3 py-3 overflow-y-auto">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Brain size={16} className="text-indigo-400" />
            Spaced Repetition
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">SM-2 algorithm · Maximize retention</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { icon: '🃏', label: 'Total Cards', value: stats.total, color: '#6366f1' },
            { icon: '📅', label: 'Due Today',   value: stats.due,   color: '#f59e0b' },
            { icon: '📊', label: 'Reviewed',    value: stats.reviewed, color: '#3b82f6' },
            { icon: '⭐', label: 'Mastered',    value: stats.mastered, color: '#10b981' },
          ].map(s => (
            <div
              key={s.label}
              className="p-3 rounded-xl flex flex-col gap-1"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{s.icon}</span>
                <span className="text-[10px] text-slate-500">{s.label}</span>
              </div>
              <span className="text-xl font-bold" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Card list */}
        <div
          className="rounded-xl overflow-hidden mb-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="px-3 py-2 border-b border-white/6 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">
              {dueCards.length > 0 ? `📚 ${dueCards.length} cards due` : '✅ All caught up!'}
            </span>
          </div>
          {allCards.length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-3xl mb-2">🃏</div>
              <div className="text-xs text-slate-400 font-medium">No flashcards yet!</div>
              <div className="text-[11px] text-slate-600 mt-1">Add #card to any block to create one</div>
            </div>
          ) : (
            <>
              {allCards.slice(0, 6).map(card => (
                <div key={card.id} className="flex items-center justify-between px-3 py-2 border-b border-white/4 last:border-0">
                  <span className="text-[11px] text-slate-400 truncate flex-1 mr-2">{card.front}</span>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0"
                    style={{
                      background: savedCards[card.id] ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                      color: savedCards[card.id] ? '#10b981' : '#818cf8',
                    }}
                  >
                    {savedCards[card.id] ? `${savedCards[card.id].interval}d` : 'New'}
                  </span>
                </div>
              ))}
              {allCards.length > 6 && (
                <div className="px-3 py-2 text-[11px] text-slate-600">+{allCards.length - 6} more cards</div>
              )}
            </>
          )}
        </div>

        {allCards.length > 0 && (
          <button
            onClick={startSession}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-98"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}
          >
            <Brain size={16} />
            {dueCards.length > 0 ? `Review ${Math.min(20, dueCards.length)} Due Cards` : 'Practice All Cards'}
          </button>
        )}
      </div>
    );
  }

  // Done screen
  if (done) {
    const ratingCounts = Object.values(ratings);
    const goodCount = ratingCounts.filter(r => r >= 3).length;
    const hardCount = ratingCounts.filter(r => r < 3).length;

    return (
      <div className="flex flex-col h-full items-center justify-center px-4 text-center">
        {showConfetti && <Confetti />}
        <div className="text-5xl mb-3 animate-bounce-subtle">🎉</div>
        <h2 className="text-lg font-bold text-slate-100 mb-1">Session Complete!</h2>
        <p className="text-xs text-slate-500 mb-6">{sessionCards.length} cards reviewed</p>

        <div className="grid grid-cols-3 gap-3 w-full mb-6">
          <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="text-xl font-bold text-emerald-400">{goodCount}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">😎 Good</div>
          </div>
          <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="text-xl font-bold text-red-400">{hardCount}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">😰 Hard</div>
          </div>
          <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <div className="text-xl font-bold text-indigo-400">
              {Math.round((goodCount / sessionCards.length) * 100)}%
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Retention</div>
          </div>
        </div>

        <div className="flex gap-2 w-full">
          <button
            onClick={() => { setSessionStarted(false); setDone(false); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 transition-all hover:bg-white/8"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Back
          </button>
          <button
            onClick={startSession}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <RotateCcw size={14} /> Again
          </button>
        </div>
      </div>
    );
  }

  // Review screen
  const card = sessionCards[currentIndex];
  const progress = (currentIndex / sessionCards.length) * 100;

  return (
    <div className="flex flex-col h-full px-3 py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <button
          onClick={() => setSessionStarted(false)}
          className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          ← Back
        </button>
        <span className="text-xs font-semibold text-slate-400">
          {currentIndex + 1} / {sessionCards.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full mb-4 shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
        />
      </div>

      {/* Card */}
      <div
        className={`flex-1 rounded-2xl cursor-pointer relative overflow-hidden transition-all duration-150 ${isFlipping ? 'scale-95 opacity-80' : 'scale-100 opacity-100'}`}
        style={{
          background: flipped
            ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(6,182,212,0.06))'
            : 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06))',
          border: flipped
            ? '1px solid rgba(16,185,129,0.2)'
            : '1px solid rgba(99,102,241,0.2)',
        }}
        onClick={() => !flipped && handleFlip()}
      >
        <div className="absolute top-3 left-3">
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: flipped ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)',
              color: flipped ? '#10b981' : '#818cf8',
            }}
          >
            {flipped ? '💡 ANSWER' : '❓ QUESTION'}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center h-full px-5 py-10 text-center">
          {!flipped ? (
            <>
              <div className="text-sm font-semibold text-slate-200 leading-relaxed mb-6">
                {parseInlineMarkdown(card.front, navigateTo)}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-600 animate-bounce-subtle">
                <span>Tap to reveal</span>
                <ChevronRight size={12} />
              </div>
            </>
          ) : (
            <div className="w-full">
              <div className="text-[11px] font-semibold text-slate-400 mb-3 uppercase tracking-wider">Answer</div>
              {card.back.map((line, i) => (
                <div
                  key={i}
                  className="text-xs text-slate-300 py-1.5 px-3 rounded-lg mb-1.5 text-left"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {parseInlineMarkdown(line, navigateTo)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rating buttons */}
      <div className="mt-3 shrink-0">
        {flipped ? (
          <div className="grid grid-cols-4 gap-1.5">
            {ratingLabels.map(r => (
              <button
                key={r.value}
                onClick={() => rate(r.value)}
                className={`py-2.5 rounded-xl text-center text-[11px] font-semibold transition-all active:scale-95 ${r.color}`}
              >
                <div className="text-base mb-0.5">{r.emoji}</div>
                <div>{r.label}</div>
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={handleFlip}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-98"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            Reveal Answer
          </button>
        )}
      </div>
    </div>
  );
}
