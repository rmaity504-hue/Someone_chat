import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Users, MessageSquare, Trash2, X, Share2, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SavedConnection {
  id: string;
  partnerId: string;
  partnerDisplayName: string;
  createdAt: number;
  isOnline?: boolean;
}

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FriendsModal: React.FC<FriendsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { token } = useAuth();
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingChatId, setStartingChatId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchConnections = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/connections', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections || data.friends || []);
      } else {
        setErrorMessage('Unable to load saved connections.');
      }
    } catch (err) {
      console.error('Error fetching connections:', err);
      setErrorMessage('Connection error while fetching peers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConnections();
    }
  }, [isOpen, token]);

  const handleStartDirectChat = async (partnerId: string) => {
    if (!token) return;
    setStartingChatId(partnerId);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/connections/start-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ partnerId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to start direct chat session.');
        setStartingChatId(null);
        return;
      }

      // Successful session creation: WebSocket will emit `session:start` to load ChatView
      onClose();
    } catch (err) {
      console.error('Error starting direct chat:', err);
      setErrorMessage('Failed to connect to direct chat.');
    } finally {
      setStartingChatId(null);
    }
  };

  const handleRemoveConnection = async (partnerId: string) => {
    if (!confirm('Remove this person from your saved connections?')) return;
    try {
      const res = await fetch('/api/connections/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ partnerId }),
      });
      if (res.ok) {
        setConnections((prev) => prev.filter((c) => c.partnerId !== partnerId));
      }
    } catch (err) {
      console.error('Error removing connection:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2723]/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-[#FAF8F5] border border-[#E7E0D8] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-[0_12px_40px_rgba(45,39,35,0.15)] space-y-5 text-[#2D2723]"
        id="saved-connections-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E7E0D8] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#FAF0EB] rounded-xl text-[#C86D51] border border-[#E8C7BC]">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-medium text-xl text-[#2D2723]">Saved Connections</h3>
              <p className="text-[11px] text-[#8C827A]">Peers who mutually agreed to keep in touch</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8C827A] hover:text-[#2D2723] rounded-full cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="p-3 bg-[#FAF0EE] border border-[#F0D5D0] rounded-2xl text-xs text-[#A84332] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Portability Notice */}
        <div className="p-3.5 bg-[#F5F2EB] border border-[#E7E0D8] rounded-2xl text-xs text-[#5C534D] flex items-start gap-2.5 leading-relaxed">
          <Share2 className="w-4 h-4 text-[#C86D51] shrink-0 mt-0.5" />
          <span>
            Connections here are formed strictly through mutual consent. You can start a private 1-on-1 chat whenever you are both awake, or exchange external details to continue elsewhere.
          </span>
        </div>

        {/* List of Connections */}
        {loading ? (
          <div className="py-8 text-center text-xs text-[#78716C] flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#C86D51]" />
            <span>Loading connections...</span>
          </div>
        ) : connections.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-10 h-10 mx-auto rounded-full bg-[#FAF0EB] text-[#C86D51] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="font-serif text-base text-[#2D2723] font-medium">No saved connections yet</p>
            <p className="text-xs text-[#78716C] max-w-xs mx-auto leading-relaxed">
              When both you and someone you talked to choose &quot;Keep in touch&quot; after a conversation, they will appear here privately.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto scroll-container pr-1">
            {connections.map((conn) => (
              <div
                key={conn.id || conn.partnerId}
                className="flex items-center justify-between p-3.5 bg-[#FAF8F5] border border-[#E7E0D8] rounded-2xl hover:border-[#D5CBC2] transition-colors"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-[#2D2723] truncate">{conn.partnerDisplayName}</h4>
                    {conn.isOnline ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Online
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#8C827A] bg-[#F5F2EB] px-1.5 py-0.5 rounded-full border border-[#E7E0D8]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#A8A199]"></span>
                        Offline
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#8C827A] block">
                    Connected {new Date(conn.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    id={`start-chat-${conn.partnerId}`}
                    onClick={() => handleStartDirectChat(conn.partnerId)}
                    disabled={startingChatId === conn.partnerId}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] rounded-full text-xs font-medium transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                    title="Initiate direct 1-on-1 private chat"
                  >
                    {startingChatId === conn.partnerId ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <MessageSquare className="w-3.5 h-3.5" />
                    )}
                    <span>Chat</span>
                  </button>

                  <button
                    id={`remove-conn-${conn.partnerId}`}
                    onClick={() => handleRemoveConnection(conn.partnerId)}
                    className="p-1.5 text-[#8C827A] hover:text-[#C86D51] hover:bg-[#FAF0EE] rounded-xl transition-colors cursor-pointer"
                    title="Remove connection"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 text-right">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#F5F2EB] hover:bg-[#EDE6DC] text-[#2D2723] border border-[#E7E0D8] text-xs font-medium rounded-full shadow-2xs transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
