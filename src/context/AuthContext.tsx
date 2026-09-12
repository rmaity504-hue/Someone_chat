import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile, ChatMessage, Friendship, AdminStats } from '../types.js';

export interface VolunteerRequest {
  offerId: string;
  message: string;
}

export interface MatchingState {
  state: 'idle' | 'searching' | 'volunteer_available' | 'no_one_available';
  message?: string;
  offerId?: string;
  canStay?: boolean;
}

export interface ActiveSession {
  roomId: string;
  partnerId: string;
  partnerDisplayName: string;
  isSimulator?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  wsConnected: boolean;
  matchingState: MatchingState;
  activeSession: ActiveSession | null;
  messages: ChatMessage[];
  pendingVolunteerRequest: VolunteerRequest | null;
  postChatPartner: { partnerId: string; partnerDisplayName: string; roomId: string; sessionSignature?: string } | null;
  friendshipNotice: string | null;
  systemNotification: string | null;
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  enterMatching: () => void;
  leaveMatching: () => void;
  acceptMatch: (roomId: string) => void;
  respondToVolunteer: (offerId: string, action: 'connect' | 'not_now') => void;
  sendMessage: (text: string) => void;
  disconnectChat: () => void;
  submitFriendshipChoice: (partnerId: string, choice: boolean, roomId?: string, sessionSignature?: string) => void;
  clearPostChat: () => void;
  reportUser: (reportedUserId: string, category: string, details: string, roomId?: string) => Promise<boolean>;
  blockUser: (targetUserId: string) => Promise<boolean>;
  toggleVolunteer: (active: boolean) => Promise<boolean>;
  acknowledgeSafety: () => Promise<boolean>;
  verifyEmail: (code: string) => Promise<boolean>;
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
  const [pendingVolunteerRequest, setPendingVolunteerRequest] = useState<VolunteerRequest | null>(null);
  const [postChatPartner, setPostChatPartner] = useState<{
    partnerId: string;
    partnerDisplayName: string;
    roomId: string;
    sessionSignature?: string;
  } | null>(null);
  const [friendshipNotice, setFriendshipNotice] = useState<string | null>(null);
  const [systemNotification, setSystemNotification] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatIntervalRef = useRef<any>(null);

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

  // WebSocket Connection with automatic reconnection and heartbeat resilience
  useEffect(() => {
    if (!token || !user) {
      if (wsRef.current) {
        try {
          wsRef.current.close(1000, 'User logged out');
        } catch {
          // ignore
        }
        wsRef.current = null;
      }
      setWsConnected(false);
      return;
    }

    let isMounted = true;
    let reconnectTimer: any = null;
    let reconnectAttempts = 0;

    const connect = () => {
      if (!isMounted || !token) return;

      // Close previous connection cleanly if still lingering
      if (wsRef.current) {
        try {
          wsRef.current.onopen = null;
          wsRef.current.onmessage = null;
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.close();
        } catch {
          // ignore
        }
        wsRef.current = null;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (err) {
        scheduleReconnect();
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) {
          try {
            ws.close();
          } catch {
            // ignore
          }
          return;
        }
        setWsConnected(true);
        reconnectAttempts = 0;

        // Authenticate immediately
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event: 'auth', data: { token } }));
        }

        // Start heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'heartbeat' }));
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const { event: ev, data } = payload;

