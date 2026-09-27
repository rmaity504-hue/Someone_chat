import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  Send,
  LogOut,
  ShieldAlert,
  Ban,
  AlertCircle,
  Bot,
  Sparkles,
  AlertTriangle,
  Loader2,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  SkipForward,
  Wind,
  ArrowLeft,
} from 'lucide-react';
import { ReportModal } from './ReportModal.js';
import { IcebreakerModal } from './IcebreakerModal.js';
import { CrisisSupportModal } from './CrisisSupportModal.js';
import { ConnectionStatusBar } from './ConnectionStatusBar.js';
import { SessionClosureCard } from './SessionClosureCard.js';
import { useChatSession } from '../hooks/useChatSession.js';
import { socketService } from '../services/socket.js';
import { useSoundMute, playDisconnectSound, triggerGentleHaptic } from '../utils/feedback.js';
import { filterChatMessage, detectContactOrLinks, sanitizeChatMessage, MAX_MESSAGE_LENGTH } from '../utils/privacyFilter.js';
import { detectCrisisIntent, checkCrisisKeywords } from '../utils/safetyInterceptor.js';

const GENTLE_PUSH_PROMPTS = [
  "What's a thought you haven't said out loud today?",
  "What kept you awake tonight?",
  "If tonight had a soundtrack, what would it be?",
  "What is something small that made you smile recently?",
];

