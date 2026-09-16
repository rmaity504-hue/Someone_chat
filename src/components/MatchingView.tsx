import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { motion, AnimatePresence } from 'motion/react';
import { HeartHandshake, UserX, Loader2, Bot } from 'lucide-react';
import { ConnectionStatusBar } from './ConnectionStatusBar.js';
import { socketService } from '../services/socket.js';

export interface MatchingViewProps {
  onCancel: () => void;
  topics?: string[];
  onBroadenTopics?: () => void;
}

const STATUS_LINES = [
  'Looking across timezones...',
  'Finding someone awake...',
  'Presence takes time...',
];

export const MatchingView: React.FC<MatchingViewProps> = ({ onCancel, topics, onBroadenTopics }) => {
  const { user, matchingState, acceptMatch, enterMatching, leaveMatching, matchWithCompanion } = useAuth();
  const [connectingCompanion, setConnectingCompanion] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [activeTopics, setActiveTopics] = useState<string[]>(topics || []);

  useEffect(() => {
    setActiveTopics(topics || []);
  }, [topics]);

  // Track time in matching queue
  useEffect(() => {
    if (matchingState.state === 'searching' && !matchingState.offerId) {
      const timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setElapsedSeconds(0);
    }
  }, [matchingState.state, matchingState.offerId]);

  // Cycle reassuring status lines every 10 seconds
  useEffect(() => {
    if (matchingState.state === 'searching' && !matchingState.offerId) {
      const statusTimer = setInterval(() => {
        setStatusIndex((prev) => (prev + 1) % STATUS_LINES.length);
      }, 10000);
      return () => clearInterval(statusTimer);
    }
  }, [matchingState.state, matchingState.offerId]);

  // Clean queue cancellation on browser tab close or navigate away
  useEffect(() => {
    const handleUnload = () => {
      if (matchingState.state === 'searching' && !matchingState.offerId) {
        socketService.send('leave_queue');
        socketService.send('matching:leave');
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [matchingState.state, matchingState.offerId]);

  // Only allow test companion simulator in local development (import.meta.env.DEV) or for authenticated administrators
  const isDevOrAdmin = Boolean(import.meta.env.DEV || user?.role === 'admin' || user?.isAdmin);

  const handleMatchWithCompanion = async () => {
    setConnectingCompanion(true);
    try {
      await matchWithCompanion();
    } finally {
      setConnectingCompanion(false);
    }
  };

  const handleConnect = () => {
    if (matchingState.offerId) {
      setConnecting(true);
      acceptMatch(matchingState.offerId);
    }
  };

  const handleStay = () => {
    setConnecting(false);
    enterMatching();
  };

  const handleLeave = () => {
    navigator.vibrate?.(10);
    setConnecting(false);
    socketService.send('leave_queue');
    leaveMatching();
    onCancel();
  };

  const handleBroadenTopics = () => {
    navigator.vibrate?.(10);
    setActiveTopics([]);
    enterMatching([]); // clears specific topic filters to match with anyone
    onBroadenTopics?.();
  };

  const handleStepBack = () => {
    navigator.vibrate?.(10);
    handleLeave();
  };

  return (
    <div
      className="flex-1 flex flex-col justify-center items-center px-4 py-12 max-w-lg mx-auto text-center w-full"
      id="matching-view"
    >
      <div className="w-full mb-4 rounded-2xl overflow-hidden shadow-2xs">
        <ConnectionStatusBar />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full space-y-8 p-8 sm:p-10 rounded-3xl bg-[#FAF8F5] border border-[#E7E0D8] shadow-[0_10px_35px_-4px_rgba(45,39,35,0.06)]"
      >
        {/* STATE 1: SEARCHING / FINDING SOMEONE */}
        {matchingState.state === 'searching' && !matchingState.offerId && (
          <div className="space-y-6">
            {/* Ambient pulsating circle / calm breathing animation */}
            <div
              className="relative flex items-center justify-center py-8 my-1 select-none"
              id="ambient-breathing-animation"
              aria-label="Ambient calm breathing animation"
            >
              {/* Outer breathing aura */}
              <motion.div
                className="absolute w-40 h-40 rounded-full bg-[#C86D51]/10 pointer-events-none"
                animate={{
                  scale: [1, 1.25, 1],
                  opacity: [0.25, 0.55, 0.25],
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: [0.4, 0, 0.2, 1],
                }}
              />

              {/* Middle soft atmospheric circle */}
              <motion.div
                className="absolute w-28 h-28 rounded-full bg-[#FAF0EB] border border-[#E8C7BC]/80 pointer-events-none"
                animate={{
                  scale: [1, 1.12, 1],
                  opacity: [0.6, 0.9, 0.6],
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: [0.4, 0, 0.2, 1],
                  delay: 0.2,
                }}
              />

              {/* Core calm center circle with subtle breathing scale */}
              <motion.div
                className="relative w-16 h-16 rounded-full bg-[#FAF0EB] border border-[#E8C7BC] flex items-center justify-center text-[#C86D51] shadow-[0_4px_20px_-2px_rgba(200,109,81,0.2)] z-10"
                animate={{
                  scale: [0.96, 1.04, 0.96],
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: [0.4, 0, 0.2, 1],
                }}
              >
                {/* Inner glowing presence dot */}
                <motion.div
                  className="w-3.5 h-3.5 rounded-full bg-[#C86D51]"
                  animate={{
                    scale: [0.85, 1.25, 0.85],
                    opacity: [0.75, 1, 0.75],
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                />
              </motion.div>
            </div>

            <div className="space-y-2.5">
              <h2
                id="matching-searching-text"
                className="font-serif text-2xl sm:text-3xl font-normal text-[#2D2723] tracking-tight"
              >
                Finding someone who&apos;s available...
              </h2>

              {/* Reassuring status lines cycling every 10 seconds */}
              <div className="h-7 flex items-center justify-center overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={statusIndex}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    id="matching-status-cycle-text"
                    className="text-xs sm:text-sm text-[#78716C] font-medium tracking-wide"
                  >
                    {STATUS_LINES[statusIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>

              {activeTopics && activeTopics.length > 0 ? (
                <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1.5">
                  <span className="text-xs text-[#8C827A]">Topics:</span>
                  {activeTopics.map((t) => (
                    <span
                      key={t}
                      className="px-2.5 py-0.5 bg-[#FAF0EB] text-[#C86D51] text-xs font-medium rounded-full border border-[#E8C7BC]"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="pt-0.5">
                  <span className="text-[11px] text-[#8C827A] italic">Matching with anyone worldwide</span>
                </div>
              )}
            </div>

            {/* EXTENDED WAIT REASSURANCE (> 45s) */}
            {elapsedSeconds >= 45 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                id="extended-wait-reassurance"
                className="p-4 sm:p-5 rounded-2xl bg-[#F6F1EA] border border-[#E8DFD5] space-y-3 text-center shadow-2xs"
              >
                <p className="text-xs sm:text-sm text-[#6B625B] leading-relaxed">
                  It&apos;s quiet right now. You can keep waiting, or broaden your topics.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    id="broaden-topics-btn"
                    onClick={handleBroadenTopics}
                    className="w-full sm:w-auto px-5 py-2.5 text-xs font-medium text-[#FAF8F5] bg-[#C86D51] hover:bg-[#B65E43] rounded-full shadow-2xs transition-all cursor-pointer"
                  >
                    Broaden Topics to &apos;Any&apos;
                  </button>
                  <button
                    type="button"
                    id="step-back-btn"
                    onClick={handleStepBack}
                    className="w-full sm:w-auto px-5 py-2.5 text-xs font-medium text-[#5C534D] hover:text-[#2D2723] bg-[#EAE3D9] hover:bg-[#DDD5CA] border border-[#DDD3C7] rounded-full transition-all cursor-pointer"
                  >
                    Step Back
                  </button>
                </div>
              </motion.div>
            )}

            <div className="pt-2 flex flex-col items-center gap-3">
              <button
                id="matching-leave-btn"
                onClick={handleLeave}
                className="px-7 py-2.5 text-xs sm:text-sm text-[#5C534D] hover:text-[#2D2723] hover:bg-[#F5F2EB] border border-[#E7E0D8] rounded-full transition-all cursor-pointer shadow-2xs"
              >
                Cancel
              </button>

              {isDevOrAdmin && (
                <div className="pt-3 border-t border-[#E7E0D8]/80 w-full max-w-xs flex flex-col items-center">
                  <button
                    id="matching-test-companion-btn"
                    onClick={handleMatchWithCompanion}
                    disabled={connectingCompanion}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#F5F2EB] hover:bg-[#EDE6DC] text-[#5C534D] text-xs font-medium rounded-full border border-[#E7E0D8] transition-colors shadow-2xs w-full cursor-pointer disabled:opacity-50"
                  >
                    {connectingCompanion ? (
                      <Loader2 className="w-3.5 h-3.5 text-[#8C827A] animate-spin" />
                    ) : (
                      <Bot className="w-3.5 h-3.5 text-[#8C827A]" />
                    )}
                    <span>{connectingCompanion ? 'Connecting...' : 'Match with Test Companion'}</span>
                  </button>
                  <span className="text-[10px] text-[#8C827A] mt-1">Single-user development simulator</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STATE 2: MATCH FOUND ("Someone is here.") */}
        {matchingState.offerId && matchingState.state !== 'volunteer_available' && (
          <div className="space-y-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#FAF0EB] border border-[#E8C7BC] flex items-center justify-center text-[#C86D51] shadow-xs">
              <HeartHandshake className="w-7 h-7" />
            </div>

            <div className="space-y-2.5">
              <h2
                id="matching-someone-is-here-text"
                className="font-serif text-3xl font-normal text-[#2D2723] tracking-tight"
              >
                Someone is here.
              </h2>
              <p className="text-xs sm:text-sm text-[#78716C] max-w-xs mx-auto leading-relaxed">
                Both participants connect voluntarily to begin a private conversation.
              </p>
            </div>

            {matchingState.statusMessage && (
              <div className="flex items-center justify-center gap-2 text-xs text-[#C86D51] font-medium bg-[#FAF0EB] py-1.5 px-3 rounded-full mx-auto max-w-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{matchingState.statusMessage}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                id="matching-connect-btn"
                onClick={handleConnect}
                disabled={connecting}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#C86D51] hover:bg-[#B65E43] disabled:opacity-60 text-[#FAF8F5] font-medium text-sm sm:text-base rounded-full shadow-[0_4px_20px_-2px_rgba(200,109,81,0.28)] hover:shadow-[0_6px_24px_-2px_rgba(200,109,81,0.38)] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {connecting && <Loader2 className="w-4 h-4 animate-spin text-[#FAF8F5]" />}
                <span>{connecting ? 'Connecting...' : 'Connect'}</span>
              </button>
              <button
                id="matching-decline-btn"
                onClick={handleLeave}
                className="w-full sm:w-auto px-6 py-3.5 text-[#78716C] hover:text-[#2D2723] hover:bg-[#F5F2EB] border border-[#E7E0D8] rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer"
              >
                Not now
              </button>
            </div>
          </div>
        )}

        {/* STATE 3: VOLUNTEER FALLBACK FOR ORDINARY USER ("Someone is available to talk.") */}
        {matchingState.state === 'volunteer_available' && (
          <div className="space-y-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#FAF0EB] border border-[#E8C7BC] flex items-center justify-center text-[#C86D51] shadow-xs">
              <HeartHandshake className="w-7 h-7" />
            </div>

            <div className="space-y-2.5">
              <h2
                id="matching-volunteer-available-text"
                className="font-serif text-2xl sm:text-3xl font-normal text-[#2D2723] tracking-tight"
              >
                Someone is available to talk.
              </h2>
              <p className="text-xs sm:text-sm text-[#78716C] max-w-xs mx-auto leading-relaxed">
                A community member has made themselves available as a quiet, thoughtful listener.
              </p>
            </div>

            {matchingState.statusMessage && (
              <div className="flex items-center justify-center gap-2 text-xs text-[#C86D51] font-medium bg-[#FAF0EB] py-1.5 px-3 rounded-full mx-auto max-w-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{matchingState.statusMessage}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                id="matching-volunteer-connect-btn"
                onClick={handleConnect}
                disabled={connecting}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#C86D51] hover:bg-[#B65E43] disabled:opacity-60 text-[#FAF8F5] font-medium text-sm sm:text-base rounded-full shadow-[0_4px_20px_-2px_rgba(200,109,81,0.28)] hover:shadow-[0_6px_24px_-2px_rgba(200,109,81,0.38)] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {connecting && <Loader2 className="w-4 h-4 animate-spin text-[#FAF8F5]" />}
                <span>{connecting ? 'Connecting...' : 'Connect'}</span>
              </button>
              <button
                id="matching-volunteer-decline-btn"
                onClick={handleLeave}
                className="w-full sm:w-auto px-6 py-3.5 text-[#78716C] hover:text-[#2D2723] hover:bg-[#F5F2EB] border border-[#E7E0D8] rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer"
              >
                Leave
              </button>
            </div>
          </div>
        )}

        {/* STATE 4: NO ONE AVAILABLE */}
        {matchingState.state === 'no_one_available' && (
          <div className="space-y-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#F5F2EB] border border-[#E7E0D8] flex items-center justify-center text-[#8C827A]">
              <UserX className="w-7 h-7" />
            </div>

            <div className="space-y-2.5">
              <h2
                id="matching-no-one-available-text"
                className="font-serif text-2xl sm:text-3xl font-normal text-[#2D2723] tracking-tight"
              >
                No one is available right now.
              </h2>
              <p className="text-xs sm:text-sm text-[#78716C] max-w-xs mx-auto leading-relaxed">
                People enter and leave voluntarily across timezones. You may remain available or come back when it suits you.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                id="matching-stay-available-btn"
                onClick={handleStay}
                className="w-full sm:w-auto px-7 py-3 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] text-xs sm:text-sm font-medium rounded-full shadow-[0_4px_16px_-2px_rgba(200,109,81,0.25)] transition-all cursor-pointer"
              >
                Remain available
              </button>
              <button
                id="matching-leave-now-btn"
                onClick={handleLeave}
                className="w-full sm:w-auto px-7 py-3 text-[#5C534D] hover:text-[#2D2723] hover:bg-[#F5F2EB] text-xs sm:text-sm border border-[#E7E0D8] rounded-full transition-all cursor-pointer"
              >
                Leave for now
              </button>
            </div>

            {isDevOrAdmin && (
              <div className="pt-3 border-t border-[#E7E0D8]/80 w-full max-w-xs mx-auto flex flex-col items-center">
                <button
                  id="matching-no-one-test-companion-btn"
                  onClick={handleMatchWithCompanion}
                  disabled={connectingCompanion}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#F5F2EB] hover:bg-[#EDE6DC] text-[#5C534D] text-xs font-medium rounded-full border border-[#E7E0D8] transition-colors shadow-2xs w-full cursor-pointer disabled:opacity-50"
                >
                  {connectingCompanion ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#8C827A] animate-spin" />
                  ) : (
                    <Bot className="w-3.5 h-3.5 text-[#8C827A]" />
                  )}
                  <span>{connectingCompanion ? 'Connecting...' : 'Match with Test Companion'}</span>
                </button>
                <span className="text-[10px] text-[#8C827A] mt-1">Single-user development simulator</span>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export const MatchmakerView = MatchingView;
export type MatchmakerViewProps = MatchingViewProps;
