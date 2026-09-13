import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { motion } from 'motion/react';
import { Radio, HeartHandshake, UserX, Loader2, Bot } from 'lucide-react';

export interface MatchingViewProps {
  onCancel: () => void;
  topics?: string[];
}

export const MatchingView: React.FC<MatchingViewProps> = ({ onCancel, topics }) => {
  const { user, matchingState, acceptMatch, enterMatching, leaveMatching, matchWithCompanion } = useAuth();
  const [connectingCompanion, setConnectingCompanion] = useState(false);
  const [connecting, setConnecting] = useState(false);

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
    setConnecting(false);
    leaveMatching();
    onCancel();
  };

  return (
    <div
      className="flex-1 flex flex-col justify-center items-center px-4 py-12 max-w-lg mx-auto text-center"
      id="matching-view"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full space-y-8 p-8 sm:p-10 rounded-3xl bg-[#FAF8F5] border border-[#E7E0D8] shadow-[0_10px_35px_-4px_rgba(45,39,35,0.06)]"
      >
        {/* STATE 1: SEARCHING / FINDING SOMEONE */}
        {matchingState.state === 'searching' && !matchingState.offerId && (
          <div className="space-y-6">
            <div className="relative flex items-center justify-center py-6">
              <span className="w-20 h-20 rounded-full bg-[#C86D51]/15 animate-ping absolute duration-1000" />
              <span className="w-14 h-14 rounded-full bg-[#FAF0EB] border border-[#E8C7BC] flex items-center justify-center text-[#C86D51] relative shadow-xs">
                <Radio className="w-6 h-6 animate-pulse" />
              </span>
            </div>

            <div className="space-y-2.5">
              <h2
                id="matching-searching-text"
                className="font-serif text-2xl sm:text-3xl font-normal text-[#2D2723] tracking-tight"
              >
                Finding someone who&apos;s available...
              </h2>
              <p className="text-xs sm:text-sm text-[#78716C] max-w-xs mx-auto leading-relaxed">
                Looking for another adult anywhere in the world who is ready for a genuine, unhurried conversation.
              </p>
              {topics && topics.length > 0 && (
                <div className="flex items-center justify-center gap-1.5 flex-wrap pt-2">
                  <span className="text-xs text-[#8C827A]">Topics:</span>
                  {topics.map((t) => (
                    <span
                      key={t}
                      className="px-2.5 py-0.5 bg-[#FAF0EB] text-[#C86D51] text-xs font-medium rounded-full border border-[#E8C7BC]"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 flex flex-col items-center gap-3">
              <button
                id="matching-leave-btn"
                onClick={handleLeave}
                className="px-7 py-2.5 text-xs sm:text-sm text-[#5C534D] hover:text-[#2D2723] hover:bg-[#F5F2EB] border border-[#E7E0D8] rounded-full transition-all cursor-pointer shadow-2xs"
              >
                Leave matching pool
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
