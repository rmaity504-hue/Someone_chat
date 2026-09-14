import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile, ChatMessage, Friendship, AdminStats } from '../types.js';
import { getWebSocketUrl, socketService } from '../services/socket.js';
import { playMatchChime, playMessageSound, playDisconnectSound } from '../utils/feedback.js';
import { subscribeToPushNotifications } from '../utils/pushNotifications.js';
import { filterChatMessage } from '../utils/privacyFilter.js';

export interface VolunteerRequest {
  offerId: string;
  message: string;
}

export interface MatchingState {
  state: 'idle' | 'searching' | 'volunteer_available' | 'no_one_available';
  message?: string;
  offerId?: string;
  canStay?: boolean;
  statusMessage?: string;
}

export interface ActiveSession {
  roomId: string;
  partnerId: string;
  partnerDisplayName: string;
  isSimulator?: boolean;
  matchedTopics?: string[];
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  wsConnected: boolean;
  matchingState: MatchingState;
  activeSession: ActiveSession | null;
  messages: ChatMessage[];
  isPartnerTyping: boolean;
  pendingVolunteerRequest: VolunteerRequest | null;
  postChatPartner: { partnerId: string; partnerDisplayName: string; roomId: string; sessionSignature?: string } | null;
  friendshipNotice: string | null;
  systemNotification: string | null;
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  enterMatching: (topics?: string[]) => void;
  leaveMatching: () => void;
  skipToNext: (topics?: string[]) => void;
  sendTyping: (isTyping: boolean) => void;
  acceptMatch: (roomId: string) => void;
  respondToVolunteer: (offerId: string, action: 'connect' | 'not_now') => void;
  sendMessage: (text: string) => void;
  disconnectChat: () => void;
  quickEmergencyExit: () => void;
  sessionClosureActive: boolean;
  dismissSessionClosure: () => void;
  submitFriendshipChoice: (partnerId: string, choice: boolean, roomId?: string, sessionSignature?: string) => void;
  clearPostChat: () => void;
  reportUser: (reportedUserId: string, category: string, details: string, roomId?: string) => Promise<boolean>;
  blockUser: (targetUserId: string) => Promise<boolean>;
  toggleVolunteer: (active: boolean) => Promise<boolean>;
  acknowledgeSafety: () => Promise<boolean>;
  verifyEmail: (code: string) => Promise<boolean>;
  updateSecurityQuestion: (question: string, answer: string) => Promise<{ success: boolean; error?: string }>;
  deleteAccount: (password?: string) => Promise<{ success: boolean; error?: string }>;
  clearNotification: () => void;
  matchWithCompanion: () => Promise<boolean>;
  simulateCompanionAction: (action: 'violation' | 'clean_chat') => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('auth_token');
      if (urlToken) {
        localStorage.setItem('someone_token', urlToken);
        return urlToken;
      }
      return localStorage.getItem('someone_token');
    }
    return null;
  });
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const [matchingState, setMatchingState] = useState<MatchingState>({ state: 'idle' });
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isPartnerTyping, setIsPartnerTyping] = useState<boolean>(false);
  const [pendingVolunteerRequest, setPendingVolunteerRequest] = useState<VolunteerRequest | null>(null);
  const [postChatPartner, setPostChatPartner] = useState<{
    partnerId: string;
    partnerDisplayName: string;
    roomId: string;
    sessionSignature?: string;
  } | null>(null);
  const [friendshipNotice, setFriendshipNotice] = useState<string | null>(null);
  const [systemNotification, setSystemNotification] = useState<string | null>(null);
  const [sessionClosureActive, setSessionClosureActive] = useState<boolean>(false);

  const messagesRef = useRef<ChatMessage[]>([]);
  const userRef = useRef<UserProfile | null>(null);
  const partnerTypingTimerRef = useRef<any>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const clearNotification = () => setSystemNotification(null);

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        // invalid token
        localStorage.removeItem('someone_token');
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Handle URL verification notices and query param cleanup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const isVerified = params.get('verified') === 'true';
      const error = params.get('error');

      if (isVerified) {
        setSystemNotification('Your email has been successfully verified! You are now signed in.');
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (error) {
        setSystemNotification(decodeURIComponent(error));
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (params.get('auth_token')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Multi-tab instant login synchronization
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'someone_token') {
        const nextToken = e.newValue;
        setToken(nextToken);
        if (!nextToken) {
          setUser(null);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Bind connection status directly to the singleton socket service
  useEffect(() => {
    const unsub = socketService.onStatusChange((status) => {
      setWsConnected(status === 'connected');
    });
    return unsub;
  }, []);

  // Persistent WebSocket lifecycle and event subscriptions via singleton service
  useEffect(() => {
    if (!token || !user) {
      socketService.disconnect('User logged out');
      return;
    }

    // Connect singleton socket (resilient across component re-mounts and route navigation)
    socketService.connect(token);

    const unsubAuthError = socketService.on('auth:error', () => {
      localStorage.removeItem('someone_token');
      setToken(null);
      setUser(null);
    });

    const unsubAccountRestricted = socketService.on('account:restricted', (data) => {
      if (data?.reason) {
        setSystemNotification(data.reason);
      }
    });

    const unsubMatchingState = socketService.on('matching:state', (data) => {
      setMatchingState(data);
    });

    const onMatchFoundHandler = (data: any) => {
      playMatchChime();
      setMatchingState({
        state: 'searching',
        message: data?.message || 'Someone is here.',
        offerId: data?.roomId,
      });
    };

    const unsubMatchFound = socketService.on('match:found', onMatchFoundHandler);
    const unsubMatchFoundUpper = socketService.on('MATCH_FOUND', onMatchFoundHandler);
    const unsubMatched = socketService.on('matched', onMatchFoundHandler);

    const unsubWaitingPartner = socketService.on('match:waiting_partner', (data) => {
      setMatchingState((prev) => ({
        ...prev,
        statusMessage: data.message || 'Connecting to room... waiting for partner',
      }));
    });

    const unsubMatchFailed = socketService.on('match:failed', (data) => {
      setMatchingState({
        state: 'idle',
        statusMessage: data.message || 'Connection failed.',
      });
      setSystemNotification(data.message || 'Connection failed.');
    });

    const unsubVolunteerRequest = socketService.on('volunteer:request', (data) => {
      setPendingVolunteerRequest(data);
    });

    const unsubSessionStart = socketService.on('session:start', (data) => {
      playMatchChime();
      setActiveSession({
        roomId: data.roomId,
        partnerId: data.partnerId,
        partnerDisplayName: data.partnerDisplayName,
        isSimulator: data.isSimulator,
        matchedTopics: data.matchedTopics,
      });
      setMessages([]);
      setIsPartnerTyping(false);
      setMatchingState({ state: 'idle' });
      setPendingVolunteerRequest(null);
    });

    const onIncomingMessage = (data: any) => {
      if (userRef.current && data.senderId !== userRef.current.id) {
        playMessageSound();
        setIsPartnerTyping(false);
      }
      setMessages((prev) => [...prev, data]);
    };

    const unsubChatMessage = socketService.on('chat:message', onIncomingMessage);
    const unsubChatMessageUpper = socketService.on('MESSAGE_RECEIVED', onIncomingMessage);

    const unsubChatNotice = socketService.on('chat:notice', (data) => {
      if (data?.message) {
        setSystemNotification(data.message);
      }
    });

    const unsubChatWarning = socketService.on('chat:warning', (data) => {
      if (data?.message) {
        setSystemNotification(data.message);
      }
    });

    const handlePartnerTyping = (data: any) => {
      const isTyping = data?.isTyping !== undefined ? Boolean(data.isTyping) : true;
      if (isTyping) {
        setIsPartnerTyping(true);
        if (partnerTypingTimerRef.current) clearTimeout(partnerTypingTimerRef.current);
        // Automatically decay typing indicator after 2.5 seconds of inactivity
        partnerTypingTimerRef.current = setTimeout(() => {
          setIsPartnerTyping(false);
        }, 2500);
      } else {
        setIsPartnerTyping(false);
        if (partnerTypingTimerRef.current) clearTimeout(partnerTypingTimerRef.current);
      }
    };

    const handlePartnerTypingStop = () => {
      setIsPartnerTyping(false);
      if (partnerTypingTimerRef.current) clearTimeout(partnerTypingTimerRef.current);
    };

    const unsubTyping = socketService.on('user_typing', handlePartnerTyping);
    const unsubChatTyping = socketService.on('chat:typing', handlePartnerTyping);
    const unsubTypingStart = socketService.on('TYPING_START', handlePartnerTyping);
    const unsubTypingStop = socketService.on('TYPING_STOP', handlePartnerTypingStop);

    const onPartnerDisconnectedHandler = (data: any) => {
      playDisconnectSound();
      setActiveSession(null);
      setMessages([]);
      messagesRef.current = [];
      setIsPartnerTyping(false);
      setMatchingState({ state: 'idle' });
      setSessionClosureActive(true);
      if (data?.reason) {
        setSystemNotification(data.reason);
      }
    };

    const unsubPartnerDisconnected = socketService.on('partner_disconnected', onPartnerDisconnectedHandler);
    const unsubPartnerDisconnectedUpper = socketService.on('PARTNER_DISCONNECTED', onPartnerDisconnectedHandler);

    const unsubChatBlocked = socketService.on('chat:blocked', (data) => {
      setSystemNotification(data.message);
    });

    const unsubSessionEnded = socketService.on('session:ended', (data) => {
      playDisconnectSound();
      const hadMessages = messagesRef.current.length > 0 || (data.messageCount && data.messageCount > 0);
      setActiveSession(null);
      setMessages([]);
      messagesRef.current = [];
      setIsPartnerTyping(false);
      setMatchingState({ state: 'idle' });
      if (data.safetyIntervention) {
        setSystemNotification(data.reason || 'The conversation was ended due to a community safety guideline violation.');
      } else if (data.promptFriendship && data.partnerId && hadMessages) {
        setPostChatPartner({
          partnerId: data.partnerId,
          partnerDisplayName: data.partnerDisplayName,
          roomId: data.roomId,
          sessionSignature: data.sessionSignature,
        });
      } else {
        setSessionClosureActive(true);
        if (data.reason && data.reason !== 'Conversation ended' && data.reason !== 'Connection timed out.') {
          setSystemNotification(data.reason);
        }
      }
    });

    const unsubSessionEnforcement = socketService.on('session:enforcement', (data) => {
      setActiveSession(null);
      setIsPartnerTyping(false);
      setMatchingState({ state: 'idle' });
      setMessages([]);
      setSystemNotification(data.message);
      if (user) {
        setUser({
          ...user,
          status: data.status,
          suspendedUntil: data.suspendedUntil,
          restrictionReason: data.reason,
        });
      }
      refreshUser();
    });

    const unsubFriendshipCreated = socketService.on('friendship:created', (data) => {
      setFriendshipNotice(data.message);
    });

    return () => {
      unsubAuthError();
      unsubAccountRestricted();
      unsubMatchingState();
      unsubMatchFound();
      unsubMatchFoundUpper();
      unsubMatched();
      unsubWaitingPartner();
      unsubMatchFailed();
      unsubVolunteerRequest();
      unsubSessionStart();
      unsubChatMessage();
      unsubChatMessageUpper();
      unsubChatNotice();
      unsubChatWarning();
      unsubTyping();
      unsubChatTyping();
      unsubTypingStart();
      unsubTypingStop();
      unsubPartnerDisconnected();
      unsubPartnerDisconnectedUpper();
      unsubChatBlocked();
      unsubSessionEnded();
      unsubSessionEnforcement();
      unsubFriendshipCreated();
      if (partnerTypingTimerRef.current) clearTimeout(partnerTypingTimerRef.current);
    };
  }, [token, user?.id, refreshUser]);

  const login = (newToken: string, newUser: UserProfile) => {
    localStorage.setItem('someone_token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    socketService.disconnect('User logged out');
    localStorage.removeItem('someone_token');
    setToken(null);
    setUser(null);
    setActiveSession(null);
    setMatchingState({ state: 'idle' });
  };

  const enterMatching = (topics?: string[]) => {
    socketService.send('matching:enter', { topics });
    setMatchingState({ state: 'searching', message: "Finding someone who's available..." });
  };

  const leaveMatching = () => {
    socketService.send('matching:leave');
    setMatchingState({ state: 'idle' });
  };

  const skipToNext = (topics?: string[]) => {
    socketService.send('chat:next', { topics });
    setActiveSession(null);
    setMessages([]);
    setIsPartnerTyping(false);
    setMatchingState({ state: 'searching', message: "Finding someone who's available..." });
  };

  const sendTyping = (isTyping: boolean) => {
    if (!activeSession) return;
    socketService.send(isTyping ? 'TYPING_START' : 'TYPING_STOP', { roomId: activeSession.roomId, isTyping });
    socketService.send('user_typing', { roomId: activeSession.roomId, isTyping });
  };

  const acceptMatch = (roomId: string) => {
    setMatchingState((prev) => ({
      ...prev,
      statusMessage: 'Connecting to room...',
    }));
    socketService.send('accept_match', { roomId });
    socketService.send('match:accept', { roomId });
  };

  const respondToVolunteer = (offerId: string, action: 'connect' | 'not_now') => {
    setPendingVolunteerRequest(null);
    socketService.send('volunteer:respond', { offerId, action });
  };

  const sendMessage = (text: string) => {
    if (!activeSession || !text.trim()) return;
    const filterResult = filterChatMessage(text);
    if (!filterResult.allowed) {
      setSystemNotification(filterResult.reason || 'Links are kept out to maintain a quiet sanctuary.');
      return;
    }
    // Clear typing indicator immediately upon sending a message
    sendTyping(false);
    socketService.send('chat:send', {
      roomId: activeSession.roomId,
      text: filterResult.sanitizedText,
    });
  };

  const disconnectChat = () => {
    if (activeSession) {
      socketService.send('chat:disconnect', { roomId: activeSession.roomId });
    }
    setActiveSession(null);
    setMessages([]);
    messagesRef.current = [];
    setIsPartnerTyping(false);
    setMatchingState({ state: 'idle' });
    setSessionClosureActive(true);
  };

  const quickEmergencyExit = () => {
    if (activeSession) {
      socketService.send('chat:disconnect', { roomId: activeSession.roomId });
    }
    setActiveSession(null);
    setMessages([]);
    messagesRef.current = [];
    setIsPartnerTyping(false);
    setPostChatPartner(null);
    setSessionClosureActive(false);
    setMatchingState({ state: 'idle' });
    setSystemNotification(null);
  };

  const dismissSessionClosure = () => {
    setSessionClosureActive(false);
  };

  const submitFriendshipChoice = (
    partnerId: string,
    choice: boolean,
    roomId?: string,
    sessionSignature?: string
  ) => {
    const validRoomId = roomId || postChatPartner?.roomId;
    const validSignature = sessionSignature || postChatPartner?.sessionSignature;
    socketService.send('friendship:choice', {
      partnerId,
      wantsToTalkAgain: choice,
      roomId: validRoomId,
      sessionSignature: validSignature,
    });
  };

  const clearPostChat = () => {
    setPostChatPartner(null);
    setFriendshipNotice(null);
  };

  const reportUser = async (
    reportedUserId: string,
    category: string,
    details: string,
    roomId?: string
  ): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch('/api/safety/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reportedUserId, category, details, roomId }),
      });
      if (res.ok) {
        if (activeSession) {
          setActiveSession(null);
        }
        return true;
      }
    } catch (err) {
      console.error('Error reporting user:', err);
    }
    return false;
  };

  const blockUser = async (targetUserId: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch('/api/safety/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId }),
      });
      if (res.ok) {
        if (activeSession) {
          setActiveSession(null);
        }
        return true;
      }
    } catch (err) {
      console.error('Error blocking user:', err);
    }
    return false;
  };

  const toggleVolunteer = async (active: boolean): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch('/api/volunteer/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);

        // When activating listener mode, subscribe this device to Web Push notifications
        // so the user receives native alerts when visitors enter the queue while the app is closed.
        if (active) {
          subscribeToPushNotifications(token, data.user.role || 'volunteer').catch((err) => {
            console.warn('[AUTH] Push notification subscription deferred or dismissed:', err);
          });
        }

        return true;
      }
    } catch (err) {
      console.error('Error toggling volunteer:', err);
    }
    return false;
  };

  const acknowledgeSafety = async (): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch('/api/auth/acknowledge-safety', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        return true;
      }
    } catch (err) {
      console.error('Error acknowledging safety:', err);
    }
    return false;
  };

  const verifyEmail = async (code: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        return true;
      }
    } catch (err) {
      console.error('Error verifying email:', err);
    }
    return false;
  };

  const updateSecurityQuestion = async (
    question: string,
    answer: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch('/api/auth/security-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question, answer }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to update security question' };
      }
      if (data.user) {
        setUser(data.user);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Connection error' };
    }
  };

  const deleteAccount = async (password?: string): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch('/api/users/me', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(password ? { password } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to delete account' };
      }

      socketService.disconnect('Account deleted');
      localStorage.removeItem('someone_token');
      setToken(null);
      setUser(null);
      setActiveSession(null);
      setMatchingState({ state: 'idle' });
      setPostChatPartner(null);
      setFriendshipNotice(null);
      setPendingVolunteerRequest(null);
      setMessages([]);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error while deleting account.' };
    }
  };

  const matchWithCompanion = async (): Promise<boolean> => {
    if (socketService.isConnected()) {
      socketService.send('simulator:match');
      return true;
    }
    if (token) {
      try {
        const res = await fetch('/api/simulator/match', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        return res.ok && data.success;
      } catch (err) {
        console.error('Failed to match with companion:', err);
      }
    }
    return false;
  };

  const simulateCompanionAction = async (action: 'violation' | 'clean_chat'): Promise<boolean> => {
    if (!activeSession) return false;
    if (socketService.isConnected()) {
      socketService.send('simulator:action', { roomId: activeSession.roomId, action });
      return true;
    }
    if (token) {
      try {
        const res = await fetch('/api/simulator/action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ roomId: activeSession.roomId, action }),
        });
        const data = await res.json();
        return res.ok && data.success;
      } catch (err) {
        console.error('Failed to simulate companion action:', err);
      }
    }
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        wsConnected,
        matchingState,
        activeSession,
        messages,
        isPartnerTyping,
        pendingVolunteerRequest,
        postChatPartner,
        friendshipNotice,
        systemNotification,
        login,
        logout,
        refreshUser,
        enterMatching,
        leaveMatching,
        skipToNext,
        sendTyping,
        acceptMatch,
        respondToVolunteer,
        sendMessage,
        disconnectChat,
        quickEmergencyExit,
        sessionClosureActive,
        dismissSessionClosure,
        submitFriendshipChoice,
        clearPostChat,
        reportUser,
        blockUser,
        toggleVolunteer,
        acknowledgeSafety,
        verifyEmail,
        updateSecurityQuestion,
        deleteAccount,
        clearNotification,
        matchWithCompanion,
        simulateCompanionAction,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
