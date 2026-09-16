import React, { useState, useEffect } from 'react';
import { Feather, ShieldCheck, Compass, Home } from 'lucide-react';
import { triggerGentleHaptic } from '../utils/feedback.js';

interface SessionClosureCardProps {
  isOpen: boolean;
  onFindAnother: () => void;
  onReturnHome: () => void;
}

export const SessionClosureCard: React.FC<SessionClosureCardProps> = ({
  isOpen,
  onFindAnother,
  onReturnHome,
}) => {
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);

  // Reset sentiment state whenever the closure card is freshly opened
  useEffect(() => {
    if (isOpen) {
      setHasSubmitted(false);
    }
  }, [isOpen]);

  const handleRatingSelect = async (rating: 'peaceful' | 'neutral' | 'disruptive') => {
    triggerGentleHaptic(12);
    setHasSubmitted(true);

    try {
      await fetch('/api/metrics/sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      });
    } catch {
      // Quiet fire-and-forget metric transmission
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="session-closure-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="closure-headline"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#FAF8F5]/80 backdrop-blur-xs spring-overlay-enter"
    >
      <div
        id="session-closure-card"
        className="w-full max-w-md bg-[#FAF8F5] rounded-3xl border border-[#E7E0D8] shadow-[0_20px_60px_-15px_rgba(45,39,35,0.12)] p-8 sm:p-10 text-center space-y-6 spring-modal-enter relative overflow-hidden"
      >
        {/* Subtle breathing background radiance */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#C86D51]/5 rounded-full blur-2xl pointer-events-none" />

        {/* Slow circular breathing / pulse animation using terracotta (#C86D51) */}
        <div className="relative w-24 h-24 mx-auto flex items-center justify-center my-1">
          {/* Outermost expanding breath wave */}
          <div className="absolute inset-0 rounded-full border border-[#C86D51]/20 animate-ping [animation-duration:3.2s]" />
          {/* Middle expanding breath pulse */}
          <div className="absolute inset-2 rounded-full bg-[#C86D51]/10 animate-pulse [animation-duration:4s]" />
          {/* Inner breathing halo */}
          <div className="absolute inset-4 rounded-full bg-[#FAF0EB] border border-[#E8C7BC] flex items-center justify-center shadow-inner">
            <Feather className="w-6 h-6 text-[#C86D51] transition-transform duration-700 hover:rotate-12" />
          </div>
        </div>

        {/* Headline & Subtext */}
        <div className="space-y-2.5 relative z-10">
          <h2
            id="closure-headline"
            className="font-serif text-2xl sm:text-3xl font-normal text-[#2D2723] tracking-tight"
          >
            This moment has passed.
          </h2>
          <p className="text-sm text-[#78716C] leading-relaxed max-w-sm mx-auto">
            Every conversation is a quiet intersection. Thank you for sharing your presence.
          </p>
        </div>

        {/* Anonymous Session Health Sentiment Check (1-tap feedback) */}
        <div className="pt-1 pb-0.5 relative z-10" id="sentiment-feedback-container">
          {!hasSubmitted ? (
            <div className="space-y-2">
              <p className="text-[11px] font-sans text-[#78716C] tracking-wide">
                How did this conversation feel?
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button
                  type="button"
                  id="sentiment-peaceful-btn"
                  onClick={() => handleRatingSelect('peaceful')}
                  aria-label="Rate conversation as peaceful"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#E7E0D8] bg-[#FAF8F5] hover:bg-[#F2ECE4] text-xs text-[#5C534D] hover:text-[#2D2723] hover:border-[#D6CCC2] transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <span className="text-sm select-none" aria-hidden="true">🕊️</span>
                  <span className="font-medium">Peaceful</span>
                </button>

                <button
                  type="button"
                  id="sentiment-neutral-btn"
                  onClick={() => handleRatingSelect('neutral')}
                  aria-label="Rate conversation as neutral"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#E7E0D8] bg-[#FAF8F5] hover:bg-[#F2ECE4] text-xs text-[#5C534D] hover:text-[#2D2723] hover:border-[#D6CCC2] transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <span className="text-sm select-none" aria-hidden="true">☕</span>
                  <span className="font-medium">Neutral</span>
                </button>

                <button
                  type="button"
                  id="sentiment-disruptive-btn"
                  onClick={() => handleRatingSelect('disruptive')}
                  aria-label="Rate conversation as disruptive"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#E7E0D8] bg-[#FAF8F5] hover:bg-[#F2ECE4] text-xs text-[#5C534D] hover:text-[#2D2723] hover:border-[#D6CCC2] transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <span className="text-sm select-none" aria-hidden="true">⚠️</span>
                  <span className="font-medium">Disruptive</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              id="sentiment-thank-you"
              className="py-1.5 px-4 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#FAF0EB] border border-[#E8C7BC] text-xs text-[#C86D51] font-serif italic"
            >
              <span>Thank you.</span>
            </div>
          )}
        </div>

        {/* Ephemeral Privacy Reassurance Badge */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#F2ECE4] text-[#78716C] text-[11px] font-mono mx-auto border border-[#E7E0D8]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#2F5938]" />
          <span>zero retention • ephemeral key purged</span>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 relative z-10">
          <button
            type="button"
            id="closure-return-home-btn"
            onClick={() => {
              triggerGentleHaptic(15);
              onReturnHome();
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-[#2D2723] hover:bg-[#433B35] text-[#FAF8F5] text-xs font-medium rounded-full shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return to Quiet Corner</span>
          </button>

          <button
            type="button"
            id="closure-find-another-btn"
            onClick={() => {
              triggerGentleHaptic(15);
              onFindAnother();
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-[#F2ECE4] hover:bg-[#E7DFD3] text-[#5C534D] hover:text-[#2D2723] text-xs font-medium rounded-full transition-colors cursor-pointer border border-[#E7E0D8]"
          >
            <Compass className="w-3.5 h-3.5 text-[#C86D51]" />
            <span>Look for Someone New</span>
          </button>
        </div>
      </div>
    </div>
  );
};
