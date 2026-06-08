import React, { useState, useEffect, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Block, Page } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CheckCircle, Award, AlertCircle, Eye, RefreshCw, History } from 'lucide-react';
import confetti from 'canvas-confetti';
import { dbService } from '../utils/db';

interface CardItem {
  pageId: string;
  pageName: string;
  blockUuid: string;
  frontContent: string;
  backBlocks: Block[];
  cardData?: {
    easeFactor: number;
    interval: number;
    repetitions: number;
    nextReview?: string;
  };
}

export const Flashcards: React.FC = () => {
  const { state, actions } = useDatabase();
  const { pages } = state;

  const [sessionCards, setSessionCards] = useState<CardItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [historyLog, setHistoryLog] = useState<any[]>([]);

  // Find all flashcards across the database
  const allCards = useMemo(() => {
    const cards: CardItem[] = [];

    const traverseBlocks = (block: Block, page: Page) => {
      if (block.content.includes('#card')) {
        // Strip out '#card' from the front content
        const frontText = block.content.replace(/#card/g, '').trim();
        cards.push({
          pageId: page.id,
          pageName: page.name,
          blockUuid: block.uuid,
          frontContent: frontText,
          backBlocks: block.children,
          cardData: block.card
        });
      }
      block.children.forEach(child => traverseBlocks(child, page));
    };

    Object.values(pages).forEach(page => {
      page.blocks.forEach(block => traverseBlocks(block, page));
    });

    return cards;
  }, [pages]);

  // Filter cards due today
  const dueCards = useMemo(() => {
    const now = new Date();
    return allCards.filter(card => {
      // If never reviewed, it is due
      if (!card.cardData || !card.cardData.nextReview) {
        return true;
      }
      // If nextReview date is in the past or today, it is due
      const reviewDate = new Date(card.cardData.nextReview);
      return reviewDate <= now;
    });
  }, [allCards]);

  // Load reviews history log from IndexedDB
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await dbService.getAllReviews();
        setHistoryLog(history.reverse().slice(0, 10)); // Last 10 reviews
      } catch (err) {
        console.error('Failed to load review history:', err);
      }
    };
    loadHistory();
  }, [completedCount]);

  // Initialize session cards
  useEffect(() => {
    // Shuffle due cards at start of session
    setSessionCards([...dueCards].sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
    setShowAnswer(false);
    setCompletedCount(0);
  }, [dueCards.length === 0]); // Re-init if external changes reset the queue

  const activeCard = sessionCards[currentIndex];

  // SM-2 Spaced Repetition Scheduling Algorithm
  const handleScoreCard = async (score: number) => {
    if (!activeCard) return;

    // Default parameters if first review
    let easeFactor = activeCard.cardData?.easeFactor ?? 2.5;
    let interval = activeCard.cardData?.interval ?? 0;
    let repetitions = activeCard.cardData?.repetitions ?? 0;

    // SM-2 Calculations
    if (score < 3) {
      // Repetition failed: reset consecutive repetitions and review in 1 day
      repetitions = 0;
      interval = 1;
    } else {
      // Repetition succeeded
      if (repetitions === 0) {
        interval = 1; // 1 day
      } else if (repetitions === 1) {
        interval = 6; // 6 days
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions += 1;
    }

    // Adjust ease factor based on rating: EF' = EF + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02))
    easeFactor = easeFactor + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02));
    easeFactor = Math.max(1.3, easeFactor); // Minimum ease factor of 1.3

    // Calculate next review date
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);
    const nextReview = nextReviewDate.toISOString();

    // 1. Update the block card parameters in the page blocks tree
    const originalBlock = Object.values(pages)
      .find(p => p.id === activeCard.pageId)
      ?.blocks.flatMap(b => {
        const flat: Block[] = [];
        const traverse = (bl: Block) => {
          flat.push(bl);
          bl.children.forEach(traverse);
        };
        traverse(b);
        return flat;
      })
      .find(b => b.uuid === activeCard.blockUuid);

    if (originalBlock) {
      // Keep block content unchanged, update card metadata
      await actions.updateBlock(
        activeCard.pageId,
        activeCard.blockUuid,
        originalBlock.content,
        {
          card: {
            easeFactor,
            interval,
            repetitions,
            nextReview
          }
        }
      );
    }

    // 2. Save review record to history database in IndexedDB
    const reviewRecord = {
      id: `review-${Math.random().toString(36).substr(2, 9)}`,
      blockUuid: activeCard.blockUuid,
      pageId: activeCard.pageId,
      score,
      reviewedAt: new Date().toISOString()
    };
    await dbService.saveReview(reviewRecord);

    // 3. Move to next card
    setCompletedCount(prev => prev + 1);
    setShowAnswer(false);

    if (currentIndex + 1 >= sessionCards.length) {
      // End of session! Shoot confetti!
      triggerConfetti();
    }
    
    setCurrentIndex(prev => prev + 1);
  };

  const triggerConfetti = () => {
    const duration = 2.5 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#3b82f6', '#10b981', '#fb923c']
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#3b82f6', '#10b981', '#fb923c']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  const handleResetQueue = () => {
    setSessionCards([...allCards].sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
    setShowAnswer(false);
    setCompletedCount(0);
  };

  const sessionFinished = currentIndex >= sessionCards.length && sessionCards.length > 0;

  return (
    <div className="flex-1 flex flex-col bg-neutral-900 text-white p-4 overflow-y-auto select-none">
      {/* Header Info */}
      <div className="flex items-center justify-between mb-4 bg-neutral-950/40 px-3 py-2.5 rounded-xl border border-neutral-800/30">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-neutral-300 flex items-center gap-1">
            <Award className="w-4 h-4 text-amber-500" /> Voyager Cards
          </span>
          <span className="text-[10px] text-neutral-500 font-mono">
            {dueCards.length} due today • {allCards.length} total cards
          </span>
        </div>
        
        {sessionCards.length > 0 && !sessionFinished && (
          <div className="text-xs font-mono bg-neutral-800 px-2.5 py-1 rounded-lg border border-neutral-700">
            {currentIndex + 1} / {sessionCards.length}
          </div>
        )}
      </div>

      {/* NO CARDS STATE */}
      {allCards.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-neutral-500 bg-neutral-950 rounded-2xl border border-neutral-800">
          <AlertCircle className="w-10 h-10 text-neutral-600 mb-3" />
          <h4 className="text-sm font-bold text-neutral-300">No flashcards found</h4>
          <p className="text-xs text-neutral-500 max-w-xs mt-1.5">
            Add `#card` to any block in the editor. Its nested children will automatically become the back of the card!
          </p>
        </div>
      )}

      {/* ALL CARDS REVIEWED STATE */}
      {allCards.length > 0 && dueCards.length === 0 && !sessionFinished && sessionCards.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-neutral-500 bg-neutral-950 rounded-2xl border border-neutral-800">
          <CheckCircle className="w-10 h-10 text-emerald-500 mb-3" />
          <h4 className="text-sm font-bold text-neutral-200">Inbox Zero! 🎉</h4>
          <p className="text-xs text-neutral-500 max-w-xs mt-1.5">
            Excellent! You have reviewed all cards due for today. Come back tomorrow or trigger a custom review below.
          </p>
          <button
            onClick={handleResetQueue}
            className="mt-5 bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-neutral-200 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Study All Cards
          </button>
        </div>
      )}

      {/* ACTIVE CARD DISPLAY */}
      {activeCard && !sessionFinished && (
        <div className="flex-1 flex flex-col gap-4">
          
          {/* Front of Card */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 shadow-lg flex-1 flex flex-col justify-center min-h-[160px]">
            <span className="text-[9px] uppercase tracking-wider font-bold text-blue-400 mb-2 block font-mono">
              Front • In [[{activeCard.pageName}]]
            </span>
            <div className="text-sm text-neutral-100 font-medium select-text">
              <MarkdownRenderer content={activeCard.frontContent} />
            </div>
          </div>

          {/* Back of Card (Answer) */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 shadow-lg flex-1 flex flex-col min-h-[180px]">
            <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-400 mb-3 block font-mono">
              Back • Answer
            </span>
            
            {showAnswer ? (
              <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto select-text">
                {activeCard.backBlocks.length === 0 ? (
                  <span className="text-xs text-neutral-500 italic">No nested answer blocks found. Add children to your card block!</span>
                ) : (
                  activeCard.backBlocks.map(block => (
                    <div key={block.uuid} className="pl-2 border-l-2 border-neutral-800">
                      <MarkdownRenderer content={block.content} />
                      {block.children.map(child => (
                        <div key={child.uuid} className="pl-4 mt-1 border-l border-neutral-800">
                          <MarkdownRenderer content={child.content} />
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <button
                  onClick={() => setShowAnswer(true)}
                  className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all"
                >
                  <Eye className="w-4 h-4 text-neutral-400" /> Show Answer
                </button>
              </div>
            )}
          </div>

          {/* SM-2 Recall Scoring Buttons */}
          {showAnswer && (
            <div className="flex flex-col gap-2">
              <span className="text-[9px] uppercase tracking-widest font-bold text-neutral-500 text-center block font-mono">
                Rate your recall (SM-2 Spaced Repetition)
              </span>
              <div className="grid grid-cols-6 gap-1 bg-neutral-950/80 p-1.5 border border-neutral-800/60 rounded-xl shadow-lg">
                {[
                  { val: 0, label: 'Forgot', color: 'bg-red-950 hover:bg-red-900 border-red-800/30 text-red-400' },
                  { val: 1, label: 'Wrong', color: 'bg-orange-950 hover:bg-orange-900 border-orange-800/30 text-orange-400' },
                  { val: 2, label: 'Hard', color: 'bg-yellow-950 hover:bg-yellow-900 border-yellow-800/30 text-yellow-400' },
                  { val: 3, label: 'Good', color: 'bg-blue-950 hover:bg-blue-900 border-blue-800/30 text-blue-400' },
                  { val: 4, label: 'Easy', color: 'bg-emerald-950 hover:bg-emerald-900 border-emerald-800/30 text-emerald-400' },
                  { val: 5, label: 'Perfect', color: 'bg-purple-950 hover:bg-purple-900 border-purple-800/30 text-purple-400' },
                ].map(rating => (
                  <button
                    key={rating.val}
                    onClick={() => handleScoreCard(rating.val)}
                    className={`flex flex-col items-center justify-center py-1.5 px-0.5 border rounded-lg cursor-pointer transition-all active:scale-90`}
                    title={rating.label}
                  >
                    <span className="text-xs font-bold font-mono">{rating.val}</span>
                    <span className="text-[8px] tracking-tight truncate w-full text-center font-semibold mt-0.5">{rating.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SESSION SUMMARY COMPLETED STATE */}
      {sessionFinished && (
        <div className="flex-1 flex flex-col justify-center items-center text-center p-6 bg-neutral-950 border border-neutral-800 rounded-2xl shadow-lg">
          <Award className="w-14 h-14 text-amber-400 mb-4 animate-bounce" />
          <h3 className="text-base font-bold text-white">Session Completed! 🎉</h3>
          <p className="text-xs text-neutral-400 mt-2 max-w-xs">
            You successfully reviewed <span className="font-bold text-emerald-400">{completedCount} flashcards</span>. Your review dates have been recalculated and committed to IndexedDB.
          </p>

          <div className="w-full mt-6 bg-neutral-900/50 border border-neutral-800/50 rounded-xl p-4 flex flex-col gap-3 text-left">
            <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-1 font-mono">
              <History className="w-3.5 h-3.5" /> Recent Review Log (IndexedDB)
            </span>
            <div className="space-y-1.5 max-h-32 overflow-y-auto font-mono text-[9px] text-neutral-400">
              {historyLog.length === 0 ? (
                <span className="italic">No history records found.</span>
              ) : (
                historyLog.map((log) => (
                  <div key={log.id} className="flex justify-between items-center border-b border-neutral-800 pb-1">
                    <span className="truncate max-w-[120px]">Block: {log.blockUuid}</span>
                    <span className="flex items-center gap-1 font-bold">
                      Score: <span className={log.score >= 3 ? 'text-emerald-400' : 'text-red-400'}>{log.score}</span>
                    </span>
                    <span>{new Date(log.reviewedAt).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={handleResetQueue}
            className="mt-6 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer"
          >
            Start Another Session
          </button>
        </div>
      )}
    </div>
  );
};
