import { useState, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { FlashCard, Block } from '../types';
import { RotateCcw, ChevronLeft, ChevronRight, Trophy } from 'lucide-react';

function extractCards(blocks: Block[], pageId: string): FlashCard[] {
  const cards: FlashCard[] = [];
  function walk(blks: Block[]) {
    blks.forEach(b => {
      if (b.refs.includes('card') || b.content.includes('#card')) {
        cards.push({
          id: b.id,
          front: b.content.replace(/#card/g, '').trim(),
          back: b.children.map(c => c.content),
          pageId,
          easeFactor: 2.5,
          interval: 1,
          nextReview: new Date().toISOString(),
          reviewCount: 0,
        });
      }
      if (b.children.length) walk(b.children);
    });
  }
  walk(blocks);
  return cards;
}

const RATINGS = [
  { label: 'Forgot', score: 0, color: 'bg-red-600 hover:bg-red-500', emoji: '😓' },
  { label: 'Hard', score: 1, color: 'bg-orange-600 hover:bg-orange-500', emoji: '😤' },
  { label: 'Good', score: 3, color: 'bg-emerald-600 hover:bg-emerald-500', emoji: '😊' },
  { label: 'Easy', score: 5, color: 'bg-indigo-600 hover:bg-indigo-500', emoji: '🚀' },
];

export default function Flashcards() {
  const { state, dispatch } = useDatabase();
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [started, setStarted] = useState(false);

  const startSession = () => {
    const dueCards: FlashCard[] = [];
    const now = new Date();
    Object.values(state.db).forEach(page => {
      extractCards(page.blocks, page.id).forEach(c => {
        const review = state.reviews[c.id];
        if (review) {
          c.easeFactor = review.easeFactor ?? c.easeFactor;
          c.interval = review.interval ?? c.interval;
          c.nextReview = review.nextReview ?? c.nextReview;
          c.reviewCount = review.reviewCount ?? c.reviewCount;
        }
        if (new Date(c.nextReview) <= now) {
          dueCards.push(c);
        }
      });
    });
    setCards(dueCards.sort(() => Math.random() - 0.5));
    setIndex(0); setFlipped(false); setDone(false); setScores({});
    setStarted(true);
  };

  useEffect(() => {
    startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = cards[index];

  const rate = (score: number) => {
    setScores(s => ({ ...s, [current.id]: score }));
    
    // SM-2 Algorithm
    let { easeFactor, interval, reviewCount } = current;
    easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - score) * (0.08 + (5 - score) * 0.02));
    
    if (score < 3) {
      reviewCount = 0;
      interval = 1;
    } else {
      if (reviewCount === 0) interval = 1;
      else if (reviewCount === 1) interval = 6;
      else interval = Math.round(interval * easeFactor);
      reviewCount++;
    }
    
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);
    
    dispatch({
      type: 'SAVE_REVIEW',
      review: {
        id: current.id,
        cardId: current.id,
        score,
        reviewedAt: new Date().toISOString(),
        easeFactor,
        interval,
        nextReview: nextDate.toISOString(),
        reviewCount
      }
    });

    if (index + 1 >= cards.length) setDone(true);
    else { setIndex(i => i + 1); setFlipped(false); }
  };

  const restart = () => {
    startSession();
  };

  if (!started) return null;

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h3 className="text-white font-semibold mb-2">You're all caught up!</h3>
        <p className="text-slate-400 text-sm">No flashcards are due for review right now.</p>
      </div>
    );
  }

  if (done) {
    const totalCards = cards.length;
    const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / totalCards;
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-slate-950">
        <Trophy size={48} className="text-yellow-400 mb-4" />
        <h2 className="text-white text-xl font-bold mb-2">Session Complete!</h2>
        <p className="text-slate-400 text-sm mb-6">{totalCards} cards reviewed · Avg score: {avgScore.toFixed(1)}/5</p>
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-6">
          {RATINGS.map(r => {
            const count = Object.values(scores).filter(s => s === r.score).length;
            return (
              <div key={r.label} className="bg-slate-900 rounded-xl p-3 text-center">
                <div className="text-2xl mb-1">{r.emoji}</div>
                <div className="text-white font-bold text-lg">{count}</div>
                <div className="text-slate-500 text-xs">{r.label}</div>
              </div>
            );
          })}
        </div>
        <button onClick={restart} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium transition-colors">
          <RotateCcw size={16} /> Study Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 p-3">
      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>Card {index + 1} of {cards.length}</span>
          <span>{state.db[current?.pageId]?.name || ''}</span>
        </div>
        <div className="h-1 bg-slate-800 rounded-full">
          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${((index) / cards.length) * 100}%` }} />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col">
        <div
          className={`flex-1 rounded-2xl border border-slate-700 p-5 cursor-pointer transition-all select-none flex flex-col items-center justify-center text-center gap-4 ${
            flipped ? 'bg-slate-800' : 'bg-slate-900'
          }`}
          onClick={() => setFlipped(f => !f)}
        >
          {!flipped ? (
            <>
              <div className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Question</div>
              <p className="text-white text-base font-medium leading-relaxed">{current?.front}</p>
              <div className="text-slate-600 text-xs mt-2">Tap to reveal answer</div>
            </>
          ) : (
            <>
              <div className="text-indigo-400 text-xs uppercase tracking-wider font-semibold">Answer</div>
              <div className="space-y-2 w-full">
                {current?.back.map((line, i) => (
                  <div key={i} className="text-slate-200 text-sm bg-slate-900 rounded-lg px-3 py-2 text-left">{line}</div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Ratings */}
        {flipped && (
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {RATINGS.map(r => (
              <button key={r.label} onClick={() => rate(r.score)} className={`${r.color} text-white py-2 rounded-xl text-xs font-medium flex flex-col items-center gap-0.5 transition-colors`}>
                <span>{r.emoji}</span>
                <span>{r.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Nav */}
        <div className="flex justify-between mt-2">
          <button onClick={() => { setIndex(i => Math.max(0, i - 1)); setFlipped(false); }} disabled={index === 0} className="p-2 text-slate-600 hover:text-slate-400 disabled:opacity-30">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setFlipped(f => !f)} className="text-slate-500 text-xs">
            {flipped ? 'Hide answer' : 'Show answer'}
          </button>
          <button onClick={() => { setIndex(i => Math.min(cards.length - 1, i + 1)); setFlipped(false); }} disabled={index >= cards.length - 1} className="p-2 text-slate-600 hover:text-slate-400 disabled:opacity-30">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
