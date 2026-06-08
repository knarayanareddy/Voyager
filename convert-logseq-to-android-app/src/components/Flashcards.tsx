import { useState, useEffect } from 'react';
import { Page, Block, Card } from '../types';
import { Award, BookOpen, CheckCircle, HelpCircle, RefreshCw, Sparkles, ChevronRight } from 'lucide-react';

interface FlashcardsProps {
  pages: Page[];
  onNavigate: (pageName: string) => void;
}

export default function Flashcards({ pages, onNavigate }: FlashcardsProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [reviewCount, setReviewCount] = useState({ forgotten: 0, hard: 0, good: 0, easy: 0 });
  const [triggerConfetti, setTriggerConfetti] = useState(false);

  // Parse pages to find all flashcards
  useEffect(() => {
    const extractedCards: Card[] = [];

    // Recursive function to search for card blocks
    const searchBlocks = (blocks: Block[], pageName: string) => {
      blocks.forEach(block => {
        const hasCardTag = block.content.includes('#card') || /\bcard\b/i.test(block.content);
        
        if (hasCardTag) {
          // The front is the block content without the '#card' tag
          const frontText = block.content
            .replace(/#card/g, '')
            .replace(/\bcard\b/gi, '')
            .trim();

          // The back is the child blocks of this block
          let backText = '';
          if (block.children && block.children.length > 0) {
            const getChildrenContent = (childBlocks: Block[], depth = 0): string => {
              return childBlocks
                .map(child => {
                  const indent = '  '.repeat(depth);
                  const bullet = '• ' + child.content;
                  const nested = child.children && child.children.length > 0
                    ? '\n' + getChildrenContent(child.children, depth + 1)
                    : '';
                  return indent + bullet + nested;
                })
                .join('\n');
            };
            backText = getChildrenContent(block.children);
          } else {
            backText = '*(No answer provided. Add sub-bullets to this block to create an answer!)*';
          }

          extractedCards.push({
            pageName,
            blockId: block.id,
            front: frontText || block.content,
            back: backText,
            ease: 2.5,
            interval: 1,
            repetition: 0,
            dueDate: Date.now()
          });
        }

        // Recursively search child blocks too (in case there are cards inside cards)
        if (block.children && block.children.length > 0) {
          searchBlocks(block.children, pageName);
        }
      });
    };

    pages.forEach(page => {
      searchBlocks(page.blocks, page.name);
    });

    setCards(extractedCards);
    setCurrentIndex(0);
    setCompleted(false);
    setShowAnswer(false);
  }, [pages]);

  const handleRate = (rating: 'forgot' | 'hard' | 'good' | 'easy') => {
    // Increment review stats
    setReviewCount(prev => ({
      ...prev,
      forgotten: rating === 'forgot' ? prev.forgotten + 1 : prev.forgotten,
      hard: rating === 'hard' ? prev.hard + 1 : prev.hard,
      good: rating === 'good' ? prev.good + 1 : prev.good,
      easy: rating === 'easy' ? prev.easy + 1 : prev.easy,
    }));

    if (currentIndex + 1 >= cards.length) {
      setCompleted(true);
      setTriggerConfetti(true);
      // Confetti effect timer
      setTimeout(() => setTriggerConfetti(false), 4000);
    } else {
      setCurrentIndex(prev => prev + 1);
      setShowAnswer(false);
    }
  };

  const restartSession = () => {
    setCurrentIndex(0);
    setShowAnswer(false);
    setCompleted(false);
    setReviewCount({ forgotten: 0, hard: 0, good: 0, easy: 0 });
  };

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800">
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4">
          <BookOpen size={30} />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">No Active Cards Found</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-6">
          To create flashcards, simply add the <span className="font-mono bg-slate-200 dark:bg-slate-800 px-1 rounded">#card</span> tag to any bullet point in your notes. Its nested sub-bullets will automatically become the back of the card!
        </p>
        <button
          onClick={() => onNavigate('Logseq Guide')}
          className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow-sm transition-all cursor-pointer"
        >
          <span>Read Flashcards Guide</span>
          <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="relative flex flex-col h-full w-full bg-slate-50 dark:bg-slate-900/30 rounded-xl overflow-hidden p-4">
      {/* Confetti Animation Overlay */}
      {triggerConfetti && (
        <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => {
            const left = Math.random() * 100;
            const delay = Math.random() * 2;
            const duration = 2 + Math.random() * 2;
            const size = 6 + Math.random() * 8;
            const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            
            return (
              <div
                key={i}
                className="absolute rounded-xs animate-bounce"
                style={{
                  left: `${left}%`,
                  top: `-10px`,
                  width: `${size}px`,
                  height: `${size}px`,
                  backgroundColor: randomColor,
                  opacity: 0.85,
                  transform: `rotate(${Math.random() * 360}deg)`,
                  animation: `fall ${duration}s linear ${delay}s infinite`,
                }}
              />
            );
          })}
          <style>{`
            @keyframes fall {
              0% { transform: translateY(0px) rotate(0deg); opacity: 1; }
              90% { opacity: 1; }
              100% { transform: translateY(500px) rotate(720deg); opacity: 0; }
            }
          `}</style>
        </div>
      )}

      {/* Header Info */}
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-1.5">
            <Sparkles size={14} className="text-emerald-500 animate-pulse" />
            <span>Spaced Repetition</span>
          </h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            Card {currentIndex + 1} of {cards.length}
          </p>
        </div>
        <div className="text-[10px] bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-md font-medium">
          Source: <span className="underline cursor-pointer font-semibold" onClick={() => onNavigate(currentCard.pageName)}>{currentCard.pageName}</span>
        </div>
      </div>

      {!completed ? (
        <div className="flex flex-col flex-1 min-h-0 justify-between space-y-4">
          {/* Progress Bar */}
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${((currentIndex) / cards.length) * 100}%` }}
            />
          </div>

          {/* Flashcard Area */}
          <div className="flex-1 flex flex-col justify-center items-center py-4 px-2 overflow-y-auto">
            <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs p-5 flex flex-col justify-between min-h-[180px] max-h-[320px] overflow-y-auto">
              {/* Front (Question) */}
              <div className="mb-4">
                <div className="text-[9px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500 mb-1.5 flex items-center space-x-1">
                  <HelpCircle size={10} />
                  <span>Question / Front</span>
                </div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {currentCard.front}
                </div>
              </div>

              {/* Back (Answer) */}
              {showAnswer ? (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-2 animate-fadeIn">
                  <div className="text-[9px] font-bold tracking-wider uppercase text-emerald-500 dark:text-emerald-400 mb-2 flex items-center space-x-1">
                    <CheckCircle size={10} />
                    <span>Answer / Back</span>
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-950/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-900">
                    {currentCard.back}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAnswer(true)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg shadow-xs transition-all border border-slate-200/40 dark:border-slate-700/30 cursor-pointer"
                >
                  Show Answer
                </button>
              )}
            </div>
          </div>

          {/* Rating Buttons */}
          {showAnswer && (
            <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
              <button
                onClick={() => handleRate('forgot')}
                className="flex flex-col items-center justify-center py-1.5 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400 cursor-pointer transition-all"
              >
                <span className="text-[10px] font-bold">Forgot</span>
                <span className="text-[8px] opacity-75 mt-0.5">1d</span>
              </button>
              <button
                onClick={() => handleRate('hard')}
                className="flex flex-col items-center justify-center py-1.5 bg-orange-500/10 hover:bg-orange-500/15 border border-orange-500/20 rounded-lg text-orange-600 dark:text-orange-400 cursor-pointer transition-all"
              >
                <span className="text-[10px] font-bold">Hard</span>
                <span className="text-[8px] opacity-75 mt-0.5">3d</span>
              </button>
              <button
                onClick={() => handleRate('good')}
                className="flex flex-col items-center justify-center py-1.5 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400 cursor-pointer transition-all"
              >
                <span className="text-[10px] font-bold">Good</span>
                <span className="text-[8px] opacity-75 mt-0.5">7d</span>
              </button>
              <button
                onClick={() => handleRate('easy')}
                className="flex flex-col items-center justify-center py-1.5 bg-sky-500/10 hover:bg-sky-500/15 border border-sky-500/20 rounded-lg text-sky-600 dark:text-sky-400 cursor-pointer transition-all"
              >
                <span className="text-[10px] font-bold">Easy</span>
                <span className="text-[8px] opacity-75 mt-0.5">14d</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Completed Screen */
        <div className="flex-1 flex flex-col justify-center items-center p-6 text-center animate-scaleIn">
          <div className="w-16 h-16 bg-emerald-500/15 text-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-sm shadow-emerald-500/10 animate-bounce">
            <Award size={32} />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">Congratulations!</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 max-w-xs">
            You've completed all active flashcards in this deck! The spaced repetition schedule has been successfully updated.
          </p>

          {/* Stats Box */}
          <div className="w-full max-w-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4.5 mb-6 text-left shadow-xs">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Review Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Forgot / Red:</span>
                <span className="font-bold text-red-500">{reviewCount.forgotten}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Hard / Orange:</span>
                <span className="font-bold text-orange-500">{reviewCount.hard}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Good / Green:</span>
                <span className="font-bold text-emerald-500">{reviewCount.good}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Easy / Blue:</span>
                <span className="font-bold text-sky-500">{reviewCount.easy}</span>
              </div>
            </div>
          </div>

          <button
            onClick={restartSession}
            className="flex items-center space-x-1.5 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw size={14} />
            <span>Review Again</span>
          </button>
        </div>
      )}
      <style>{`
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        .animate-scaleIn {
          animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
