import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  HelpCircle,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';

export const COMMON_SECURITY_QUESTIONS = [
  'What was the name of your first childhood pet?',
  'What city were you born in?',
  "What is your mother's maiden name?",
  "What was your first school's name?",
  'Custom question...',
];

interface AccountSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountSecurityModal: React.FC<AccountSecurityModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, updateSecurityQuestion } = useAuth();

  const [selectedPreset, setSelectedPreset] = useState<string>(
    user?.securityQuestion && COMMON_SECURITY_QUESTIONS.includes(user.securityQuestion)
      ? user.securityQuestion
      : user?.securityQuestion
      ? 'Custom question...'
      : COMMON_SECURITY_QUESTIONS[0]
  );
  const [customQuestion, setCustomQuestion] = useState<string>(
    user?.securityQuestion && !COMMON_SECURITY_QUESTIONS.includes(user.securityQuestion)
      ? user.securityQuestion
      : ''
  );
  const [answer, setAnswer] = useState<string>('');
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(null);
      setAnswer('');
      if (user?.securityQuestion) {
        if (COMMON_SECURITY_QUESTIONS.includes(user.securityQuestion)) {
          setSelectedPreset(user.securityQuestion);
          setCustomQuestion('');
        } else {
          setSelectedPreset('Custom question...');
          setCustomQuestion(user.securityQuestion);
        }
      } else {
        setSelectedPreset(COMMON_SECURITY_QUESTIONS[0]);
        setCustomQuestion('');
      }
    }
  }, [isOpen, user?.securityQuestion]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const activeQuestion =
      selectedPreset === 'Custom question...' ? customQuestion.trim() : selectedPreset;

    if (!activeQuestion || activeQuestion.length < 3) {
      setError('Please select or enter a valid security question.');
      return;
    }

    if (!answer || answer.trim().length < 2) {
      setError('Please provide an answer (at least 2 characters).');
      return;
    }

    setLoading(true);
    const result = await updateSecurityQuestion(activeQuestion, answer.trim());
    setLoading(false);

    if (result.success) {
      setSuccess('Your security question and answer have been saved successfully.');
      setAnswer('');
    } else {
      setError(result.error || 'Failed to update security question.');
    }
  };

  const isConfigured = Boolean(user?.hasSecurityQuestion || user?.securityQuestion);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2723]/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="bg-[#FAF8F5] border border-[#E7E0D8] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-[0_12px_40px_rgba(45,39,35,0.15)] space-y-5 text-[#2D2723] relative"
          id="account-security-modal"
        >
          <button
            onClick={onClose}
            aria-label="Close security settings"
            className="absolute top-5 right-5 p-1 text-[#8C827A] hover:text-[#2D2723] rounded-full hover:bg-[#EFE9E2] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[#C86D51]">
              <Shield className="w-5 h-5" />
              <span className="text-xs font-semibold tracking-wider uppercase text-[#8C827A]">
                Account Recovery
              </span>
            </div>
            <h2 className="font-serif text-2xl font-normal text-[#2D2723]">
              Security Question
            </h2>
            <p className="text-xs text-[#78716C] leading-relaxed">
              {isConfigured
                ? 'Your secret question is used to reset your password if you ever forget it.'
                : 'Set up a secret question to easily recover your account if you forget your password.'}
            </p>
          </div>

          {/* Existing question notice */}
          {isConfigured && user?.securityQuestion && (
            <div className="p-3.5 bg-[#F4EFEA] border border-[#E2D8CE] rounded-2xl space-y-1">
              <span className="text-[11px] font-medium text-[#78716C] block uppercase tracking-wide">
                Current Question
              </span>
              <p className="text-xs font-medium text-[#2D2723]">
                {user.securityQuestion}
              </p>
            </div>
          )}

          {/* Success notice */}
          {success && (
            <div className="p-3 bg-[#EBF3ED] border border-[#C3D9C8] text-[#2F5938] text-xs rounded-2xl flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#2F5938]" />
              <span>{success}</span>
            </div>
          )}

          {/* Error notice */}
          {error && (
            <div className="p-3 bg-[#FAF0E6] border border-[#E7D7C5] text-[#7C2D12] text-xs rounded-2xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#C86D51]" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Question Selector */}
            <div>
              <label className="block text-xs font-medium text-[#5C534D] mb-1">
                {isConfigured ? 'Choose New Question' : 'Select a Secret Question'}
              </label>
              <div className="relative">
                <HelpCircle className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-3 pointer-events-none" />
                <select
                  id="security-question-preset-select"
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723] appearance-none cursor-pointer"
                >
                  {COMMON_SECURITY_QUESTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Question input */}
            {selectedPreset === 'Custom question...' && (
              <div>
                <label className="block text-xs font-medium text-[#5C534D] mb-1">
                  Your Custom Question
                </label>
                <input
                  id="security-custom-question-input"
                  type="text"
                  required
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder="e.g. What was the name of your first concert?"
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723]"
                />
              </div>
            )}

            {/* Secret Answer */}
            <div>
              <label className="block text-xs font-medium text-[#5C534D] mb-1">
                Secret Answer <span className="text-[11px] text-[#8C827A] font-normal">(case-insensitive)</span>
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-3" />
                <input
                  id="security-answer-input"
                  type={showAnswer ? 'text' : 'password'}
                  required
                  minLength={2}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Your secret answer"
                  className="w-full pl-10 pr-10 py-2.5 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723]"
                />
                <button
                  type="button"
                  onClick={() => setShowAnswer((prev) => !prev)}
                  aria-label={showAnswer ? 'Hide answer' : 'Show answer'}
                  className="absolute right-3.5 top-3 text-[#8C827A] hover:text-[#2D2723] focus:outline-none p-0.5 rounded cursor-pointer"
                >
                  {showAnswer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-[#8C827A] mt-1.5 leading-normal">
                Answers are safely stored as one-way cryptographic hashes. Case and extra spaces are ignored when verifying.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs text-[#78716C] hover:text-[#2D2723] rounded-full hover:bg-[#EFE9E2] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="security-save-btn"
                type="submit"
                disabled={loading || answer.trim().length < 2}
                className="px-5 py-2.5 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] text-xs sm:text-sm font-medium rounded-full disabled:opacity-40 transition-all cursor-pointer shadow-2xs"
              >
                {loading ? 'Saving...' : isConfigured ? 'Update Question' : 'Save Question'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
