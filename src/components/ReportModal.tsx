import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { AlertTriangle, X, ShieldAlert, Check } from 'lucide-react';
import { ReportCategory } from '../types.js';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetDisplayName: string;
  roomId?: string;
  evidenceSnippet?: string;
}

const REPORT_OPTIONS: { label: string; value: ReportCategory; description: string }[] = [
  {
    label: 'Inappropriate Content',
    value: 'inappropriate_content',
    description: 'Explicit, vulgar, sexual remarks, or offensive material.',
  },
  {
    label: 'Spam / Harassment',
    value: 'harassment',
    description: 'Targeted hostility, repeated spam, insults, or disruptive behavior.',
  },
  {
    label: 'Other',
    value: 'other',
    description: 'Off-platform solicitation, safety concern, or rule breach.',
  },
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetUserId,
  targetDisplayName,
  roomId,
  evidenceSnippet,
}) => {
  const { reportUser } = useAuth();
  const [category, setCategory] = useState<ReportCategory>('inappropriate_content');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const detailsToSend = details.trim() || `Reported for ${category}`;
    const ok = await reportUser(targetUserId, category, detailsToSend, roomId);
    setSubmitting(false);
    if (ok) {
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 1800);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2723]/40 backdrop-blur-xs spring-overlay-enter">
      <div
        className="bg-[#FAF8F5] border border-[#E7E0D8] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-[0_12px_40px_rgba(45,39,35,0.15)] space-y-5 text-[#2D2723] spring-modal-enter"
        id="report-modal"
      >
        <div className="flex items-start justify-between border-b border-[#E7E0D8] pb-3.5">
          <div className="flex items-center gap-2.5 text-[#2D2723]">
            <div className="p-2 bg-[#FAF0EB] rounded-xl text-[#C86D51]">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-medium text-lg text-[#2D2723]">Report & Block</h3>
              <p className="text-[11px] text-[#8C827A]">Disconnect immediately and prevent rematching</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8C827A] hover:text-[#2D2723] rounded-full transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-2">
            <p className="font-serif text-base font-medium text-[#2D2723]">Participant Reported & Blocked</p>
            <p className="text-xs text-[#78716C] max-w-xs mx-auto leading-relaxed">
              You have disconnected and blocked this participant. You will not be matched together again.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-[#5C534D] leading-relaxed">
              Reporting <strong className="text-[#2D2723]">{targetDisplayName}</strong>. Submitting immediately terminates the chat for both parties and places a mutual block.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-medium text-[#5C534D]">Select Reason</label>
              <div className="space-y-2" id="report-category-options">
                {REPORT_OPTIONS.map((opt) => {
                  const isSelected = category === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCategory(opt.value)}
                      className={`w-full p-3 rounded-2xl border text-left transition-all flex items-start justify-between cursor-pointer ${
                        isSelected
                          ? 'border-[#C86D51] bg-[#FAF0EB]/60 text-[#2D2723]'
                          : 'border-[#E7E0D8] bg-[#FAF8F5] text-[#5C534D] hover:bg-[#F5F2EB]'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-medium text-[#2D2723]">{opt.label}</div>
                        <div className="text-[11px] text-[#78716C]">{opt.description}</div>
                      </div>
                      {isSelected && (
                        <div className="p-1 bg-[#C86D51] text-white rounded-full shrink-0 mt-0.5">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#5C534D]">
                Additional details <span className="text-[#8C827A] font-normal">(optional)</span>
              </label>
              <textarea
                id="report-details-input"
                rows={2}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Optional description of the issue..."
                className="w-full text-xs p-3 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723] placeholder-[#A89C92]"
              />
            </div>

            <div className="p-3 bg-[#F5F2EB] border border-[#E7E0D8] rounded-2xl text-[11px] text-[#78716C] leading-relaxed">
              <strong className="text-[#2D2723]">Privacy Protection:</strong> No chat transcripts or personal identifiable information are stored with this report.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs text-[#5C534D] hover:text-[#2D2723] rounded-full transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="report-submit-btn"
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] text-xs font-medium rounded-full shadow-2xs disabled:opacity-40 transition-all cursor-pointer"
              >
                {submitting ? 'Reporting...' : 'Report & Block'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
