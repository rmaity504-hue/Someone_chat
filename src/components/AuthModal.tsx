import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Mail,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  ArrowLeft,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';
import { COMMON_SECURITY_QUESTIONS } from './AccountSecurityModal';

export type AuthModalMode = 'signin' | 'register' | 'forgot' | 'reset';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthModalMode;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
}) => {
  const { login } = useAuth();

  const [mode, setMode] = useState<AuthModalMode>(
    initialMode === ('verify' as any) ? 'signin' : initialMode
  );

  // Common form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [isAgeConfirmed, setIsAgeConfirmed] = useState(false);

  // Registration Security Question fields
  const [regQuestionPreset, setRegQuestionPreset] = useState(COMMON_SECURITY_QUESTIONS[0]);
  const [regCustomQuestion, setRegCustomQuestion] = useState('');
  const [regSecurityAnswer, setRegSecurityAnswer] = useState('');
  const [showRegAnswer, setShowRegAnswer] = useState(false);

  // 2-Step Password Reset Flow states
  const [resetEmail, setResetEmail] = useState('');
  const [retrievedQuestion, setRetrievedQuestion] = useState('');
  const [resetAnswer, setResetAnswer] = useState('');
  const [showResetAnswer, setShowResetAnswer] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Status & Feedback states
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(initialMode === ('verify' as any) ? 'signin' : initialMode);
    setError(null);
    setSuccessNotice(null);
    setShowPassword(false);
    setShowNewPassword(false);
    setShowRegAnswer(false);
    setShowResetAnswer(false);
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    if (!isAgeConfirmed) {
      setError('You must confirm you are 18 years of age or older.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    const questionToSave =
      regQuestionPreset === 'Custom question...'
        ? regCustomQuestion.trim()
        : regQuestionPreset;

    if (!questionToSave || questionToSave.length < 3) {
      setError('Please select or specify a security question.');
      return;
    }

    if (!regSecurityAnswer || regSecurityAnswer.trim().length < 2) {
      setError('Please provide an answer to your security question (at least 2 characters).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          displayName,
          isAgeConfirmed,
          security_question: questionToSave,
          security_answer: regSecurityAnswer.trim(),
          securityQuestion: questionToSave,
          securityAnswer: regSecurityAnswer.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      login(data.token, data.user);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Sign in failed');
      }

      login(data.token, data.user);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 1: User enters email and clicks Continue to retrieve security question
  const handleRetrieveSecurityQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    const targetEmail = resetEmail.trim() || email.trim();
    if (!targetEmail) {
      setError('Please enter your account email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/get-security-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No security question configured for this account. Contact admin.');
      }

      setResetEmail(targetEmail);
      setRetrievedQuestion(data.question);
      setResetAnswer('');
      setNewPassword('');
      setConfirmPassword('');
      setMode('reset');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: User answers the security question and submits Verify & Update Password
  const handleResetPasswordWithAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    if (!resetAnswer || resetAnswer.trim().length === 0) {
      setError('Please provide the answer to your security question.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter them carefully.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password-with-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail.trim(),
          answer: resetAnswer.trim(),
          newPassword,
          security_answer: resetAnswer.trim(),
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password.');
      }

      // Backend verifies answer and logs user in immediately
      if (data.token && data.user) {
        login(data.token, data.user);
        onClose();
      } else {
        setEmail(resetEmail.trim());
        setPassword('');
        setResetAnswer('');
        setNewPassword('');
        setConfirmPassword('');
        setMode('signin');
        setSuccessNotice('Your password has been successfully updated. Please sign in.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2723]/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="bg-[#FAF8F5] border border-[#E7E0D8] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-[0_12px_40px_rgba(45,39,35,0.15)] space-y-4 text-[#2D2723] max-h-[90vh] overflow-y-auto"
          id="auth-modal"
        >
          {/* Header */}
          <div className="text-center space-y-1">
            <h2 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-[#2D2723]">
              {mode === 'signin' && 'Sign in to Someone'}
              {mode === 'register' && 'Join Someone'}
              {mode === 'forgot' && 'Forgot Password'}
              {mode === 'reset' && 'Reset Password'}
            </h2>
            <p className="text-xs text-[#78716C] max-w-xs mx-auto leading-relaxed">
              {mode === 'signin' && 'Sign in to find a thoughtful conversation partner'}
              {mode === 'register' && 'Create your account with a secret question for password recovery'}
              {mode === 'forgot' && 'Enter your email address and click continue'}
              {mode === 'reset' && 'Answer your security question and choose a new password'}
            </p>
          </div>

          {/* Success notice */}
          {successNotice && (
            <div className="p-3 bg-[#EBF3ED] border border-[#C3D9C8] text-[#2F5938] text-xs rounded-2xl flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#2F5938]" />
              <span className="leading-relaxed">{successNotice}</span>
            </div>
          )}

          {/* Error notice */}
          {error && (
            <div className="p-3 bg-[#FAF0E6] border border-[#E7D7C5] text-[#7C2D12] text-xs rounded-2xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#C86D51]" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* ============================================================ */}
          {/* 1. FORGOT PASSWORD: STEP 1 (LOOKUP EMAIL & GET QUESTION) */}
          {/* ============================================================ */}
          {mode === 'forgot' && (
            <form onSubmit={handleRetrieveSecurityQuestion} className="space-y-3.5 pt-1">
              <div>
                <label className="block text-xs font-medium text-[#5C534D] mb-1">
                  Account Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-3" />
                  <input
                    id="auth-forgot-email-input"
                    type="email"
                    required
                    value={resetEmail || email}
                    onChange={(e) => {
                      setResetEmail(e.target.value);
                      setEmail(e.target.value);
                    }}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723]"
                  />
                </div>
                <p className="text-[11px] text-[#8C827A] mt-1.5 leading-normal">
                  We will look up the secret recovery question configured for this account.
                </p>
              </div>

              <button
                id="auth-forgot-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] text-sm font-medium rounded-full disabled:opacity-50 transition-all mt-2 cursor-pointer shadow-2xs"
              >
                {loading ? 'Continuing...' : 'Continue'}
              </button>

              <div className="flex items-center justify-center text-xs text-[#78716C] pt-2 px-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                    setSuccessNotice(null);
                  }}
                  className="hover:text-[#2D2723] underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* ============================================================ */}
          {/* 2. FORGOT PASSWORD: STEP 2 (ANSWER QUESTION & NEW PASSWORD) */}
          {/* ============================================================ */}
          {mode === 'reset' && (
            <form onSubmit={handleResetPasswordWithAnswer} className="space-y-3.5 pt-1">
              {/* Retrieved Security Question Card (read-only bold text) */}
              <div className="p-3.5 bg-[#F4EFEA] border border-[#E2D8CE] rounded-2xl space-y-1">
                <div className="flex items-center gap-1.5 text-[#8C827A] text-[11px] font-medium uppercase tracking-wider">
                  <HelpCircle className="w-3.5 h-3.5 text-[#C86D51]" />
                  <span>Security Question</span>
                </div>
                <p className="text-sm font-bold text-[#2D2723] leading-snug">
                  {retrievedQuestion || 'Security question'}
                </p>
              </div>

              {/* Your Answer Input */}
              <div>
                <label className="block text-xs font-medium text-[#5C534D] mb-1">
                  Your Answer <span className="text-[11px] text-[#8C827A] font-normal">(case-insensitive)</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-3" />
                  <input
                    id="auth-reset-answer-input"
                    type={showResetAnswer ? 'text' : 'password'}
                    required
                    value={resetAnswer}
                    onChange={(e) => setResetAnswer(e.target.value)}
                    placeholder="Enter your answer"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetAnswer((prev) => !prev)}
                    aria-label={showResetAnswer ? 'Hide answer' : 'Show answer'}
                    className="absolute right-3.5 top-3 text-[#8C827A] hover:text-[#2D2723] focus:outline-none p-0.5 rounded cursor-pointer"
                  >
                    {showResetAnswer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-medium text-[#5C534D] mb-1">
                  New Password (min. 8 characters)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-3" />
                  <input
                    id="auth-reset-new-password-input"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-3 text-[#8C827A] hover:text-[#2D2723] focus:outline-none p-0.5 rounded cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-medium text-[#5C534D] mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-3" />
                  <input
                    id="auth-reset-confirm-password-input"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723]"
                  />
                </div>
              </div>

              <button
                id="auth-reset-submit-btn"
                type="submit"
                disabled={loading || resetAnswer.trim().length === 0 || newPassword.length < 8}
                className="w-full py-3 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] text-sm font-medium rounded-full disabled:opacity-40 transition-all mt-2 cursor-pointer shadow-2xs"
              >
                {loading ? 'Verifying...' : 'Verify & Update Password'}
              </button>

              <div className="flex items-center justify-between text-xs text-[#78716C] pt-2 px-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError(null);
                  }}
                  className="hover:text-[#2D2723] underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Different email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                    setSuccessNotice(null);
                  }}
                  className="hover:text-[#2D2723] underline underline-offset-2 cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* ============================================================ */}
          {/* 3. SIGN IN FORM */}
          {/* ============================================================ */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-3.5 pt-1">
              <div>
                <label className="block text-xs font-medium text-[#5C534D] mb-1">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-3" />
                  <input
                    id="auth-signin-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setResetEmail(e.target.value);
                    }}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-[#5C534D]">
                    Password
                  </label>
                  <button
                    id="auth-signin-forgot-password-link"
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setMode('forgot');
                      setError(null);
                      setSuccessNotice(null);
                    }}
                    className="text-xs text-[#78716C] hover:text-[#C86D51] underline underline-offset-2 cursor-pointer transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-3" />
                  <input
                    id="auth-signin-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723]"
                  />
                  <button
                    id="auth-signin-toggle-password-btn"
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-3 text-[#8C827A] hover:text-[#2D2723] focus:outline-none transition-colors p-0.5 rounded cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                id="auth-signin-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] text-sm font-medium rounded-full disabled:opacity-50 transition-all mt-2 cursor-pointer shadow-2xs"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                    setSuccessNotice(null);
                  }}
                  className="text-xs text-[#5C534D] hover:text-[#C86D51] underline underline-offset-2 transition-colors cursor-pointer"
                >
                  Need an account? Register
                </button>
              </div>
            </form>
          )}

          {/* ============================================================ */}
          {/* 4. REGISTER FORM (WITH SECURITY QUESTION & ANSWER) */}
          {/* ============================================================ */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-[#5C534D] mb-1">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-3" />
                  <input
                    id="auth-register-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setResetEmail(e.target.value);
                    }}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5C534D] mb-1">
                  Password (min. 8 characters)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-3" />
                  <input
                    id="auth-register-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723]"
                  />
                  <button
                    id="auth-register-toggle-password-btn"
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-3 text-[#8C827A] hover:text-[#2D2723] focus:outline-none transition-colors p-0.5 rounded cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5C534D] mb-1">
                  Display Name (what your partner sees)
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-3" />
                  <input
                    id="auth-register-name-input"
                    type="text"
                    required
                    minLength={2}
                    maxLength={30}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Jordan, River, Sam..."
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723]"
                  />
                </div>
              </div>

              {/* Security Question Section */}
              <div className="pt-1.5 border-t border-[#E7E0D8]/60 space-y-2.5">
                <div className="flex items-center gap-1.5 text-[#8C827A]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#C86D51]" />
                  <span className="text-[11px] font-medium uppercase tracking-wider">
                    Password Recovery Question
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5C534D] mb-1">
                    Security Question
                  </label>
                  <div className="relative">
                    <HelpCircle className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-3 pointer-events-none" />
                    <select
                      id="auth-register-question-select"
                      value={regQuestionPreset}
                      onChange={(e) => setRegQuestionPreset(e.target.value)}
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

                {regQuestionPreset === 'Custom question...' && (
                  <div>
                    <label className="block text-xs font-medium text-[#5C534D] mb-1">
                      Your Custom Question
                    </label>
                    <input
                      id="auth-register-custom-question-input"
                      type="text"
                      required
                      value={regCustomQuestion}
                      onChange={(e) => setRegCustomQuestion(e.target.value)}
                      placeholder="e.g. What was the name of your first concert?"
                      className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-[#5C534D] mb-1">
                    Security Answer <span className="text-[11px] text-[#8C827A] font-normal">(required, case-insensitive)</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-3" />
                    <input
                      id="auth-register-answer-input"
                      type={showRegAnswer ? 'text' : 'password'}
                      required
                      minLength={2}
                      value={regSecurityAnswer}
                      onChange={(e) => setRegSecurityAnswer(e.target.value)}
                      placeholder="Enter your security answer"
                      className="w-full pl-10 pr-10 py-2.5 bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegAnswer((prev) => !prev)}
                      aria-label={showRegAnswer ? 'Hide answer' : 'Show answer'}
                      className="absolute right-3.5 top-3 text-[#8C827A] hover:text-[#2D2723] focus:outline-none p-0.5 rounded cursor-pointer"
                    >
                      {showRegAnswer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* 18+ Confirmation Requirement */}
              <label className="flex items-start gap-2.5 cursor-pointer pt-1 group">
                <input
                  id="auth-register-age-checkbox"
                  type="checkbox"
                  required
                  checked={isAgeConfirmed}
                  onChange={(e) => setIsAgeConfirmed(e.target.checked)}
                  className="w-4 h-4 accent-[#C86D51] rounded mt-0.5 cursor-pointer"
                />
                <span className="text-xs text-[#5C534D] group-hover:text-[#2D2723] transition-colors">
                  I confirm that I am <strong>18 years of age or older</strong>. Someone is strictly for adults.
                </span>
              </label>

              <button
                id="auth-register-submit-btn"
                type="submit"
                disabled={loading || !isAgeConfirmed || regSecurityAnswer.trim().length < 2}
                className="w-full py-3.5 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] text-sm font-medium rounded-full disabled:opacity-40 transition-all mt-2 cursor-pointer shadow-2xs"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>

              <div className="text-center pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                    setSuccessNotice(null);
                  }}
                  className="text-xs text-[#5C534D] hover:text-[#C86D51] underline underline-offset-2 transition-colors cursor-pointer"
                >
                  Already registered? Sign in
                </button>
              </div>
            </form>
          )}

          {/* Close button */}
          <div className="pt-1 text-center">
            <button
              id="auth-modal-close-btn"
              onClick={onClose}
              className="text-xs text-[#8C827A] hover:text-[#2D2723] cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