export const ChatView: React.FC = () => {
  const {
    user,
    activeSession,
    messages,
    isPartnerTyping,
    sendMessage,
    disconnectChat,
    returnToQuietCorner,
    lookForSomeoneNew,
    quickEmergencyExit,
    skipToNext,
    sendTyping,
    blockUser,
    systemNotification,
    clearNotification,
    simulateCompanionAction,
    partnerReconnecting,
    connectionStatus,
    reconnectAttempts,
    maxReconnectAttempts,
    retryConnection,
  } = useAuth();

  const { isMuted, toggleMute } = useSoundMute();

  const {
    inputText: input,
    setInputText: setInput,
    purgeSessionMemory,
    leaveChat,
  } = useChatSession();

  const [showReport, setShowReport] = useState(false);
  const [showIcebreakers, setShowIcebreakers] = useState(false);
  const [showCrisisModal, setShowCrisisModal] = useState(false);
  const [pendingCrisisMessage, setPendingCrisisMessage] = useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [confirmBackExit, setConfirmBackExit] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [voluntaryEnded, setVoluntaryEnded] = useState(false);
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const [simulatingAction, setSimulatingAction] = useState<string | null>(null);

  const isSessionEnded = Boolean(activeSession?.hasEnded || voluntaryEnded);

  // Gentle Pushes & Privacy Shield states
  const [gentlePushIndex, setGentlePushIndex] = useState<number>(0);
  const [showGentlePush, setShowGentlePush] = useState<boolean>(false);
  const [privacyToast, setPrivacyToast] = useState<string | null>(null);
  const privacyToastTimerRef = useRef<any>(null);
  const lastMessageTimestampRef = useRef<number>(Date.now());

  // Client-side rate limiting (800ms minimum, >5 messages in 3s triggers 5s cooldown)
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
  const [rateLimitNotice, setRateLimitNotice] = useState<string | null>(null);
  const lastSendTimeRef = useRef<number>(0);
  const sendTimestampsRef = useRef<number[]>([]);
  const rateLimitTimerRef = useRef<any>(null);

  // PII & Contact exchanging filter states
  const [showPiiAlert, setShowPiiAlert] = useState<boolean>(false);
  const [pendingPiiMessage, setPendingPiiMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isLocalTypingRef = useRef<boolean>(false);
  const typingDebounceTimerRef = useRef<any>(null);
  const typingInactivityTimerRef = useRef<any>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  };

  // Auto-scroll smoothly to the latest message whenever a new message arrives or partner types
  useEffect(() => {
    scrollToBottom('smooth');
    const timer = setTimeout(() => {
      scrollToBottom('smooth');
    }, 50);
    return () => clearTimeout(timer);
  }, [messages.length, isPartnerTyping]);

  // Track conversation flow: update timestamp on messages and advance prompts
  useEffect(() => {
    if (messages.length > 0) {
      lastMessageTimestampRef.current = Date.now();
      setShowGentlePush(false);
      setGentlePushIndex((prev) => (prev + 1) % GENTLE_PUSH_PROMPTS.length);
    }
  }, [messages.length]);

  // Gentle Pushes timer: 45 seconds of mutual silence after at least 1 message
  useEffect(() => {
    const interval = setInterval(() => {
      if (messages.length > 0) {
        const elapsed = Date.now() - lastMessageTimestampRef.current;
        if (elapsed >= 45000 && !input.trim() && !isPartnerTyping) {
          setShowGentlePush(true);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [messages.length, input, isPartnerTyping]);

  // Quietly fade out suggestion pill as soon as either person starts typing
  useEffect(() => {
    if (input.trim() || isPartnerTyping) {
      setShowGentlePush(false);
    }
  }, [input, isPartnerTyping]);

  // Mobile Visual Viewport API: lock viewport height using 100dvh so input bar stays visible directly above keyboard
  useEffect(() => {
    const updateViewport = () => {
      if (window.visualViewport) {
        const vh = window.visualViewport.height;
        document.documentElement.style.setProperty('--viewport-height', `${vh}px`);
      } else {
        document.documentElement.style.setProperty('--viewport-height', '100dvh');
      }
      // Auto-scroll smoothly to latest message whenever keyboard opens or viewport shifts
      scrollToBottom('smooth');
    };

    updateViewport();

    if (window.visualViewport) {
      const vv = window.visualViewport;
      vv.addEventListener('resize', updateViewport);
      vv.addEventListener('scroll', updateViewport);
      window.addEventListener('resize', updateViewport);
      return () => {
        vv.removeEventListener('resize', updateViewport);
        vv.removeEventListener('scroll', updateViewport);
        window.removeEventListener('resize', updateViewport);
      };
    } else {
      window.addEventListener('resize', updateViewport);
      return () => window.removeEventListener('resize', updateViewport);
    }
  }, []);

  // Android Hardware Back-Button & Swipe Gesture Interceptor
  // Pushes a dedicated history entry while in active chat so popstate intercepts accidental departures
  useEffect(() => {
    if (!activeSession) return;

    // Push a sentinel state so Android hardware back or swipe triggers a popstate event first
    window.history.pushState({ inChatSession: true, roomId: activeSession.roomId }, '');

    const handlePopState = (event: PopStateEvent) => {
      // Re-push sentinel state immediately to trap and prevent uncontrolled browser back exit
      window.history.pushState({ inChatSession: true, roomId: activeSession.roomId }, '');
      setConfirmBackExit(true);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeSession?.roomId]);

  const stopTyping = () => {
    if (typingDebounceTimerRef.current) {
      clearTimeout(typingDebounceTimerRef.current);
      typingDebounceTimerRef.current = null;
    }
    if (typingInactivityTimerRef.current) {
      clearTimeout(typingInactivityTimerRef.current);
      typingInactivityTimerRef.current = null;
    }
    if (isLocalTypingRef.current) {
      isLocalTypingRef.current = false;
      sendTyping(false);
    }
  };

  // Cleanup typing and rate limit timers on unmount
  useEffect(() => {
    return () => {
      stopTyping();
      if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
      if (privacyToastTimerRef.current) clearTimeout(privacyToastTimerRef.current);
    };
  }, []);

  if (!activeSession) return null;

  const isCompanion =
    activeSession.partnerId === 'usr_simulated_companion' ||
    activeSession.partnerDisplayName === 'Simulated Stranger' ||
    Boolean(activeSession.isSimulator);
  const isDevOrAdmin = Boolean(import.meta.env.DEV || user?.role === 'admin' || user?.isAdmin);
  const showSimulatorTools = isDevOrAdmin && isCompanion;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    // If PII alert is showing, check if contact/links were removed
    if (showPiiAlert) {
      const check = detectContactOrLinks(val);
      if (!check.hasContactOrLink) {
        setShowPiiAlert(false);
        setPendingPiiMessage(null);
      } else {
        setPendingPiiMessage(val);
      }
    }

    if (val.trim()) {
      // Clear pending inactivity timer while actively typing
      if (typingInactivityTimerRef.current) {
        clearTimeout(typingInactivityTimerRef.current);
      }

      // Debounce TYPING_START by 300ms if not already broadcasting
      if (!isLocalTypingRef.current) {
        if (typingDebounceTimerRef.current) clearTimeout(typingDebounceTimerRef.current);
        typingDebounceTimerRef.current = setTimeout(() => {
          isLocalTypingRef.current = true;
          sendTyping(true);
        }, 300);
      }

      // Automatically emit TYPING_STOP after 2.5 seconds of inactivity
      typingInactivityTimerRef.current = setTimeout(() => {
        stopTyping();
      }, 2500);
    } else {
      stopTyping();
    }
  };

  const handleUseGentlePrompt = (promptText: string) => {
    setInput(promptText);
    setShowGentlePush(false);
    const inputEl = document.getElementById('chat-input') as HTMLInputElement | null;
    inputEl?.focus();
  };

  // Client-Side Rate Limiter:
  // - Disallows sending > 1 message per second (1000ms)
  // - If user sends > 5 messages within 3 seconds, disables send button for 5s with calm notice
  const checkRateLimit = (): boolean => {
    if (isRateLimited) return false;

    const now = Date.now();
    // Prune timestamps older than 3 seconds
    sendTimestampsRef.current = sendTimestampsRef.current.filter((t) => now - t < 3000);

    // 1. Spacing threshold: at least 1000ms between sends
    if (now - lastSendTimeRef.current < 1000) {
      sendTimestampsRef.current.push(now);

      if (sendTimestampsRef.current.length > 5) {
        setIsRateLimited(true);
        setRateLimitNotice('Please slow down. Maximum 1 message per second.');
        if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
        rateLimitTimerRef.current = setTimeout(() => {
          setIsRateLimited(false);
          setRateLimitNotice(null);
        }, 5000);
      } else {
        setRateLimitNotice('Please slow down. Maximum 1 message per second.');
        if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
        rateLimitTimerRef.current = setTimeout(() => {
          setRateLimitNotice(null);
        }, 1200);
      }
      return false;
    }

    // 2. Burst threshold: max 5 messages in 3 seconds
    if (sendTimestampsRef.current.length >= 5) {
      setIsRateLimited(true);
      setRateLimitNotice('Please slow down. Maximum 1 message per second.');
      if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
      rateLimitTimerRef.current = setTimeout(() => {
        setIsRateLimited(false);
        setRateLimitNotice(null);
      }, 5000);
      return false;
    }

    return true;
  };

  const recordSuccessfulSend = () => {
    const now = Date.now();
    lastSendTimeRef.current = now;
    sendTimestampsRef.current = sendTimestampsRef.current.filter((t) => now - t < 3000);
    sendTimestampsRef.current.push(now);

    if (sendTimestampsRef.current.length > 5) {
      setIsRateLimited(true);
      setRateLimitNotice('Take a breath. Please slow down.');
      if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
      rateLimitTimerRef.current = setTimeout(() => {
        setIsRateLimited(false);
        setRateLimitNotice(null);
      }, 5000);
    }
  };

  const dispatchFinalMessage = (textToSend: string) => {
    // Discreet, empathetic client-side crisis intent interceptor (zero-logging in local memory)
    if (detectCrisisIntent(textToSend)) {
      setPendingCrisisMessage(textToSend);
      setShowCrisisModal(true);
      return;
    }

    recordSuccessfulSend();
    stopTyping();
    sendMessage(textToSend);
    setInput('');
    setShowPiiAlert(false);
    setPendingPiiMessage(null);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    navigator.vibrate?.(10);
    if (!input.trim() || isSessionEnded || isRateLimited) return;

    if (!checkRateLimit()) return;

    const sanitized = sanitizeChatMessage(input);
    if (!sanitized) return;

    // PII & Contact Exchanging Filter (Optional Safety Layer):
    // Detect phone numbers, raw links (http/https/t.me), and social handles (@username)
    const contactCheck = detectContactOrLinks(sanitized);
    if (contactCheck.hasContactOrLink) {
      setShowPiiAlert(true);
      setPendingPiiMessage(sanitized);
      return;
    }

    dispatchFinalMessage(sanitized);
  };

  const handleConfirmSendAnyway = () => {
    navigator.vibrate?.(10);
    if (!pendingPiiMessage || isSessionEnded || isRateLimited) return;
    if (!checkRateLimit()) return;

    const textToSend = pendingPiiMessage;
    setShowPiiAlert(false);
    setPendingPiiMessage(null);
    dispatchFinalMessage(textToSend);
  };

  const handleEditPiiMessage = () => {
    setShowPiiAlert(false);
    setPendingPiiMessage(null);
    const inputEl = document.getElementById('chat-input') as HTMLInputElement | null;
    inputEl?.focus();
  };

  const handleContinueAfterCrisis = () => {
    setShowCrisisModal(false);
    const messageToSend = pendingCrisisMessage || input.trim();
    if (messageToSend) {
      recordSuccessfulSend();
      stopTyping();
      sendMessage(messageToSend);
      setPendingCrisisMessage(null);
      setInput('');
      setShowPiiAlert(false);
      setPendingPiiMessage(null);
    }
  };

  const handleClearAndCloseCrisisModal = () => {
    setShowCrisisModal(false);
    setPendingCrisisMessage(null);
    setInput('');
  };

  const handleDismissCrisisModal = () => {
    setShowCrisisModal(false);
    // Keep typed text intact in input
    setPendingCrisisMessage(null);
  };

  const handleSimulateAction = async (action: 'violation' | 'clean_chat') => {
    setSimulatingAction(action);
    try {
      await simulateCompanionAction(action);
    } finally {
      setSimulatingAction(null);
    }
  };

  const handleBlock = async () => {
    await blockUser(activeSession.partnerId);
    setConfirmBlock(false);
  };

  return (
    <div
      ref={chatContainerRef}
      style={{ height: 'var(--viewport-height, 100dvh)' }}
      className="flex flex-col w-full max-w-2xl mx-auto h-[var(--viewport-height,100dvh)] max-h-[var(--viewport-height,100dvh)] sm:h-[84vh] sm:max-h-[850px] bg-[#F6F3EE]/95 sm:backdrop-blur-sm sm:border sm:border-[#E7E0D8] sm:rounded-3xl shadow-[0_10px_35px_-4px_rgba(45,39,35,0.06)] overflow-hidden transition-[height] duration-75 ease-out"
      id="chat-view"
    >
      {/* Top Header */}
      <div className="px-4 py-3 border-b border-[#E7E0D8] bg-[#F6F3EE]/90 backdrop-blur-md flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              partnerReconnecting
                ? 'bg-amber-500 animate-ping'
                : connectionStatus === 'reconnecting'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-emerald-500 animate-pulse'
            }`}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 id="chat-partner-name" className="font-serif text-sm font-medium text-[#2D2723] tracking-tight truncate">
                {activeSession.partnerDisplayName}
              </h3>
              <span
                className={`text-[11px] hidden xs:inline ${
                  partnerReconnecting ? 'text-amber-600 font-medium' : 'text-[#8C827A]'
                }`}
              >
                {partnerReconnecting ? 'Reconnecting...' : 'Connected'}
              </span>
            </div>
            {/* Shared Topic Badges */}
            {activeSession.matchedTopics && activeSession.matchedTopics.length > 0 && (
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                {activeSession.matchedTopics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex items-center px-2 py-0.5 bg-[#FAF0EB] text-[#C86D51] text-[10px] font-medium rounded-full border border-[#E8C7BC]"
                  >
                    #{topic}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Controls: Sound Mute, Report, Block, Next, Disconnect */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Audio Chimes Mute Toggle */}
          <button
            id="chat-sound-toggle-btn"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute sounds' : 'Mute sounds'}
            className="p-2 text-[#8C827A] hover:text-[#2D2723] hover:bg-[#F2ECE4] rounded-full transition-colors cursor-pointer"
            title={isMuted ? 'Sound alerts muted (click to unmute)' : 'Sound alerts enabled (click to mute)'}
          >
            {isMuted ? <BellOff className="w-4 h-4 text-[#A84332]" /> : <Bell className="w-4 h-4 text-[#2F5938]" />}
          </button>

          {/* Report Button */}
          <button
            id="chat-report-btn"
            onClick={() => setShowReport(true)}
            className="p-2 text-[#8C827A] hover:text-[#2D2723] hover:bg-[#F2ECE4] rounded-full transition-colors cursor-pointer"
            title="Report behaviour"
          >
            <ShieldAlert className="w-4 h-4" />
          </button>

          {/* Block Button */}
          <button
            id="chat-block-btn"
            onClick={() => setConfirmBlock(true)}
            className="p-2 text-[#8C827A] hover:text-[#A84332] hover:bg-[#FAF0EE] rounded-full transition-colors cursor-pointer"
            title="Block this person"
          >
            <Ban className="w-4 h-4" />
          </button>

          {/* Quick Exit Button (Feather-light Instant Departure) */}
          <button
            id="chat-quick-exit-btn"
            onClick={quickEmergencyExit}
            className="p-2 text-[#8C827A] hover:text-[#C86D51] hover:bg-[#FAF0EE] rounded-full transition-colors cursor-pointer"
            title="Quick Exit — instant departure, no logs"
            aria-label="Quick Exit"
          >
            <Wind className="w-4 h-4" />
          </button>

          {/* Quick Next Match Button */}
          <button
            id="chat-next-btn"
            onClick={() => skipToNext(activeSession.matchedTopics)}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#EDE6DC] text-[#2D2723] text-xs font-medium rounded-full border border-[#E7E0D8] transition-all cursor-pointer shadow-2xs"
            title="Skip to next conversation partner"
          >
            <SkipForward className="w-3.5 h-3.5 text-[#C86D51]" />
            <span className="hidden sm:inline">Next</span>
          </button>

          {/* Leave Chat / End Conversation Button */}
          <button
            id="chat-disconnect-btn"
            onClick={() => setShowLeaveConfirm(true)}
            className="flex items-center gap-1.5 ml-0.5 px-3 py-1.5 bg-[#F5F2EB] hover:bg-[#EDE6DC] text-[#5C534D] hover:text-[#2D2723] text-xs font-medium rounded-full border border-[#E7E0D8] transition-all cursor-pointer shadow-2xs"
            title="Leave this conversation"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave Chat</span>
          </button>
        </div>
      </div>

      {/* Partner Reconnection Banner */}
      {partnerReconnecting && (
        <div
          role="status"
          className="px-4 py-2 bg-[#FAF3EB] border-b border-[#EADFCB] flex items-center justify-between text-xs text-[#825C26] animate-fade-in"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
            <span>{activeSession.partnerDisplayName} is reconnecting...</span>
          </div>
          <span className="text-[11px] text-[#A37B3E]">Holding conversation open</span>
        </div>
      )}

      {/* Reconnect / Connection Status Banner - Restricted to Active Chat View only */}
      <ConnectionStatusBar />

      {/* Test Companion Simulator Toolbar (Development / Admin / Companion sessions) */}
      {showSimulatorTools && (
        <div
          id="chat-simulator-toolbar"
          className="px-4 py-2 bg-[#F5F2EB] border-b border-[#E7E0D8] flex flex-wrap items-center justify-between gap-2 text-xs"
        >
          <div className="flex items-center gap-1.5 text-[#5C534D]">
            <Bot className="w-4 h-4 text-[#8C827A]" />
            <span className="font-medium text-[11px] text-[#2D2723]">Test Companion Simulator:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="simulate-clean-chat-btn"
              onClick={() => handleSimulateAction('clean_chat')}
              disabled={!!simulatingAction}
              className="px-3 py-1 bg-[#FAF8F5] hover:bg-[#EDE6DC] text-[#2D2723] border border-[#E7E0D8] rounded-full text-xs font-medium transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Companion sends warm goodbye dialogue and triggers mutual post-chat friendship flow"
            >
              {simulatingAction === 'clean_chat' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8C827A]" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-[#2F5938]" />
              )}
              <span>Simulate Clean Chat</span>
            </button>

            <button
              id="simulate-violation-btn"
              onClick={() => handleSimulateAction('violation')}
              disabled={!!simulatingAction}
              className="px-3 py-1 bg-[#FAF0EE] hover:bg-[#F5E2DE] text-[#A84332] border border-[#EAC2BB] rounded-full text-xs font-medium transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Companion triggers policy violation; moderation filter immediately blocks it and terminates session"
            >
              {simulatingAction === 'violation' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#A84332]" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-[#A84332]" />
              )}
              <span>Simulate Harassment / Violation</span>
            </button>
          </div>
        </div>
      )}

      {/* System Warning Banner if safety filter triggered or notification received */}
      {systemNotification && (
        <div className="p-3 bg-[#FAF0E6] border-b border-[#E7D7C5] text-[#7A3E26] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#C86D51] shrink-0" />
            <span>{systemNotification}</span>
          </div>
          <button
            onClick={clearNotification}
            className="text-xs text-[#7A3E26] underline font-medium ml-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Subtle, non-intrusive reminder about sexual behaviour */}
      {!reminderDismissed && (
        <div
          id="chat-safety-reminder"
          className="px-3.5 py-2 bg-[#FAF2E8] border-b border-[#EADECF] text-[11px] text-[#7A3E26] flex items-center justify-between gap-2"
        >
          <p className="leading-snug">
            <span className="font-semibold text-[#572714]">Please remember:</span> Someone is for genuine conversation, not sex chatting. Off-platform solicitation or harassment ends the chat immediately.
          </p>
          <button
            onClick={() => setReminderDismissed(true)}
            className="text-[10px] text-[#7A3E26]/70 hover:text-[#7A3E26] px-1.5 py-0.5 rounded-full transition-colors shrink-0 cursor-pointer"
            title="Dismiss reminder"
          >
            ✕
          </button>
        </div>
      )}

      {/* Message Stream */}
      <div
        className="flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto overscroll-contain scroll-container space-y-4"
        id="chat-message-list"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#8C827A] space-y-2">
            <p className="text-xs sm:text-sm font-medium text-[#5C534D]">
              You are connected with {activeSession.partnerDisplayName}.
            </p>
            <p className="text-xs text-[#8C827A] max-w-xs leading-relaxed">
              Take your time. A simple greeting is always a fine place to begin.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col chat-bubble-enter ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-2xs ${
                    isMe
                      ? 'bg-[#C86D51] text-[#FAF8F5] rounded-br-xs'
                      : 'bg-[#F0EBE1] text-[#2D2723] border border-[#E7E0D8]/80 rounded-bl-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                </div>
                <span className="text-[10px] text-[#8C827A] mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}

        {/* Floating Organic Partner Typing Bubble */}
        {isPartnerTyping && (
          <div className="flex items-center gap-2 text-xs text-[#8C827A] px-1 py-1 chat-bubble-enter">
            <div className="flex items-center gap-2 bg-[#F0EBE1] text-[#78716C] px-3.5 py-2 rounded-2xl rounded-bl-xs border border-[#E7E0D8]/90 shadow-2xs">
              <span className="text-[11px] text-[#5C534D] font-medium tracking-tight">
                {activeSession.partnerDisplayName} is typing
              </span>
              <div className="flex items-center gap-1.5 ml-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C86D51] typing-dot-1 inline-block" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#C86D51] typing-dot-2 inline-block" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#C86D51] typing-dot-3 inline-block" />
              </div>
            </div>
          </div>
        )}

        {/* Subtle Centered Gentle Push Suggestion Pill (Conversation Flow Aid) */}
        {showGentlePush && !isPartnerTyping && !input.trim() && (
          <div className="flex justify-center my-3 px-2 chat-bubble-enter">
            <button
              type="button"
              id="gentle-push-prompt-btn"
              onClick={() => handleUseGentlePrompt(GENTLE_PUSH_PROMPTS[gentlePushIndex])}
              className="group flex items-center gap-2.5 px-4 py-2 bg-[#FAF8F5]/95 hover:bg-[#F2ECE4] border border-[#E7E0D8] hover:border-[#C86D51]/50 rounded-full text-xs text-[#5C534D] hover:text-[#2D2723] shadow-xs hover:shadow transition-all duration-300 cursor-pointer max-w-[95%] sm:max-w-md text-left"
              title="Tap to place this in your message"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C86D51] shrink-0 group-hover:rotate-12 transition-transform" />
              <span className="font-serif italic text-xs leading-relaxed truncate">
                "{GENTLE_PUSH_PROMPTS[gentlePushIndex]}"
              </span>
              <span className="text-[10px] text-[#8C827A] font-sans ml-auto shrink-0 bg-[#EFE9DF] group-hover:bg-[#E7DFD3] text-[#5C534D] px-2 py-0.5 rounded-full font-medium transition-colors">
                tap to ask
              </span>
            </button>
          </div>
        )}

        <div ref={messagesEndRef} id="chat-messages-bottom-sentinel" />
      </div>

      {/* Automatic Data Filter Toast (Privacy Shield) */}
      {privacyToast && (
        <div
          id="privacy-shield-toast"
          role="alert"
          className="px-4 py-2 bg-[#FAF0EB] border-t border-[#E8C7BC] flex items-center justify-between gap-3 text-xs text-[#A84332] animate-in fade-in slide-in-from-bottom-1 duration-200"
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#C86D51] shrink-0" />
            <span className="font-medium">{privacyToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setPrivacyToast(null)}
            className="text-[#8C827A] hover:text-[#2D2723] text-xs px-1 cursor-pointer font-medium"
            aria-label="Dismiss privacy warning"
          >
            ✕
          </button>
        </div>
      )}

      {/* Partner Reconnecting Status above Input */}
      {partnerReconnecting && (
        <div className="px-4 py-1.5 bg-[#FAF3EB]/90 border-t border-[#EADFCB] flex items-center justify-center gap-2 text-xs text-[#825C26]">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
          <span>Partner is reconnecting... holding room open</span>
        </div>
      )}

      {/* Client-Side Rate Limit Notice */}
      {rateLimitNotice && (
        <div
          id="chat-rate-limit-notice"
          className="mx-3 my-1.5 px-3.5 py-2 bg-[#FAF0EB] border border-[#E8C7BC] text-[#C86D51] text-xs rounded-xl flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200 shadow-2xs"
          role="status"
          aria-live="polite"
        >
          <Wind className="w-3.5 h-3.5 shrink-0 animate-pulse" />
          <span className="font-medium">{rateLimitNotice}</span>
        </div>
      )}

      {/* Discreet Inline Anti-Off-Platform & Contact Exchanging Alert */}
      {showPiiAlert && (
        <div
          id="chat-pii-alert"
          role="alert"
          className="mx-3 my-1.5 p-3 sm:p-3.5 bg-[#FAF3EB] border border-[#EADFCB] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#5C534D] shadow-xs animate-in fade-in slide-in-from-bottom-1 duration-200"
        >
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="p-1.5 bg-[#FAF0EB] text-[#C86D51] rounded-lg shrink-0 mt-0.5 sm:mt-0">
              <ShieldAlert className="w-4 h-4 text-[#C86D51]" />
            </div>
            <p className="leading-snug text-[#5C534D]">
              Sharing links, handles, or phone numbers is not permitted in this space.
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              id="pii-edit-msg-btn"
              onClick={handleEditPiiMessage}
              className="px-3.5 py-1.5 text-xs font-medium text-[#5C534D] hover:text-[#2D2723] bg-[#F2ECE4] hover:bg-[#E7DFD3] rounded-full border border-[#E0D7CC] transition-colors cursor-pointer"
            >
              Edit message
            </button>
          </div>
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        className="p-3 sm:p-3.5 border-t border-[#E7E0D8] bg-[#F6F3EE]/95 backdrop-blur-xs flex items-center gap-2 relative shrink-0"
        id="chat-input-form"
      >
        <button
          id="chat-icebreaker-btn"
          type="button"
          disabled={isSessionEnded}
          onClick={() => setShowIcebreakers((prev) => !prev)}
          className={`p-2.5 rounded-full border transition-all cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed ${
            showIcebreakers
              ? 'bg-[#E8C7BC] text-[#C86D51] border-[#C86D51]'
              : 'bg-[#F5F2EB] text-[#8C827A] hover:text-[#C86D51] border-[#E7E0D8] hover:bg-[#FAF8F5]'
          }`}
          title={isSessionEnded ? "Conversation ended" : "Spark a thought (Icebreakers)"}
          aria-label="Spark a thought"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        <div className="relative flex-1 flex items-center">
          <input
            id="chat-input"
            type="text"
            maxLength={MAX_MESSAGE_LENGTH}
            value={input}
            disabled={isSessionEnded}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (input.trim() && !isSessionEnded && !isRateLimited) {
                  handleSend(e);
                }
              }
            }}
            onFocus={() => {
              setTimeout(() => scrollToBottom('smooth'), 250);
            }}
            placeholder={isSessionEnded ? "The other person has stepped away." : "Write a message..."}
            className="w-full px-4 py-2.5 bg-[#F5F2EB] border border-[#E7E0D8] rounded-full text-base sm:text-sm text-[#2D2723] placeholder:text-[#8C827A] focus:outline-none focus:ring-2 focus:ring-[#C86D51]/30 focus:border-[#C86D51] disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-[#ECE6DE]"
            autoFocus={!isSessionEnded}
          />
          {input.length > 180 && !isSessionEnded && (
            <span
              id="chat-char-counter"
              className={`absolute right-3 text-[11px] font-mono px-1.5 py-0.5 rounded-md ${
                input.length >= MAX_MESSAGE_LENGTH
                  ? 'text-[#C86D51] font-semibold bg-[#FAF0EB]'
                  : 'text-[#8C827A] bg-[#F5F2EB]'
              }`}
            >
              {input.length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>
        <button
          id="chat-send-btn"
          type="submit"
          onClick={() => navigator.vibrate?.(10)}
          disabled={!input.trim() || isSessionEnded || isRateLimited}
          className="p-2.5 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] rounded-full disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
          title={isRateLimited ? "Take a breath. Please slow down." : "Send"}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Icebreaker / Thought Generator Modal */}
      <IcebreakerModal
        isOpen={showIcebreakers}
        onClose={() => setShowIcebreakers(false)}
        onSelectPrompt={(prompt) => {
          setInput(prompt);
          setShowIcebreakers(false);
          setTimeout(() => {
            const el = document.getElementById('chat-input') as HTMLInputElement | null;
            el?.focus();
          }, 50);
        }}
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        targetUserId={activeSession.partnerId}
        targetDisplayName={activeSession.partnerDisplayName}
        roomId={activeSession.roomId}
      />

      {/* Discreet Client-Side Crisis Support Modal */}
      <CrisisSupportModal
        isOpen={showCrisisModal}
        onClose={handleDismissCrisisModal}
        onContinueChat={handleContinueAfterCrisis}
        onClearAndClose={handleClearAndCloseCrisisModal}
      />

      {/* Block Confirmation Dialog */}
      {confirmBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2723]/40 backdrop-blur-xs">
          <div className="bg-[#FAF8F5] border border-[#E7E0D8] rounded-3xl max-w-sm w-full p-6 space-y-4 text-[#2D2723] shadow-xl">
            <h3 className="font-serif text-lg font-medium text-[#2D2723]">
              Block {activeSession.partnerDisplayName}?
            </h3>
            <p className="text-xs text-[#5C534D] leading-relaxed">
              Blocking immediately ends the conversation and prevents either of you from ever being matched together again on Someone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                id="block-cancel-btn"
                onClick={() => setConfirmBlock(false)}
                className="px-4 py-2 text-xs text-[#5C534D] hover:text-[#2D2723] rounded-full cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="block-confirm-btn"
                onClick={handleBlock}
                className="px-4 py-2 bg-[#A84332] text-white text-xs font-medium rounded-full hover:bg-[#933829] transition-colors cursor-pointer shadow-2xs"
              >
                Block and leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voluntary User Exit Confirmation Dialog */}
      {showLeaveConfirm && (
        <div
          id="leave-confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-modal-heading"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2723]/40 backdrop-blur-xs spring-overlay-enter"
        >
          <div className="bg-[#FAF8F5] border border-[#E7E0D8] rounded-3xl max-w-sm w-full p-6 space-y-4 text-[#2D2723] shadow-xl spring-modal-enter">
            <div className="flex items-center gap-2.5 text-[#C86D51]">
              <div className="p-2 bg-[#FAF0EB] rounded-xl">
                <LogOut className="w-4 h-4 text-[#C86D51]" />
              </div>
              <h3 id="leave-modal-heading" className="font-serif text-lg font-medium text-[#2D2723]">
                Step away from this conversation?
              </h3>
            </div>
            <p className="text-xs text-[#5C534D] leading-relaxed">
              Leaving will close this private session. No messages are stored or archived.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                id="leave-modal-stay-btn"
                onClick={() => setShowLeaveConfirm(false)}
                className="px-4 py-2 text-xs text-[#5C534D] hover:text-[#2D2723] rounded-full transition-colors cursor-pointer"
              >
                Stay in Chat
              </button>
              <button
                type="button"
                id="leave-modal-confirm-btn"
                onClick={() => {
                  setShowLeaveConfirm(false);
                  triggerGentleHaptic(15);
                  playDisconnectSound();
                  setVoluntaryEnded(true);
                  if (activeSession) {
                    socketService.send('leave_chat', { roomId: activeSession.roomId });
                    socketService.send('chat:disconnect', { roomId: activeSession.roomId });
                  }
                  purgeSessionMemory();
                }}
                className="px-4 py-2 bg-[#C86D51] text-[#FAF8F5] text-xs font-medium rounded-full hover:bg-[#B65E43] transition-colors cursor-pointer shadow-2xs"
              >
                End Conversation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Android Hardware Back-Button / Swipe Gesture Confirmation Dialog */}
      {confirmBackExit && (
        <div
          id="back-exit-modal"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2723]/40 backdrop-blur-xs spring-overlay-enter"
        >
          <div className="bg-[#FAF8F5] border border-[#E7E0D8] rounded-3xl max-w-sm w-full p-6 space-y-4 text-[#2D2723] shadow-xl spring-modal-enter">
            <div className="flex items-center gap-2.5 text-[#C86D51]">
              <div className="p-2 bg-[#FAF0EB] rounded-xl">
                <ArrowLeft className="w-4 h-4 text-[#C86D51]" />
              </div>
              <h3 className="font-serif text-lg font-medium text-[#2D2723]">
                Step away from this conversation?
              </h3>
            </div>
            <p className="text-xs text-[#5C534D] leading-relaxed">
              Leaving will close this private session. No messages are stored or archived.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                id="back-exit-stay-btn"
                onClick={() => setConfirmBackExit(false)}
                className="px-4 py-2 text-xs text-[#5C534D] hover:text-[#2D2723] rounded-full transition-colors cursor-pointer"
              >
                Stay in Chat
              </button>
              <button
                type="button"
                id="back-exit-confirm-btn"
                onClick={() => {
                  setConfirmBackExit(false);
                  triggerGentleHaptic(15);
                  playDisconnectSound();
                  setVoluntaryEnded(true);
                  if (activeSession) {
                    socketService.send('leave_chat', { roomId: activeSession.roomId });
                    socketService.send('chat:disconnect', { roomId: activeSession.roomId });
                  }
                  purgeSessionMemory();
                }}
                className="px-4 py-2 bg-[#C86D51] text-[#FAF8F5] text-xs font-medium rounded-full hover:bg-[#B65E43] transition-colors cursor-pointer shadow-2xs"
              >
                End Conversation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ephemeral Session Closure Ritual Modal over the Chat Stream */}
      <SessionClosureCard
        isOpen={isSessionEnded}
        onFindAnother={() => {
          triggerGentleHaptic(15);
          purgeSessionMemory();
          lookForSomeoneNew(activeSession?.matchedTopics);
        }}
        onReturnHome={() => {
          triggerGentleHaptic(15);
          purgeSessionMemory();
          returnToQuietCorner();
        }}
      />
    </div>
  );
};
