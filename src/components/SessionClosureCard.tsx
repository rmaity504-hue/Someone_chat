import React, { useEffect, useState, useRef } from 'react';
import { Feather, ShieldCheck, Compass, Home } from 'lucide-react';

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
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      setSecondsRemaining(5);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setSecondsRemaining(5);
    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          onReturnHome();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, onReturnHome]);

  if (!isOpen) return null;

  return (
    <div
      id="session-closure-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="closure-headline"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#FAF8F5]/98 backdrop-blur-md spring-overlay-enter"
    >
      <div
        id="session-closure-card"
        className="w-full max-w-md bg-[#FAF8F5] rounded-3xl border border-[#E7E0D8] shadow-[0_20px_60px_-15px_rgba(45,39,35,0.12)] p-8 sm:p-10 text-center space-y-7 spring-modal-enter relative overflow-hidden"
      >
        {/* Subtle breathing background radiance */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#C86D51]/5 rounded-full blur-2xl pointer-events-none" />

        {/* Slow circular breathing / pulse animation using terracotta (#C86D51) */}
        <div className="relative w-28 h-28 mx-auto flex items-center justify-center my-2">
          {/* Outermost expanding breath wave */}
          <div className="absolute inset-0 rounded-full border border-[#C86D51]/20 animate-ping [animation-duration:3.2s]" />
          {/* Middle expanding breath pulse */}
          <div className="absolute inset-2 rounded-full bg-[#C86D51]/10 animate-pulse [animation-duration:4s]" />
          {/* Inner breathing halo */}
          <div className="absolute inset-4 rounded-full bg-[#FAF0EB] border border-[#E8C7BC] flex items-center justify-center shadow-inner">
            <Feather className="w-7 h-7 text-[#C86D51] transition-transform duration-700 hover:rotate-12" />
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
          <p className="text-sm text-[#78716C] leading-relaxed max-w-xs mx-auto">
            The room has dissolved. No logs were kept. Take care of yourself.
          </p>
        </div>

        {/* Ephemeral Privacy Reassurance Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F2ECE4] text-[#8C827A] text-[11px] font-mono mx-auto">
          <ShieldCheck className="w-3.5 h-3.5 text-[#2F5938]" />
          <span>zero retention • ephemeral key purged</span>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 relative z-10">
          <button
            type="button"
            id="closure-find-another-btn"
            onClick={() => {
              if (timerRef.current) clearInterval(timerRef.current);
              onFindAnother();
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-[#2D2723] hover:bg-[#433B35] text-[#FAF8F5] text-xs font-medium rounded-full shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-[#E7E0D8]" />
            <span>Find another person</span>
          </button>

          <button
            type="button"
            id="closure-return-home-btn"
            onClick={() => {
              if (timerRef.current) clearInterval(timerRef.current);
              onReturnHome();
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-[#F2ECE4] hover:bg-[#E7DFD3] text-[#5C534D] hover:text-[#2D2723] text-xs font-medium rounded-full transition-colors cursor-pointer border border-[#E7E0D8]"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return home</span>
          </button>
        </div>

        {/* Gentle 5-second automatic progression indicator */}
        <div className="space-y-1 pt-1">
          <div className="w-full bg-[#E7E0D8]/60 h-1 rounded-full overflow-hidden">
            <div
              className="bg-[#C86D51] h-full transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${(secondsRemaining / 5) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-[#A8A29E]">
            Quietly returning home in {secondsRemaining}s
          </p>
        </div>
      </div>
    </div>
  );
};
