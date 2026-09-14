import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { X, Send, ShieldCheck, CheckCircle2, MessageSquare, AlertCircle } from 'lucide-react';
import { SupportTicketCategory } from '../types.js';

interface ContactAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: SupportTicketCategory;
}

const CATEGORIES: SupportTicketCategory[] = [
  'Bug',
  'Harassment Report',
  'Account Issue',
  'Feedback',
];

export const ContactAdminModal: React.FC<ContactAdminModalProps> = ({
  isOpen,
  onClose,
  defaultCategory = 'Feedback',
}) => {
  const { user, token } = useAuth();

  const [category, setCategory] = useState<SupportTicketCategory>(defaultCategory);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || subject.trim().length < 3) {
      setError('Subject must be at least 3 characters.');
      return;
    }
    if (!message.trim() || message.trim().length < 10) {
      setError('Message must be at least 10 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/support/ticket', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          message: message.trim(),
          email: guestEmail.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch ticket to admin queue.');
      }

      setSubmittedTicketId(data.ticketId || 'CONFIRMED');
    } catch (err: any) {
      setError(err.message || 'An error occurred while submitting. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setCategory('Feedback');
    setSubject('');
    setMessage('');
    setGuestEmail('');
    setError(null);
    setSubmittedTicketId(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-admin-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2723]/60 backdrop-blur-sm spring-overlay-enter"
      onClick={handleResetAndClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#FAF8F5] rounded-3xl border border-[#E7E0D8] shadow-2xl p-6 sm:p-8 flex flex-col max-h-[90vh] overflow-y-auto spring-modal-enter"
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#E7E0D8]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#FAF0E6] flex items-center justify-center text-[#C86D51]">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 id="contact-admin-title" className="text-lg font-serif font-medium text-[#2D2723]">
                Contact Administration
              </h2>
              <p className="text-xs text-[#8C827A]">
                Direct, privacy-preserving in-app review queue
              </p>
            </div>
          </div>
          <button
            id="contact-admin-close-btn"
            onClick={handleResetAndClose}
            aria-label="Close contact admin modal"
            className="text-[#8C827A] hover:text-[#2D2723] p-1.5 rounded-full hover:bg-[#F2ECE4] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submittedTicketId ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-medium text-[#2D2723]">
                Message sent directly to admin review queue.
              </h3>
              <p className="text-xs text-[#5C534D] max-w-md mx-auto leading-relaxed">
                Thank you for reaching out. Our moderation and engineering staff monitor incoming internal tickets directly without passing your details to third-party mail trackers.
              </p>
              {submittedTicketId !== 'CONFIRMED' && (
                <p className="text-[11px] font-mono text-[#8C827A] pt-1">
                  Ticket reference: <span className="text-[#2D2723] font-semibold">{submittedTicketId}</span>
                </p>
              )}
            </div>
            <div className="pt-4">
              <button
                id="contact-admin-done-btn"
                type="button"
                onClick={handleResetAndClose}
                className="px-6 py-2.5 rounded-full bg-[#2D2723] text-[#FAF8F5] text-xs sm:text-sm font-medium hover:bg-[#443C36] transition-colors cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {error && (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in duration-200"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Privacy note */}
            <div className="p-3 bg-[#F5F2EB] rounded-2xl border border-[#E7E0D8]/80 text-[11px] text-[#5C534D] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[#C86D51] shrink-0 mt-0.5" />
              <span>
                <strong>Confidential Dispatch:</strong> This message is delivered directly into our protected staff dashboard. No external email relays or marketing trackers are used.
              </span>
            </div>

            {/* Category */}
            <div>
              <label htmlFor="contact-category-select" className="block text-xs font-medium text-[#5C534D] mb-1">
                Category
              </label>
              <select
                id="contact-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
                className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723] cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div>
              <label htmlFor="contact-subject-input" className="block text-xs font-medium text-[#5C534D] mb-1">
                Subject
              </label>
              <input
                id="contact-subject-input"
                type="text"
                required
                minLength={3}
                maxLength={120}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your inquiry or report..."
                className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723]"
              />
            </div>

            {/* Message */}
            <div>
              <label htmlFor="contact-message-input" className="block text-xs font-medium text-[#5C534D] mb-1">
                Message Details
              </label>
              <textarea
                id="contact-message-input"
                required
                rows={4}
                minLength={10}
                maxLength={2000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Please describe what happened or what you'd like the admin team to know..."
                className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723] resize-none"
              />
            </div>

            {/* Guest email if not logged in */}
            {!user && (
              <div>
                <label htmlFor="contact-email-input" className="block text-xs font-medium text-[#5C534D] mb-1">
                  Contact Email <span className="text-[11px] text-[#8C827A] font-normal">(optional, if you want a response)</span>
                </label>
                <input
                  id="contact-email-input"
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="your.email@example.com (optional)"
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723]"
                />
              </div>
            )}

            {user && (
              <p className="text-[11px] text-[#8C827A]">
                Dispatching from account: <strong className="text-[#2D2723]">{user.displayName}</strong> ({user.email})
              </p>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-4 py-2.5 rounded-full text-xs sm:text-sm font-medium text-[#5C534D] hover:bg-[#F2ECE4] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="contact-admin-submit-btn"
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-full bg-[#2D2723] hover:bg-[#443C36] text-[#FAF8F5] text-xs sm:text-sm font-medium flex items-center gap-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Send to Admin</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
