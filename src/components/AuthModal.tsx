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
} from 'lucide-react';

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

  const [mode, setMode] = useState<AuthModalMode>(initialMode === ('verify' as any) ? 'signin' : initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [isAgeConfirmed, setIsAgeConfirmed] = useState(false);

  // Password reset flow states
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(initialMode === ('verify' as any) ? 'signin' : initialMode);
    setError(null);
    setSuccessNotice(null);
    setShowPassword(false);
    setShowNewPassword(false);
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

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName, isAgeConfirmed }),
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

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    const targetEmail = resetEmail.trim() || email.trim();
    if (!targetEmail) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to process reset request.');
      }

      setResetEmail(targetEmail);
      setMode('reset');
      if (data.emailWarning) {
        setSuccessNotice(data.emailWarning);
      } else {
        setSuccessNotice(data.message || 'If an account exists with that email, a 6-digit reset code has been sent.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompletePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    if (resetCode.trim().length < 6) {
      setError('Please enter the 6-digit reset code.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify and re-enter.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail.trim(),
          code: resetCode.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password.');
      }

      // Success: return to sign in view with confirmation
      setEmail(resetEmail.trim());
      setPassword('');
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
      setMode('signin');
      setSuccessNotice('Your password has been successfully reset! All prior sessions were signed out. Please sign in with your new password.');
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
          className="bg-[#FAF8F5] border border-[#E7E0D8] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-[0_12px_40px_rgba(45,39,35,0.15)] space-y-5 text-[#2D2723]"
          id="auth-modal"
        >
          {/* Header */}
          <div className="text-center space-y-1.5">
            <h2 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-[#2D2723]">
              {mode === 'signin' && 'Sign in to Someone'}
              {mode === 'register' && 'Join Someone'}
              {mode === 'forgot' && 'Reset your password'}
              {mode === 'reset' && 'Set new password'}
            </h2>
            <p className="text-xs text-[#78716C] max-w-xs mx-auto leading-relaxed">
              {mode === 'signin' && 'Enter to find someone to talk to'}
              {mode === 'register' && 'Only email, password, and a display name are required'}
              {mode === 'forgot' && "Enter your email and we'll dispatch a 6-digit code"}
              {mode === 'reset' && 'Enter the 6-digit code and choose a new password'}
            </p>
          </div>

          {/* Success notice */}
          {successNotice && (
            <div className="p-3 bg-[#EBF3ED] border border-[#C3D9C8] text-[#2F5938] text-xs rounded-2xl flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#2F5938]" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Error notice */}
          {error && (
            <div className="p-3 bg-[#FAF0E6] border border-[#E7D7C5] text-[#7C2D12] text-xs rounded-2xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#C86D51]" />
              <span>{error}</span>
            </div>
          )}

          {/* FORGOT PASSWORD: STEP 1 (REQUEST CODE) */}
          {mode === 'forgot' && (
            <form onSubmit={handleRequestPasswordReset} className="space-y-3.5 pt-1">
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
              </div>

              <button
                id="auth-forgot-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] text-sm font-medium rounded-full disabled:opacity-50 transition-all mt-2 cursor-pointer shadow-2xs"
              >
                {loading ? 'Sending reset code...' : 'Send reset code'}
              </button>

              <div className="flex items-center justify-between text-xs text-[#78716C] pt-2 px-1">
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
                <button
                  type="button"
                  onClick={() => {
                    setMode('reset');
                    setError(null);
                  }}
                  className="hover:text-[#2D2723] underline underline-offset-2 cursor-pointer"
                >
                  Already have a code?
                </button>
              </div>
            </form>
          )}

          {/* FORGOT PASSWORD: STEP 2 (VERIFY CODE & SET NEW PASSWORD) */}
          {mode === 'reset' && (
            <form onSubmit={handleCompletePasswordReset} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-[#5C534D] mb-1">
                  Account Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-3" />
                  <input
                    id="auth-reset-email-input"
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
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5C534D] mb-1">
                  6-Digit Reset Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-3" />
                  <input
                    id="auth-reset-code-input"
                    type="text"
                    maxLength={6}
                    required
                    placeholder="e.g. 123456"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-10 pr-3.5 py-2.5 text-center tracking-widest font-mono text-base bg-[#FAF8F5] border border-[#D5CBC2] focus:border-[#C86D51] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C86D51]/20 text-[#2D2723]"
                  />
                </div>
              </div>

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
                disabled={loading || resetCode.length < 6 || newPassword.length < 8}
                className="w-full py-3 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] text-sm font-medium rounded-full disabled:opacity-40 transition-all mt-2 cursor-pointer shadow-2xs"
              >
                {loading ? 'Updating password...' : 'Reset password & sign in'}
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
                  Request new code
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

          {/* SIGN IN FORM */}
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
                className="w-full py-3.5 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] text-sm font-medium rounded-full disabled:opacity-50 transition-all mt-2 cursor-pointer shadow-2xs"
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

          {/* REGISTER FORM */}
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
                  Display Name (what your conversation partner sees)
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
                disabled={loading || !isAgeConfirmed}
                className="w-full py-3.5 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] text-sm font-medium rounded-full disabled:opacity-40 transition-all mt-2 cursor-pointer shadow-2xs"
              >
                {loading ? 'Creating account...' : 'Create account'}
              </button>

              <div className="text-center pt-2">
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
          <div className="pt-2 text-center">
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
