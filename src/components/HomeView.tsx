import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { motion } from 'motion/react';
import { Sparkles, MessageSquare, ShieldCheck, Heart } from 'lucide-react';

interface HomeViewProps {
  onFindSomeone: () => void;
  onOpenAuth: () => void;
  onOpenSafety: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onFindSomeone,
  onOpenAuth,
  onOpenSafety,
}) => {
  const { user } = useAuth();

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 py-12 md:py-20 text-center max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-8"
      >
        {/* Welcoming unhurried microcopy badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F5F2EB] border border-[#E7E0D8] text-xs font-medium text-[#78716C] shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C86D51]"></span>
            <span>A quiet corner for genuine human conversation</span>
          </div>
        </div>

        {/* Primary and Supporting Messages */}
        <div className="space-y-4">
          <h1
            id="home-primary-message"
            className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal text-[#2D2723] tracking-tight leading-[1.22]"
          >
            There are people awake all over the world.
          </h1>
          <p
            id="home-supporting-message"
            className="text-base sm:text-lg md:text-xl text-[#5C534D] font-normal max-w-lg mx-auto leading-relaxed"
          >
            Sometimes, you just want another human being to talk to. No profiles, no judgments, just simple presence.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <button
            id="home-find-someone-btn"
            onClick={onFindSomeone}
            className="w-full sm:w-auto px-9 py-3.5 bg-[#C86D51] hover:bg-[#B65E43] active:bg-[#A35239] text-[#FAF8F5] rounded-full font-medium text-base transition-all duration-200 shadow-[0_4px_20px_-2px_rgba(200,109,81,0.28)] hover:shadow-[0_6px_24px_-2px_rgba(200,109,81,0.38)] active:scale-[0.98] cursor-pointer"
          >
            Find someone
          </button>

          {!user && (
            <button
              id="home-sign-in-btn"
              onClick={onOpenAuth}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#F5F2EB] hover:bg-[#EDE6DC] text-[#2D2723] rounded-full font-medium text-base border border-[#E7E0D8] transition-all duration-200 shadow-2xs cursor-pointer"
            >
              Sign in
            </button>
          )}
        </div>

        {/* Core philosophy reassurance (subtle, non-distracting) */}
        <div className="pt-10 border-t border-[#E7E0D8]/70 max-w-md mx-auto text-xs text-[#8C827A] space-y-2 leading-relaxed">
          <p>
            18+ only. Genuine text conversation between two adults. No profiles, no popularity, no dating algorithms.
          </p>
          <p>
            Conversations are subject to clearly disclosed safety monitoring.{' '}
            <button
              id="home-read-safety-link"
              onClick={onOpenSafety}
              className="underline underline-offset-3 decoration-[#E7E0D8] hover:decoration-[#5C534D] text-[#5C534D] hover:text-[#2D2723] transition-colors"
            >
              Read our safety notice
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
