import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { AlertTriangle, Trash2, X, Eye, EyeOff, Loader2 } from 'lucide-react';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({ isOpen, onClose }) => {
  const { user, deleteAccount } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmedCheck, setConfirmedCheck] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmedCheck) {
      setError('Please acknowledge that this action is irreversible.');
      return;
    }

    setError(null);
    setIsDeleting(true);

    try {
      const result = await deleteAccount(password);
      if (!result.success) {
        setError(result.error || 'Failed to delete account. Please verify your password.');
        setIsDeleting(false);
      } else {
        // Account deleted successfully, auth context cleared, close modal
        setIsDeleting(false);
        setPassword('');
        setConfirmedCheck(false);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred while deleting your account.');
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (isDeleting) return;
    setPassword('');
    setShowPassword(false);
    setConfirmedCheck(false);
    setError(null);
    onClose();
  };

  return (
    <div
      id="delete-account-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2723]/40 backdrop-blur-xs spring-overlay-enter"
    >
      <div
        id="delete-account-modal-card"
        className="bg-[#FAF8F5] w-full max-w-md rounded-3xl border border-[#E7E0D8] shadow-[0_12px_40px_rgba(45,39,35,0.15)] overflow-hidden spring-modal-enter"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#E7E0D8]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#FAF0EB] text-[#C86D51]">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-medium text-[#2D2723]">Delete Account</h2>
              <p className="text-xs text-[#78716C]">Permanent data erasure</p>
            </div>
          </div>
          <button
            id="delete-account-close-btn"
            onClick={handleClose}
            disabled={isDeleting}
            className="p-1.5 rounded-full text-[#8C827A] hover:text-[#2D2723] hover:bg-[#F0EBE1] transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div
              id="delete-account-error"
              className="p-3 bg-[#FAF0E6] border border-[#E7D7C5] rounded-2xl text-xs text-[#7C2D12] flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-[#C86D51] shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Warning summary */}
          <div className="p-4 bg-[#F5F2EB] rounded-2xl border border-[#E7E0D8] text-xs text-[#5C534D] space-y-2">
            <p className="font-medium text-[#7C2D12]">Warning: This action is permanent and irreversible.</p>
            <ul className="list-disc pl-4 space-y-1 text-[#78716C]">
              <li>Your profile, credentials, and session tokens will be permanently erased.</li>
              <li>All mutual friendships and connection lists will be removed.</li>
              <li>You will be immediately disconnected and removed from active matching.</li>
              <li>Ephemeral conversations are never stored, so no chat history remains.</li>
            </ul>
          </div>

          {/* Password confirmation */}
          <div className="space-y-1.5">
            <label
              htmlFor="delete-account-password"
              className="block text-xs font-medium text-[#5C534D]"
            >
              Enter your password to confirm identity
            </label>
            <div className="relative">
              <input
                id="delete-account-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isDeleting}
                placeholder="Account password"
                className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 transition-colors pr-10 text-[#2D2723] placeholder-[#A89C92]"
              />
              <button
                type="button"
                id="delete-account-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isDeleting}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C827A] hover:text-[#2D2723] p-1 cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Explicit acknowledgment checkbox */}
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              id="delete-account-confirm-checkbox"
              checked={confirmedCheck}
              onChange={(e) => setConfirmedCheck(e.target.checked)}
              disabled={isDeleting}
              className="mt-0.5 rounded border-[#D5CBC2] text-[#C86D51] focus:ring-[#C86D51] cursor-pointer"
            />
            <span className="text-xs text-[#78716C] leading-snug">
              I understand that deleting my account is irreversible and all my account data will be permanently wiped.
            </span>
          </label>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              id="delete-account-cancel-btn"
              onClick={handleClose}
              disabled={isDeleting}
              className="px-5 py-2.5 text-xs font-medium text-[#5C534D] hover:text-[#2D2723] rounded-full transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="delete-account-submit-btn"
              disabled={isDeleting || !confirmedCheck || !password}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-medium text-[#FAF8F5] bg-[#C86D51] hover:bg-[#B65E43] active:bg-[#A3523A] rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Permanently Delete Account</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