          switch (ev) {
            case 'auth:error':
              // Invalid or expired token
              localStorage.removeItem('someone_token');
              setToken(null);
              setUser(null);
              break;

            case 'account:restricted':
              if (data?.reason) {
                setSystemNotification(data.reason);
              }
              break;

            case 'matching:state':
              setMatchingState(data);
              break;

            case 'match:found':
              setMatchingState({
                state: 'searching',
                message: data.message || 'Someone is here.',
                offerId: data.roomId,
              });
              break;

            case 'volunteer:request':
              setPendingVolunteerRequest(data);
              break;

            case 'session:start':
              setActiveSession({
                roomId: data.roomId,
                partnerId: data.partnerId,
                partnerDisplayName: data.partnerDisplayName,
                isSimulator: data.isSimulator,
              });
              setMessages([]);
              setMatchingState({ state: 'idle' });
              setPendingVolunteerRequest(null);
              break;

            case 'chat:message':
              setMessages((prev) => [...prev, data]);
              break;

            case 'chat:blocked':
              setSystemNotification(data.message);
              break;

            case 'session:ended':
              setActiveSession(null);
              setMatchingState({ state: 'idle' });
              if (data.safetyIntervention) {
                setSystemNotification(data.reason || 'The conversation was ended due to a community safety guideline violation.');
              } else if (data.promptFriendship && data.partnerId) {
                setPostChatPartner({
                  partnerId: data.partnerId,
                  partnerDisplayName: data.partnerDisplayName,
                  roomId: data.roomId,
                  sessionSignature: data.sessionSignature,
                });
              }
              break;

            case 'session:enforcement':
              setActiveSession(null);
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
              break;

            case 'friendship:created':
              setFriendshipNotice(data.message);
              break;

            case 'friendship:choice_recorded':
              // Choice saved
              break;

            default:
              break;
          }
        } catch (err) {
          console.warn('Error parsing WS message:', err);
        }
      };

      ws.onclose = (event) => {
        setWsConnected(false);
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Only reconnect if not intentionally closed by logout (1000) or restricted (4003)
        if (isMounted && event.code !== 1000 && event.code !== 4003) {
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        // Handled cleanly via onclose and reconnect schedule.
        // We avoid logging raw DOM Event objects to console.error.
      };
    };

    const scheduleReconnect = () => {
      if (!isMounted || !token) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 10000);
      reconnectAttempts += 1;
      reconnectTimer = setTimeout(() => {
        if (isMounted) {
          connect();
        }
      }, delay);
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (wsRef.current) {
        try {
          wsRef.current.onopen = null;
          wsRef.current.onmessage = null;
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.close(1000, 'Component unmounted');
        } catch {
          // ignore
        }
        wsRef.current = null;
      }
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
    localStorage.removeItem('someone_token');
    setToken(null);
    setUser(null);
    setActiveSession(null);
    setMatchingState({ state: 'idle' });
  };

  const enterMatching = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'matching:enter' }));
    } else if (token) {
      fetch('/api/matching/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    setMatchingState({ state: 'searching', message: "Finding someone who's available..." });
  };

  const leaveMatching = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'matching:leave' }));
    } else if (token) {
      fetch('/api/matching/leave', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    setMatchingState({ state: 'idle' });
  };

  const acceptMatch = (roomId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'match:accept', data: { roomId } }));
    }
  };

  const respondToVolunteer = (offerId: string, action: 'connect' | 'not_now') => {
    setPendingVolunteerRequest(null);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'volunteer:respond', data: { offerId, action } }));
    }
  };

  const sendMessage = (text: string) => {
    if (!activeSession || !text.trim()) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event: 'chat:send',
          data: {
            roomId: activeSession.roomId,
            text: text.trim(),
          },
        })
      );
    }
  };

  const disconnectChat = () => {
    if (!activeSession) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event: 'chat:disconnect',
          data: { roomId: activeSession.roomId },
        })
      );
    }
    setActiveSession(null);
  };

  const submitFriendshipChoice = (
    partnerId: string,
    choice: boolean,
    roomId?: string,
    sessionSignature?: string
  ) => {
    const validRoomId = roomId || postChatPartner?.roomId;
    const validSignature = sessionSignature || postChatPartner?.sessionSignature;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event: 'friendship:choice',
          data: {
            partnerId,
            wantsToTalkAgain: choice,
            roomId: validRoomId,
            sessionSignature: validSignature,
          },
        })
      );
    } else if (token && validRoomId && validSignature) {
      fetch('/api/post-chat/choice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: validRoomId,
          partnerId,
          choice,
          sessionSignature: validSignature,
        }),
      }).catch(console.error);
    }
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

      if (wsRef.current) {
        wsRef.current.close();
      }
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
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'simulator:match' }));
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
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event: 'simulator:action',
          data: { roomId: activeSession.roomId, action },
        })
      );
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
        pendingVolunteerRequest,
        postChatPartner,
        friendshipNotice,
        systemNotification,
        login,
        logout,
        refreshUser,
        enterMatching,
        leaveMatching,
        acceptMatch,
        respondToVolunteer,
        sendMessage,
        disconnectChat,
        submitFriendshipChoice,
        clearPostChat,
        reportUser,
        blockUser,
        toggleVolunteer,
        acknowledgeSafety,
        verifyEmail,
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
