import React from 'react';
import { Heart, Phone, Globe, X, ExternalLink, Shield } from 'lucide-react';

interface CrisisSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueChat: () => void;
}

export const CrisisSupportModal: React.FC<CrisisSupportModalProps> = ({
  isOpen,
  onClose,
  onContinueChat,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="crisis-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2723]/45 backdrop-blur-xs spring-overlay-enter"
    >
      <div className="bg-[#FAF8F5] border border-[#E7E0D8] rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 text-[#2D2723] shadow-2xl spring-modal-enter relative overflow-hidden">
        {/* Soft decorative warm background tint */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-[#C86D51]/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        {/* Header with gentle icon and close */}
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FAF0EB] border border-[#E8C7BC] flex items-center justify-center text-[#C86D51] shrink-0 shadow-2xs">
              <Heart className="w-5 h-5 fill-[#C86D51]/15" />
            </div>
            <div>
              <span className="text-[11px] font-medium tracking-wide uppercase text-[#C86D51]">
                Gentle Support
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
            onClick={onClose}
            className="p-2 text-[#8C827A] hover:text-[#2D2723] rounded-full hover:bg-[#F5F2EB] transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Empathetic explanation */}
        <p className="text-sm text-[#5C534D] leading-relaxed relative z-10">
          It sounds like things are heavy right now. A stranger in an anonymous room might not be able to offer the support you deserve, but people who understand are available 24/7.
        </p>

        {/* Actionable crisis helplines */}
        <div className="space-y-3 relative z-10">
          <p className="text-xs font-medium text-[#78716C] uppercase tracking-wider">
            Free, confidential support available right now:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* US & International: 988 */}
            <a
              href="tel:988"
              className="p-3.5 rounded-2xl bg-[#F6F3EE] hover:bg-[#EDE6DC] border border-[#E7E0D8] flex flex-col gap-1 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#2D2723] flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#C86D51]" />
                  988 Lifeline
                </span>
                <span className="text-[11px] font-medium text-[#C86D51] group-hover:underline flex items-center gap-0.5">
                  Call / Text
                </span>
              </div>
              <p className="text-[11px] text-[#78716C]">
                US & Canada • Free, 24/7 confidential crisis support
              </p>
            </a>

            {/* India: Tele-MANAS */}
            <a
              href="tel:14416"
              className="p-3.5 rounded-2xl bg-[#F6F3EE] hover:bg-[#EDE6DC] border border-[#E7E0D8] flex flex-col gap-1 transition-all group"
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
                Toll-free 24/7 helpline across India (or 1800-891-4416 / KIRAN 1800-599-0019)
              </p>
            </a>
          </div>

          {/* Worldwide findahelpline */}
          <a
            href="https://findahelpline.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full p-3 rounded-2xl bg-[#F6F3EE] hover:bg-[#EDE6DC] border border-[#E7E0D8] flex items-center justify-between transition-all group text-xs text-[#2D2723]"
          >
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#C86D51]" />
              <div>
                <span className="font-semibold block">Find A Helpline (Worldwide)</span>
                <span className="text-[11px] text-[#78716C]">Find free support services in over 130 countries</span>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-[#8C827A] group-hover:text-[#2D2723] shrink-0" />
          </a>
        </div>

        {/* Zero-logging privacy notice */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F5F2EB]/80 border border-[#E7E0D8]/60 text-[11px] text-[#78716C]">
          <Shield className="w-3.5 h-3.5 text-[#8C827A] shrink-0" />
          <span>This prompt is private and evaluated only in your browser. Nothing is logged or saved to your account.</span>
        </div>

        {/* Action buttons */}
        <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 relative z-10">
          <button
            type="button"
            onClick={onContinueChat}
            className="w-full sm:w-auto px-5 py-2.5 bg-transparent hover:bg-[#F0EBE1] text-[#78716C] hover:text-[#2D2723] rounded-full text-xs font-medium transition-colors cursor-pointer text-center"
          >
            Continue to Chat
          </button>
          <a
            href="https://findahelpline.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-6 py-2.5 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] rounded-full text-xs font-medium transition-all shadow-xs text-center flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Get Help Now</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
