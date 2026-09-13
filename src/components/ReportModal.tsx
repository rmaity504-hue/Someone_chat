import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { AlertTriangle, X } from 'lucide-react';
import { ReportCategory } from '../types.js';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetDisplayName: string;
  roomId?: string;
  evidenceSnippet?: string;
}

const CATEGORIES: { label: string; value: ReportCategory; description: string }[] = [
  {
    label: 'Spam',
    value: 'spam',
    description: 'Repeated promotional messages, copy-pasting, or automated flooding',
  },
  {
    label: 'Harassment',
    value: 'harassment',
    description: 'Targeted hostility, degradation, stalking, or persistent insults',
  },
  {
    label: 'Inappropriate Content',
    value: 'inappropriate_content',
    description: 'Explicit sexual remarks, vulgar advances, lewd acts, or shocking content',
  },
  {
    label: 'Off-platform solicitation',
    value: 'off_platform_solicitation',
    description: 'Sharing social handles, discord, phone numbers, or asking for money/crypto',
  },
  {
    label: 'Other',
    value: 'other',
    description: 'Other severe behavioural misconduct or rule violation',
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
  const [category, setCategory] = useState<ReportCategory>('harassment');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = await reportUser(targetUserId, category, details, roomId);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2723]/40 backdrop-blur-xs">
      <div
        className="bg-[#FAF8F5] border border-[#E7E0D8] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-[0_12px_40px_rgba(45,39,35,0.15)] space-y-5 text-[#2D2723]"
        id="report-modal"
      >
        <div className="flex items-start justify-between border-b border-[#E7E0D8] pb-3.5">
          <div className="flex items-center gap-2.5 text-[#2D2723]">
            <div className="p-2 bg-[#FAF0EB] rounded-xl text-[#C86D51]">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="font-serif font-medium text-lg text-[#2D2723]">Report Behaviour</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#8C827A] hover:text-[#2D2723] rounded-full transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-2">
            <p className="font-serif text-base font-medium text-[#2D2723]">Report submitted</p>
            <p className="text-xs text-[#78716C] max-w-xs mx-auto leading-relaxed">
              Thank you for keeping Someone safe. This user has been blocked and our moderation team will review the record.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-[#5C534D] leading-relaxed">
              Reporting <strong className="text-[#2D2723]">{targetDisplayName}</strong>. Submitting a report automatically blocks this member and ends the conversation immediately.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#5C534D]">Category of violation</label>
              <select
                id="report-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as ReportCategory)}
                className="w-full text-xs p-3 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723] cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#5C534D]">What happened?</label>
              <textarea
                id="report-details-input"
                required
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe the behaviour observed..."
                className="w-full text-xs p-3 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723] placeholder-[#A89C92]"
              />
            </div>

            <div className="p-3.5 bg-[#F5F2EB] border border-[#E7E0D8] rounded-2xl text-[11px] text-[#78716C] leading-relaxed">
              <strong className="text-[#2D2723]">Note:</strong> Someone moderates behaviour, not emotional states. Users are never penalized for being shy, quiet, sad, lonely, or awkward.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-xs text-[#5C534D] hover:text-[#2D2723] rounded-full transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="report-submit-btn"
                type="submit"
                disabled={submitting || !details.trim()}
                className="px-6 py-2.5 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] text-xs font-medium rounded-full shadow-2xs disabled:opacity-40 transition-all cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Submit report & block'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
