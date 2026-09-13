import React, { useState } from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ICEBREAKER_PROMPTS = [
  'What is something small that brought you peace today?',
  'If you could re-experience any moment for the first time, what would it be?',
  "What's a belief you've changed your mind about over the years?",
  'What is an unexpected sound or scent that always makes you feel nostalgic?',
  'What was something you were worried about in the past that turned out just fine?',
  'If tonight had a soundtrack or background ambience, what would it sound like?',
  "What is a piece of advice you received that you didn't appreciate until much later?",
  'What is a quiet hobby or curiosity you rarely talk about with people in real life?',
  'If you could pause time right now for one hour, what would you do with it?',
  'What is a book, film, or conversation that gently shifted how you see the world?',
  'What do you think is the kindest thing a stranger has ever done for you?',
  "What's a simple everyday routine that brings you comfort?",
  'If you could write a letter to yourself five years ago, what would the first sentence be?',
  "What is something you're looking forward to this week, no matter how small?",
  'What place on earth feels like a sanctuary to you?',
  "What's an unsolved question you often find yourself pondering late at night?",
  'If you could learn any craft or art without effort, what would you choose?',
  'What was the last thing that made you smile or laugh out loud when you were alone?',
  "What's something you value in a conversation that isn't talked about enough?",
  'What has been the most surprising chapter of your life so far?',
  'What is a truth about yourself that took you a long time to accept?',
  "What's a meal or memory that always makes you feel warm and grounded?",
  'If someone gave you an empty journal right now, what would you write on the first page?',
  'What is something you wish more people understood about you?',
];

function getRandomPrompts(count = 3, exclude: string[] = []): string[] {
  const available = ICEBREAKER_PROMPTS.filter((p) => !exclude.includes(p));
  const pool = available.length >= count ? available : ICEBREAKER_PROMPTS;
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

interface IcebreakerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (prompt: string) => void;
}

export const IcebreakerModal: React.FC<IcebreakerModalProps> = ({
  isOpen,
  onClose,
  onSelectPrompt,
}) => {
  const [prompts, setPrompts] = useState<string[]>(() => getRandomPrompts(3));
  const [isShuffling, setIsShuffling] = useState(false);

  const handleShuffle = () => {
    setIsShuffling(true);
    setTimeout(() => {
      setPrompts((prev) => getRandomPrompts(3, prev));
      setIsShuffling(false);
    }, 150);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[#2D2723]/30 backdrop-blur-xs"
          />

          {/* Popover / Sheet */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.96 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed bottom-16 sm:bottom-20 left-4 right-4 sm:left-auto sm:right-auto sm:w-[440px] max-w-lg mx-auto z-50 bg-[#FAF8F5] border border-[#E7E0D8] rounded-3xl p-5 shadow-xl text-[#2D2723] space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#FAF0EB] text-[#C86D51] flex items-center justify-center border border-[#E8C7BC]">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[#2D2723]">Spark a Thought</h3>
                  <p className="text-[11px] text-[#8C827A]">Reflective prompts to begin a conversation</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  id="icebreaker-shuffle-btn"
                  type="button"
                  onClick={handleShuffle}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-[#5C534D] hover:text-[#C86D51] hover:bg-[#F5F2EB] rounded-full border border-[#E7E0D8] transition-colors cursor-pointer"
                  title="Shuffle new prompts"
                >
                  <RefreshCw className={`w-3 h-3 ${isShuffling ? 'animate-spin' : ''}`} />
                  <span>Shuffle</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 text-[#8C827A] hover:text-[#2D2723] rounded-full hover:bg-[#F5F2EB] transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Prompts list */}
            <div className="space-y-2">
              {prompts.map((prompt, idx) => (
                <button
                  key={`${prompt}-${idx}`}
                  type="button"
                  onClick={() => onSelectPrompt(prompt)}
                  className="w-full text-left p-3 rounded-2xl bg-[#F5F2EB] hover:bg-[#FAF0EB] border border-[#E7E0D8] hover:border-[#E8C7BC] text-xs text-[#2D2723] leading-relaxed transition-all cursor-pointer shadow-2xs group flex items-start justify-between gap-2"
                >
                  <span className="group-hover:text-[#C86D51] transition-colors">{prompt}</span>
                  <span className="text-[10px] text-[#8C827A] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    Paste →
                  </span>
                </button>
              ))}
            </div>

            <p className="text-[10px] text-center text-[#8C827A]">
              Tap any thought to insert it into your message box.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
