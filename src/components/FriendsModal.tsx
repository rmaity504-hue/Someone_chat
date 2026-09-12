import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Friendship } from '../types.js';
import { Users, MessageSquare, Trash2, X, Share2 } from 'lucide-react';

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDirectChat?: (friend: Friendship) => void;
}

export const FriendsModal: React.FC<FriendsModalProps> = ({
  isOpen,
  onClose,
  onOpenDirectChat,
}) => {
  const { token, acceptMatch } = useAuth();
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFriends = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/friends', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      }
    } catch (err) {
      console.error('Error fetching friends:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFriends();
    }
  }, [isOpen]);

  const handleRemoveFriend = async (friendId: string) => {
    if (!confirm('Remove this person from your friends list?')) return;
    try {
      const res = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ friendId }),
      });
      if (res.ok) {
        setFriends((prev) => prev.filter((f) => f.partnerId !== friendId));
      }
    } catch (err) {
      console.error('Error removing friend:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2723]/40 backdrop-blur-xs">
      <div
        className="bg-[#FAF8F5] border border-[#E7E0D8] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-[0_12px_40px_rgba(45,39,35,0.15)] space-y-5 text-[#2D2723]"
        id="friends-modal"
      >
        <div className="flex items-center justify-between border-b border-[#E7E0D8] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#FAF0EB] rounded-xl text-[#C86D51]">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="font-serif font-medium text-xl text-[#2D2723]">Friends</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#8C827A] hover:text-[#2D2723] rounded-full cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reassurance note on friendship portability */}
        <div className="p-3.5 bg-[#F5F2EB] border border-[#E7E0D8] rounded-2xl text-xs text-[#5C534D] flex items-start gap-2.5 leading-relaxed">
          <Share2 className="w-4 h-4 text-[#C86D51] shrink-0 mt-0.5" />
          <span>
            Friendships here are created strictly through mutual agreement. You are welcome to continue conversations here, or voluntarily exchange external contact details to stay in touch elsewhere.
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-[#78716C]">Loading friends...</div>
        ) : friends.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="font-serif text-base text-[#2D2723] font-medium">No connections yet</p>
            <p className="text-xs text-[#78716C] max-w-xs mx-auto leading-relaxed">
              When both you and someone you talked to agree to stay in touch, they will appear here privately.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center justify-between p-3.5 bg-[#FAF8F5] border border-[#E7E0D8] rounded-2xl hover:border-[#D5CBC2] transition-colors"
              >
                <div>
                  <h4 className="text-sm font-medium text-[#2D2723]">{friend.partnerDisplayName}</h4>
                  <span className="text-[11px] text-[#8C827A]">
                    Connected {new Date(friend.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleRemoveFriend(friend.partnerId)}
                    className="p-2 text-[#8C827A] hover:text-[#C86D51] rounded-xl transition-colors cursor-pointer"
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
            className="px-6 py-2.5 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] text-xs font-medium rounded-full shadow-2xs transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
