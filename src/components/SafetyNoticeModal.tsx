import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { ShieldCheck, HeartHandshake, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SafetyNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedToMatch?: () => void;
}

export const SafetyNoticeModal: React.FC<SafetyNoticeModalProps> = ({
  isOpen,
  onClose,
  onProceedToMatch,
}) => {
  const { user, acknowledgeSafety } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    if (user && !user.safetyAcknowledged) {
      await acknowledgeSafety();
    }
    setSubmitting(false);
    onClose();
    if (onProceedToMatch) {
      onProceedToMatch();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2723]/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="bg-[#FAF8F5] border border-[#E7E0D8] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-[0_12px_40px_rgba(45,39,35,0.15)] space-y-6 text-[#2D2723]"
          id="safety-notice-modal"
        >
          {/* Header */}
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-[#FAF0EB] rounded-2xl text-[#C86D51] mt-0.5 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-normal text-[#2D2723] tracking-tight">
                Safety & Community Notice
              </h2>
              <p className="text-xs text-[#8C827A] mt-0.5">
                Our commitment to a safe, quiet space
              </p>
            </div>
          </div>

          {/* Explanation paragraphs */}
          <div className="space-y-4 text-sm leading-relaxed text-[#5C534D]">
            <div className="p-4 sm:p-5 bg-[#FAF0E6] rounded-2xl border border-[#E7D7C5] text-[#2D2723] space-y-2">
              <p className="font-semibold text-base text-[#572714]">
                Someone is not a sex-chat platform.
              </p>
              <p className="text-[#6D3823] text-xs sm:text-sm leading-relaxed">
                This is a place for genuine human conversation. Sexual propositions, requests for nude or sexual images, sexual harassment, grooming, coercion, and sexually explicit behaviour directed at another person are not allowed.
              </p>
              <p className="text-[#6D3823] text-xs sm:text-sm leading-relaxed">
                If you engage in this behaviour, the conversation may be ended immediately and your account may be suspended for 30 days or longer.
              </p>
              <p className="text-[#844D28] text-xs pt-1.5 border-t border-[#E7D7C5]">
                Conversations may be monitored by automated safety systems and, when necessary, reviewed by trained moderators to help protect genuine users.
              </p>
            </div>

            {/* Reassurance regarding genuine vulnerability & sensitive discussions */}
            <div className="p-4 sm:p-5 bg-[#F5F2EB] rounded-2xl border border-[#E7E0D8] text-[#2D2723] space-y-2">
              <p className="font-medium flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#78716C]">
                <HeartHandshake className="w-4 h-4 text-[#C86D51]" />
                What we welcome
              </p>
              <p className="text-[#5C534D] text-xs sm:text-sm leading-relaxed">
                The system is not judging whether someone is interesting, shy, lonely, sad, awkward, quiet, or emotionally vulnerable. Honest human discussions, including sensitive talks about health, relationships, or life challenges, are welcomed.
              </p>
            </div>

            <p className="text-xs text-[#8C827A]">
              This is a text-only, non-dating environment for adults aged 18 and older. Both participants are free to disconnect at any time.
            </p>
          </div>

          {/* Checkbox acknowledgement */}
          <label className="flex items-start gap-3 cursor-pointer pt-1 group">
            <div className="relative flex items-center mt-0.5">
              <input
                id="safety-acknowledge-checkbox"
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="w-4 h-4 accent-[#C86D51] rounded cursor-pointer"
              />
            </div>
            <span className="text-xs text-[#5C534D] select-none group-hover:text-[#2D2723] transition-colors">
              I understand Someone is for genuine conversation, not sex chatting, and I agree to these safety rules.
            </span>
          </label>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E7E0D8]">
            <button
              id="safety-notice-cancel-btn"
              onClick={onClose}
              className="px-5 py-2.5 text-xs sm:text-sm text-[#5C534D] hover:text-[#2D2723] rounded-full transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="safety-notice-confirm-btn"
              disabled={!agreed || submitting}
              onClick={handleConfirm}
              className="px-7 py-3 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] text-xs sm:text-sm font-medium rounded-full disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
            >
              {submitting ? 'Acknowledging...' : 'I understand and continue'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
