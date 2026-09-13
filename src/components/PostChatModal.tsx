import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { HeartHandshake, Check, Share2, Sparkles, UserPlus, Lock, ArrowRight, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { socketService } from '../services/socket.js';

interface PostChatModalProps {
  onOpenSavedConnections?: () => void;
}

export const PostChatModal: React.FC<PostChatModalProps> = ({ onOpenSavedConnections }) => {
  const {
    user,
    token,
    postChatPartner,
    friendshipNotice,
    submitFriendshipChoice,
    clearPostChat,
    login,
  } = useAuth();

  const [choiceMade, setChoiceMade] = useState<'keep' | 'let_go' | null>(null);
  const [guestDisplayName, setGuestDisplayName] = useState(user?.displayName || '');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestError, setGuestError] = useState<string | null>(null);
  const [guestUpgraded, setGuestUpgraded] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [mutualSaved, setMutualSaved] = useState(false);

  // Listen to mutual_save_success event over socket
  useEffect(() => {
    const handleMutualSave = (data: any) => {
      setMutualSaved(true);
    };

    socketService.on('mutual_save_success', handleMutualSave);
    return () => {
      socketService.off('mutual_save_success', handleMutualSave);
    };
  }, []);

  useEffect(() => {
    if (friendshipNotice) {
      setMutualSaved(true);
    }
  }, [friendshipNotice]);

  if (!postChatPartner) return null;

  const isGuest = !user || (user as any).isGuest;

  const handleKeepInTouch = () => {
    setChoiceMade('keep');

    // Notify backend WebSocket & matchmaker
    socketService.send('connection:keep_in_touch', {
      roomId: postChatPartner.roomId,
    });
    socketService.send('room:keep_in_touch', {
      roomId: postChatPartner.roomId,
    });

    submitFriendshipChoice(
      postChatPartner.partnerId,
      true,
      postChatPartner.roomId,
      postChatPartner.sessionSignature
    );
  };

  const handleLetItGo = () => {
    setChoiceMade('let_go');
    submitFriendshipChoice(
      postChatPartner.partnerId,
      false,
      postChatPartner.roomId,
      postChatPartner.sessionSignature
    );
  };

  const handleInlineGuestRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestDisplayName.trim() || guestPassword.length < 6) {
      setGuestError('Please enter a display name and a password of at least 6 characters.');
      return;
    }

    setIsUpgrading(true);
    setGuestError(null);

    try {
      // Register new user account to secure this guest connection
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const guestEmail = `${guestDisplayName.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}_${randomSuffix}@someone.local`;

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: guestEmail,
          displayName: guestDisplayName.trim(),
          password: guestPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setGuestError(data.error || 'Failed to create account. Please try another name.');
        setIsUpgrading(false);
        return;
      }

      if (data.token && data.user) {
        login(data.token, data.user);
        setGuestUpgraded(true);
      }
    } catch {
      setGuestError('Network error while securing account.');
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2723]/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-[#FAF8F5] border border-[#E7E0D8] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-[0_12px_40px_rgba(45,39,35,0.15)] space-y-6 text-[#2D2723]"
        id="post-chat-modal"
      >
        <div className="text-center space-y-2.5">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#FAF0EB] border border-[#E8C7BC] flex items-center justify-center text-[#C86D51] shadow-xs">
            <HeartHandshake className="w-7 h-7" />
          </div>
          <h2
            id="post-chat-title"
            className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-[#2D2723]"
          >
            Conversation ended
          </h2>
        </div>

        {mutualSaved ? (
          /* MUTUAL CONNECTION SAVED */
          <div className="space-y-4 text-center py-2" id="post-chat-mutual-connected">
            <div className="p-4 bg-[#EBF3ED] border border-[#C3D9C8] rounded-2xl text-[#2F5938] space-y-2">
              <p className="font-medium text-sm flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4 text-[#2F5938]" />
                Mutual Connection Saved!
              </p>
              <p className="text-xs text-[#2F5938]/90 leading-relaxed">
                Both you and <strong>{postChatPartner.partnerDisplayName}</strong> chose to keep in touch.
              </p>
            </div>

            <div className="p-4 bg-[#F5F2EB] border border-[#E7E0D8] rounded-2xl text-xs text-[#5C534D] space-y-2 text-left">
              <p className="font-medium text-[#2D2723] flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-[#C86D51]" />
                Where to find this connection:
              </p>
              <p>
                You can now message each other anytime in your private <strong>Saved Connections</strong> list.
              </p>
              <p className="text-[#78716C]">
                Someone never locks connections inside the platform. You are always free to voluntarily exchange personal contact information whenever you both wish.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {onOpenSavedConnections && (
                <button
                  id="post-chat-view-connections-btn"
                  onClick={() => {
                    clearPostChat();
                    onOpenSavedConnections();
                  }}
                  className="w-full sm:w-1/2 py-3 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] font-medium text-xs rounded-full transition-all cursor-pointer shadow-2xs"
                >
                  View Connections
                </button>
              )}
              <button
                id="post-chat-close-mutual-btn"
                onClick={clearPostChat}
                className={`w-full ${onOpenSavedConnections ? 'sm:w-1/2' : ''} py-3 bg-[#F5F2EB] hover:bg-[#EDE6DC] border border-[#E7E0D8] text-[#2D2723] font-medium text-xs rounded-full transition-all cursor-pointer shadow-2xs`}
              >
                Done
              </button>
            </div>
          </div>
        ) : choiceMade === 'let_go' ? (
          /* LET IT GO - CLEAN TEARDOWN */
          <div className="space-y-4 text-center py-4" id="post-chat-let-go">
            <div className="p-4 bg-[#F5F2EB] border border-[#E7E0D8] rounded-2xl space-y-2">
              <p className="text-sm font-medium text-[#2D2723]">
                Clean zero-retention teardown complete.
              </p>
              <p className="text-xs text-[#78716C] leading-relaxed">
                Your temporary messages have vanished from server RAM. Thank you for sharing your time.
              </p>
            </div>
            <button
              id="post-chat-return-home-btn"
              onClick={clearPostChat}
              className="w-full py-3 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] text-xs font-medium rounded-full transition-all cursor-pointer shadow-2xs mt-2"
            >
              Return to Home
            </button>
          </div>
        ) : choiceMade === 'keep' ? (
          /* KEEP IN TOUCH CHOSEN */
          <div className="space-y-4 text-center py-2" id="post-chat-recorded">
            {isGuest && !guestUpgraded ? (
              /* Inline One-Step Sign-Up for Guest to link connection */
              <div className="space-y-3.5 text-left p-4 bg-[#FAF0EB] border border-[#E8C7BC] rounded-2xl">
                <div className="flex items-center gap-2 text-[#C86D51]">
                  <UserPlus className="w-4 h-4" />
                  <h4 className="text-xs font-medium">Link this connection to your account</h4>
                </div>
                <p className="text-[11px] text-[#5C534D] leading-relaxed">
                  To access your saved connection with {postChatPartner.partnerDisplayName} in future sessions, secure an anonymous username & password:
                </p>

                {guestError && (
                  <p className="text-[11px] text-[#A84332] bg-[#FAF0EE] p-2 rounded-xl border border-[#F0D5D0]">
                    {guestError}
                  </p>
                )}

                <form onSubmit={handleInlineGuestRegister} className="space-y-2.5">
                  <div>
                    <label className="text-[10px] text-[#78716C] uppercase tracking-wider font-semibold">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={guestDisplayName}
                      onChange={(e) => setGuestDisplayName(e.target.value)}
                      placeholder="e.g. QuietWanderer"
                      className="w-full px-3 py-2 bg-white border border-[#E7E0D8] rounded-xl text-xs text-[#2D2723] focus:outline-none focus:ring-1 focus:ring-[#C86D51]"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#78716C] uppercase tracking-wider font-semibold">
                      Password (min 6 chars)
                    </label>
                    <input
                      type="password"
                      value={guestPassword}
                      onChange={(e) => setGuestPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 bg-white border border-[#E7E0D8] rounded-xl text-xs text-[#2D2723] focus:outline-none focus:ring-1 focus:ring-[#C86D51]"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isUpgrading}
                    className="w-full py-2.5 bg-[#C86D51] hover:bg-[#B65E43] text-white text-xs font-medium rounded-xl transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
                  >
                    <span>{isUpgrading ? 'Securing...' : 'Secure & Save Connection'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-3 p-4 bg-[#F5F2EB] border border-[#E7E0D8] rounded-2xl">
                <p className="text-sm font-medium text-[#2D2723]">
                  Your choice has been recorded privately.
                </p>
                <p className="text-xs text-[#78716C] leading-relaxed">
                  If <strong>{postChatPartner.partnerDisplayName}</strong> also chooses to keep in touch, you will be connected in your Saved Connections. Unilateral requests are never disclosed.
                </p>
              </div>
            )}

            <button
              id="post-chat-done-btn"
              onClick={clearPostChat}
              className="w-full py-3 bg-[#F5F2EB] hover:bg-[#EDE6DC] border border-[#E7E0D8] text-[#2D2723] text-xs font-medium rounded-full transition-all cursor-pointer shadow-2xs mt-2"
            >
              Done
            </button>
          </div>
        ) : (
          /* THE MUTUAL CONSENT QUESTION WITH THE 2 EXPLICIT OPTIONS */
          <div className="space-y-6 pt-1 text-center">
            <div className="space-y-2">
              <p
                id="post-chat-question"
                className="font-serif text-lg sm:text-xl text-[#2D2723]"
              >
                Did you enjoy your conversation with {postChatPartner.partnerDisplayName}?
              </p>
              <p className="text-xs text-[#78716C] max-w-xs mx-auto leading-relaxed">
                Take a moment to decide. If both of you choose to keep in touch, you will be able to message each other again.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Keep in touch (Save connection) */}
              <button
                id="post-chat-keep-btn"
                type="button"
                onClick={handleKeepInTouch}
                className="p-4 bg-[#FAF0EB] hover:bg-[#F5E2DA] border border-[#E8C7BC] rounded-2xl text-left transition-all cursor-pointer shadow-2xs group flex flex-col justify-between gap-2"
              >
                <div>
                  <span className="font-serif font-medium text-sm text-[#C86D51] block">
                    Keep in touch
                  </span>
                  <span className="text-[11px] text-[#5C534D] leading-tight block mt-1">
                    Save connection
                  </span>
                </div>
                <span className="text-[10px] text-[#8C827A] group-hover:text-[#C86D51] transition-colors flex items-center gap-1">
                  Mutual consent only →
                </span>
              </button>

              {/* Option 2: Let it go (Clean teardown, zero retention) */}
              <button
                id="post-chat-let-go-btn"
                type="button"
                onClick={handleLetItGo}
                className="p-4 bg-[#F5F2EB] hover:bg-[#EDE6DC] border border-[#E7E0D8] rounded-2xl text-left transition-all cursor-pointer shadow-2xs group flex flex-col justify-between gap-2"
              >
                <div>
                  <span className="font-serif font-medium text-sm text-[#2D2723] block">
                    Let it go
                  </span>
                  <span className="text-[11px] text-[#5C534D] leading-tight block mt-1">
                    Clean teardown, zero retention
                  </span>
                </div>
                <span className="text-[10px] text-[#8C827A] group-hover:text-[#2D2723] transition-colors flex items-center gap-1">
                  Ephemeral exit →
                </span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
