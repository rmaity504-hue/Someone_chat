import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, ActiveSession } from '../context/AuthContext.js';
import { socketService } from '../services/socket.js';
import { scrubSessionMemory } from '../utils/memoryPurge.js';
import { ChatMessage } from '../types.js';

export interface UseChatSessionReturn {
  activeSession: ActiveSession | null;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  inputText: string;
  setInputText: (text: string | ((prev: string) => string)) => void;
  purgeSessionMemory: () => void;
  leaveChat: () => void;
}

/**
 * Custom hook implementing the Strict Client-Side Memory & State Purge Engine:
 * 1. Resets messages state array to empty: setMessages([])
 * 2. Overwrites input text state with an empty string: setInputText('')
 * 3. Clears temporary session identifiers, peer IDs, room IDs, or typing tokens in sessionStorage & memory
 * 4. Calls window.gc?.() if available, or allows unreferenced objects to garbage-collect cleanly
 * 5. Foreground/Background Security Shield: Blurs the conversation container on visibility change to prevent
 *    screenshot previews in the mobile/Android app-switcher
 */
export function useChatSession(): UseChatSessionReturn {
  const {
    activeSession,
    messages,
    setMessages,
    disconnectChat,
  } = useAuth();

  const [inputText, setInputTextState] = useState<string>('');
  const inputTextRef = useRef<string>('');
  const activeSessionRef = useRef<ActiveSession | null>(activeSession);

  useEffect(() => {
    inputTextRef.current = inputText;
  }, [inputText]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  const setInputText = useCallback((valueOrFn: string | ((prev: string) => string)) => {
    setInputTextState((prev) => {
      const next = typeof valueOrFn === 'function' ? valueOrFn(prev) : valueOrFn;
      inputTextRef.current = next;
      return next;
    });
  }, []);

  /**
   * Complete memory scrubbing routine:
   * - Resets messages array: setMessages([])
   * - Overwrites input text state with empty string
   * - Clears sessionStorage & memory session identifiers
   * - Invokes window.gc?.()
   */
  const purgeSessionMemory = useCallback(() => {
    // 1. Overwrite input text state with empty string
    setInputTextState('');
    inputTextRef.current = '';

    // 2. Reset messages state array to an empty array
    setMessages([]);

    // 3. Clear session identifiers, peer IDs, room IDs, or typing tokens in sessionStorage or local memory
    scrubSessionMemory();

    // 4. Call window.gc?.() if available in the runtime
    if (typeof window !== 'undefined') {
      try {
        window.gc?.();
      } catch {
        // Fallback for runtimes without exposed gc()
      }
    }
  }, [setMessages]);

  /**
   * Leave chat action:
   * Sends leave_chat and chat:disconnect socket events and triggers the purge routine.
   */
  const leaveChat = useCallback(() => {
    const currentSession = activeSessionRef.current;
    if (currentSession?.roomId) {
      socketService.send('leave_chat', { roomId: currentSession.roomId });
      socketService.send('chat:disconnect', { roomId: currentSession.roomId });
    }
    purgeSessionMemory();
    disconnectChat();
  }, [purgeSessionMemory, disconnectChat]);

  // Handle session termination events: 'leave_chat', 'partner_left', 'partner_disconnected'
  useEffect(() => {
    const handleTerminationEvent = () => {
      console.log('[useChatSession] Session termination event received. Scrubbing state & memory.');
      purgeSessionMemory();
    };

    const unsubPartnerLeft = socketService.on('partner_left', handleTerminationEvent);
    const unsubPartnerLeftUpper = socketService.on('PARTNER_LEFT', handleTerminationEvent);
    const unsubLeaveChat = socketService.on('leave_chat', handleTerminationEvent);
    const unsubLeaveChatUpper = socketService.on('LEAVE_CHAT', handleTerminationEvent);
    const unsubPartnerDisconnected = socketService.on('partner_disconnected', handleTerminationEvent);
    const unsubPartnerDisconnectedUpper = socketService.on('PARTNER_DISCONNECTED', handleTerminationEvent);

    return () => {
      unsubPartnerLeft();
      unsubPartnerLeftUpper();
      unsubLeaveChat();
      unsubLeaveChatUpper();
      unsubPartnerDisconnected();
      unsubPartnerDisconnectedUpper();
    };
  }, [purgeSessionMemory]);

  // Component unmount state purge routine:
  // When component unmounts, scrub all state & memory, and notify server if an active session was still ongoing
  useEffect(() => {
    return () => {
      console.log('[useChatSession] Component unmount. Purging session memory.');
      const currentSession = activeSessionRef.current;
      if (currentSession?.roomId && !currentSession.hasEnded) {
        socketService.send('leave_chat', { roomId: currentSession.roomId });
        socketService.send('chat:disconnect', { roomId: currentSession.roomId });
      }
      purgeSessionMemory();

      // Ensure app-switcher blur is removed on unmount
      if (typeof document !== 'undefined') {
        document.body.classList.remove('app-switcher-blur');
      }
    };
  }, [purgeSessionMemory]);

  // Foreground/Background Security (Shield):
  // When visibilityState is 'hidden' and activeSession exists, temporarily blur or mask sensitive conversation
  // container to prevent screenshot previews in the Android app-switcher
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && activeSessionRef.current) {
        // Temporarily blur or mask sensitive conversation container to prevent screenshot previews in the Android app-switcher
        document.body.classList.add('app-switcher-blur');
      } else {
        document.body.classList.remove('app-switcher-blur');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.body.classList.remove('app-switcher-blur');
    };
  }, []);

  return {
    activeSession,
    messages,
    setMessages,
    inputText,
    setInputText,
    purgeSessionMemory,
    leaveChat,
  };
}
