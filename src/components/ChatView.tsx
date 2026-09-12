import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Send, LogOut, ShieldAlert, Ban, AlertCircle, Bot, Sparkles, AlertTriangle, Loader2 } from 'lucide-react';
import { ReportModal } from './ReportModal.js';

export const ChatView: React.FC = () => {
  const {
    user,
    activeSession,
    messages,
    sendMessage,
    disconnectChat,
    blockUser,
    systemNotification,
    clearNotification,
    simulateCompanionAction,
  } = useAuth();

  const [input, setInput] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const [simulatingAction, setSimulatingAction] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages]);

  // Mobile viewport layout handling for keyboard open/close states
  useEffect(() => {
    const handleViewportResize = () => {
      // When mobile keyboard opens or closes, window.visualViewport height changes
      scrollToBottom('auto');
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', handleViewportResize);
      vv.addEventListener('scroll', handleViewportResize);
      return () => {
        vv.removeEventListener('resize', handleViewportResize);
        vv.removeEventListener('scroll', handleViewportResize);
      };
    }
  }, []);

  if (!activeSession) return null;

  const isCompanion =
    activeSession.partnerId === 'usr_simulated_companion' ||
    activeSession.partnerDisplayName === 'Simulated Stranger' ||
    Boolean(activeSession.isSimulator);
  const isDevOrAdmin = Boolean(import.meta.env.DEV || user?.role === 'admin' || user?.isAdmin);
  const showSimulatorTools = isDevOrAdmin && isCompanion;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
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
      className="flex-1 flex flex-col w-full max-w-2xl mx-auto h-[calc(100dvh-4.25rem)] sm:h-[84vh] min-h-0 bg-[#FAF8F5] sm:border sm:border-[#E7E0D8] sm:rounded-3xl shadow-[0_10px_35px_-4px_rgba(45,39,35,0.06)] overflow-hidden"
      id="chat-view"
    >
      {/* Top Header */}
      <div className="px-4 py-3 border-b border-[#E7E0D8] bg-[#FAF8F5]/90 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h3 id="chat-partner-name" className="font-serif text-sm font-medium text-[#2D2723] tracking-tight">
              {activeSession.partnerDisplayName}
            </h3>
            <span className="text-[11px] text-[#8C827A] block">Connected</span>
          </div>
        </div>

        {/* Safety & Disconnect controls */}
        <div className="flex items-center gap-1.5">
          <button
            id="chat-report-btn"
            onClick={() => setShowReport(true)}
            className="p-2 text-[#8C827A] hover:text-[#2D2723] hover:bg-[#F2ECE4] rounded-full transition-colors cursor-pointer"
            title="Report behaviour"
          >
            <ShieldAlert className="w-4 h-4" />
          </button>
          <button
            id="chat-block-btn"
            onClick={() => setConfirmBlock(true)}
            className="p-2 text-[#8C827A] hover:text-[#A84332] hover:bg-[#FAF0EE] rounded-full transition-colors cursor-pointer"
            title="Block this person"
          >
            <Ban className="w-4 h-4" />
          </button>
          <button
            id="chat-disconnect-btn"
            onClick={disconnectChat}
            className="flex items-center gap-1.5 ml-1 px-3.5 py-1.5 bg-[#F5F2EB] hover:bg-[#EDE6DC] text-[#5C534D] hover:text-[#2D2723] text-xs font-medium rounded-full border border-[#E7E0D8] transition-all cursor-pointer shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Disconnect</span>
          </button>
        </div>
      </div>

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

      {/* System Warning Banner if safety filter triggered */}
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
            <span className="font-semibold text-[#572714]">Please remember:</span> Someone is for genuine conversation, not sex chatting. Sexual solicitation or harassment can end the conversation and result in account suspension.
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
        className="flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4"
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
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
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
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        className="p-3 sm:p-3.5 border-t border-[#E7E0D8] bg-[#FAF8F5]/95 backdrop-blur-xs flex items-center gap-2"
        id="chat-input-form"
      >
        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => {
            setTimeout(() => scrollToBottom('smooth'), 250);
          }}
          placeholder="Write a message..."
          className="flex-1 px-4 py-2.5 bg-[#F5F2EB] border border-[#E7E0D8] rounded-full text-base sm:text-sm text-[#2D2723] placeholder:text-[#8C827A] focus:outline-none focus:ring-2 focus:ring-[#C86D51]/30 focus:border-[#C86D51]"
          autoFocus
        />
        <button
          id="chat-send-btn"
          type="submit"
          disabled={!input.trim()}
          className="p-2.5 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] rounded-full disabled:opacity-40 transition-all cursor-pointer shadow-2xs"
          title="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Report Modal */}
      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        targetUserId={activeSession.partnerId}
        targetDisplayName={activeSession.partnerDisplayName}
        roomId={activeSession.roomId}
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
    </div>
  );
};
