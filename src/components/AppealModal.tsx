import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { AlertOctagon, X, Check } from 'lucide-react';

interface AppealModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppealModal: React.FC<AppealModalProps> = ({ isOpen, onClose }) => {
  const { user, token } = useAuth();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 10) {
      setError('Please provide at least 10 characters explaining your situation.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/appeals/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Failed to submit appeal');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2723]/40 backdrop-blur-xs">
      <div
        className="bg-[#FAF8F5] border border-[#E7E0D8] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-[0_12px_40px_rgba(45,39,35,0.15)] space-y-5 text-[#2D2723]"
        id="appeal-modal"
      >
        <div className="flex items-center justify-between border-b border-[#E7E0D8] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#FAF0EB] rounded-xl text-[#C86D51]">
              <AlertOctagon className="w-4 h-4" />
            </div>
            <h3 className="font-serif font-medium text-lg text-[#2D2723]">Account Appeal</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#8C827A] hover:text-[#2D2723] rounded-full transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#EBF3ED] text-[#2F5938] border border-[#C3D9C8] flex items-center justify-center mx-auto shadow-xs">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="font-serif text-base font-medium text-[#2D2723]">Appeal received</h4>
            <p className="text-xs text-[#78716C] leading-relaxed max-w-xs mx-auto">
              Your appeal has been queued for review by an authorized moderator. You will be notified once a decision has been reached.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] text-xs font-medium rounded-full shadow-2xs transition-all mt-2 cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3.5 bg-[#F5F2EB] border border-[#E7E0D8] rounded-2xl text-xs text-[#5C534D] space-y-1">
              <p className="font-medium text-[#2D2723]">Current status: {user.status}</p>
              {user.restrictionReason && (
                <p className="text-[#5C534D]">Notice: {user.restrictionReason}</p>
              )}
            </div>

            <p className="text-xs text-[#78716C] leading-relaxed">
              If you believe an automated safety flag or report was made in error, please explain what happened. Our moderation team reviews every appeal with care.
            </p>

            {error && (
              <p className="text-xs text-[#7C2D12] bg-[#FAF0E6] border border-[#E7D7C5] p-3 rounded-2xl">
                {error}
              </p>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#5C534D]">Your explanation</label>
              <textarea
                required
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain the context or reason for your appeal..."
                className="w-full text-xs p-3 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723] placeholder-[#A89C92]"
              />
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
                type="submit"
                disabled={submitting || !reason.trim()}
                className="px-6 py-2.5 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] text-xs font-medium rounded-full shadow-2xs disabled:opacity-40 transition-all cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Submit appeal'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
