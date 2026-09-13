import React from 'react';
import { Smartphone, MoreVertical, Share2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallGuideModal: React.FC<InstallGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#2D2723]/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-guide-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        className="bg-[#FAF8F5] border border-[#E7E0D8] rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-[0_12px_40px_rgba(45,39,35,0.15)] space-y-5 text-[#2D2723]"
        id="install-guide-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E7E0D8]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#FAF0EB] text-[#C86D51] flex items-center justify-center border border-[#E8C7BC] shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="install-guide-title"
                className="font-serif font-medium text-lg text-[#2D2723] leading-tight"
              >
                Install Someone
              </h3>
              <p className="text-[11px] text-[#8C827A]">
                Add to your home screen for quick, distraction-free conversations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8C827A] hover:text-[#2D2723] rounded-full transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step-by-step instructions */}
        <div className="space-y-3">
          {/* Android (Chrome) */}
          <div className="p-4 bg-[#F5F2EB] border border-[#E7E0D8] rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#2D2723]">
              <MoreVertical className="w-3.5 h-3.5 text-[#C86D51]" />
              <span>For Android (Chrome):</span>
            </div>
            <ol className="text-xs text-[#5C534D] leading-relaxed pl-5 list-decimal space-y-1">
              <li>Tap the three dots (⋮) in Chrome.</li>
              <li>Select &apos;Install app&apos; or &apos;Add to Home screen&apos;.</li>
            </ol>
          </div>

          {/* iPhone (Safari) */}
          <div className="p-4 bg-[#F5F2EB] border border-[#E7E0D8] rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#2D2723]">
              <Share2 className="w-3.5 h-3.5 text-[#C86D51]" />
              <span>For iPhone (Safari):</span>
            </div>
            <ol className="text-xs text-[#5C534D] leading-relaxed pl-5 list-decimal space-y-1">
              <li>Tap the Share icon (square with arrow) at the bottom.</li>
              <li>Select &apos;Add to Home Screen&apos;.</li>
            </ol>
          </div>
        </div>

        {/* Got it action button */}
        <div className="pt-1">
          <button
            id="install-guide-got-it-btn"
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] font-medium text-xs sm:text-sm rounded-full transition-all cursor-pointer shadow-2xs text-center"
          >
            Got it
          </button>
        </div>
      </motion.div>
    </div>
  );
};
