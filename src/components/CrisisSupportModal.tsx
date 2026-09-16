import React, { useEffect } from 'react';
import { Heart, Phone, Globe, X, ExternalLink, Shield } from 'lucide-react';

interface CrisisSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueChat: () => void;
  onClearAndClose: () => void;
}

export const CrisisSupportModal: React.FC<CrisisSupportModalProps> = ({
  isOpen,
  onClose,
  onContinueChat,
  onClearAndClose,
}) => {
  // Allow soft escape via keyboard
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="crisis-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2723]/45 backdrop-blur-xs spring-overlay-enter"
    >
      <div
        id="crisis-support-dialog"
        className="bg-[#FAF8F5] border border-[#E7E0D8] rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 text-[#2D2723] shadow-2xl spring-modal-enter relative overflow-hidden"
      >
        {/* Soft decorative warm background tint */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-[#C86D51]/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        {/* Header with gentle icon and soft close "X" */}
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FAF0EB] border border-[#E8C7BC] flex items-center justify-center text-[#C86D51] shrink-0 shadow-2xs">
              <Heart className="w-5 h-5 fill-[#C86D51]/15" />
            </div>
            <div>
              <span className="text-[11px] font-medium tracking-wide uppercase text-[#C86D51]">
                Support & Care
              </span>
              <h3
                id="crisis-modal-title"
                className="font-serif text-xl sm:text-2xl font-normal text-[#2D2723] tracking-tight leading-snug"
              >
                You don't have to carry this alone.
              </h3>
            </div>
          </div>
          <button
            id="crisis-modal-close-btn"
            onClick={onClose}
            className="p-2 text-[#8C827A] hover:text-[#2D2723] rounded-full hover:bg-[#F5F2EB] transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Empathetic explanation matching required body */}
        <p className="text-sm text-[#5C534D] leading-relaxed relative z-10">
          It sounds like you're going through a heavy moment. While Someone offers quiet companionship, a stranger here may not be equipped to give you the care you deserve right now. Free, confidential support is available 24/7.
        </p>

        {/* Actionable crisis helplines */}
        <div className="space-y-3 relative z-10">
          <p className="text-xs font-medium text-[#78716C] uppercase tracking-wider">
            Free, confidential support available right now:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* India: Tele-MANAS */}
            <a
              id="helpline-telemanas"
              href="tel:14416"
              className="p-3.5 rounded-2xl bg-[#F6F3EE] hover:bg-[#EDE6DC] border border-[#E7E0D8] flex flex-col gap-1 transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#2D2723] flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#C86D51]" />
                  Tele-MANAS (India)
                </span>
                <span className="text-[11px] font-medium text-[#C86D51] group-hover:underline">
                  Dial 14416
                </span>
              </div>
              <p className="text-[11px] text-[#78716C]">
                Call Tele-MANAS (14416) • Toll-free 24/7 or KIRAN (1800-599-0019)
              </p>
            </a>

            {/* US & Canada: 988 Lifeline */}
            <a
              id="helpline-988"
              href="tel:988"
              className="p-3.5 rounded-2xl bg-[#F6F3EE] hover:bg-[#EDE6DC] border border-[#E7E0D8] flex flex-col gap-1 transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#2D2723] flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#C86D51]" />
                  988 Lifeline
                </span>
                <span className="text-[11px] font-medium text-[#C86D51] group-hover:underline flex items-center gap-0.5">
                  Call / Text 988
                </span>
              </div>
              <p className="text-[11px] text-[#78716C]">
                US & Canada • Free, 24/7 crisis counselors
              </p>
            </a>
          </div>

          {/* Worldwide findahelpline */}
          <a
            id="helpline-worldwide"
            href="https://findahelpline.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full p-3.5 rounded-2xl bg-[#F6F3EE] hover:bg-[#EDE6DC] border border-[#E7E0D8] flex items-center justify-between transition-all group text-xs text-[#2D2723] cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-[#C86D51] shrink-0" />
              <div>
                <span className="font-semibold block text-[#2D2723]">Find a Free Helpline Worldwide</span>
                <span className="text-[11px] text-[#78716C]">Confidential support lines across 130+ countries</span>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-[#8C827A] group-hover:text-[#2D2723] shrink-0" />
          </a>
        </div>

        {/* Zero-logging privacy notice */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F5F2EB]/80 border border-[#E7E0D8]/60 text-[11px] text-[#78716C]">
          <Shield className="w-3.5 h-3.5 text-[#8C827A] shrink-0" />
          <span>Evaluated purely in your browser. This is never logged, tagged, or stored on any server.</span>
        </div>

        {/* Secondary Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5 relative z-10 border-t border-[#EAE3DB]">
          <button
            id="crisis-clear-close-btn"
            type="button"
            onClick={onClearAndClose}
            className="w-full sm:w-auto px-4 py-2 text-[#78716C] hover:text-[#A84332] hover:bg-[#F5EBE8] rounded-full text-xs font-medium transition-colors cursor-pointer text-center"
          >
            Clear Message & Close
          </button>

          <button
            id="crisis-still-send-btn"
            type="button"
            onClick={onContinueChat}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#FAF8F5] hover:bg-[#EDE6DC] text-[#2D2723] border border-[#D9D1C7] rounded-full text-xs font-medium transition-all shadow-2xs text-center cursor-pointer"
          >
            I Still Want to Send This Message
          </button>
        </div>
      </div>
    </div>
  );
};
