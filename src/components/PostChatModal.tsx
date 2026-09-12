import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { HeartHandshake, Check, Share2, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export const PostChatModal: React.FC = () => {
  const { postChatPartner, friendshipNotice, submitFriendshipChoice, clearPostChat } = useAuth();
  const [choiceMade, setChoiceMade] = useState<boolean | null>(null);

  if (!postChatPartner) return null;

  const handleChoice = (yes: boolean) => {
    setChoiceMade(yes);
    submitFriendshipChoice(
      postChatPartner.partnerId,
      yes,
      postChatPartner.roomId,
      postChatPartner.sessionSignature
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2723]/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
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

        {friendshipNotice ? (
          /* MUTUAL FRIENDSHIP FORMED */
          <div className="space-y-4 text-center py-2" id="post-chat-mutual-connected">
            <div className="p-4 bg-[#EBF3ED] border border-[#C3D9C8] rounded-2xl text-[#2F5938] space-y-2">
              <p className="font-medium text-sm flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4 text-[#2F5938]" />
                Mutual connection formed!
              </p>
              <p className="text-xs text-[#2F5938]/90 leading-relaxed">
                Both you and {postChatPartner.partnerDisplayName} expressed a desire to stay in touch.
              </p>
            </div>

            <div className="p-4 bg-[#F5F2EB] border border-[#E7E0D8] rounded-2xl text-xs text-[#5C534D] space-y-2 text-left">
              <p className="font-medium text-[#2D2723] flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-[#C86D51]" />
                Continuing your friendship:
              </p>
              <p>
                You can now message each other anytime through your private <strong>Friends</strong> list.
              </p>
              <p>
                Someone does not trap friendships inside the platform. If you both wish, you are completely free to voluntarily exchange personal contact details (email, phone, etc.) and continue your friendship elsewhere.
              </p>
            </div>

            <button
              id="post-chat-close-mutual-btn"
              onClick={clearPostChat}
              className="w-full py-3.5 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] font-medium text-sm rounded-full transition-all cursor-pointer shadow-2xs"
            >
              Done
            </button>
          </div>
        ) : choiceMade !== null ? (
          /* CHOICE RECORDED WAITING FOR OR SENSITIVE TO MUTUALITY */
          <div className="space-y-4 text-center py-4" id="post-chat-recorded">
            <p className="text-sm font-medium text-[#2D2723]">
              Thank you. Your response has been recorded privately.
            </p>
            <p className="text-xs text-[#78716C] max-w-xs mx-auto leading-relaxed">
              Friendships are created only when both participants independently choose to reconnect. Unilateral requests are never disclosed.
            </p>
            <button
              id="post-chat-return-home-btn"
              onClick={clearPostChat}
              className="w-full py-3.5 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] text-sm font-medium rounded-full transition-all cursor-pointer shadow-2xs mt-2"
            >
              Return to home
            </button>
          </div>
        ) : (
          /* THE MUTUAL CONSENT QUESTION */
          <div className="space-y-6 pt-1 text-center">
            <div className="space-y-2">
              <p
                id="post-chat-question"
                className="font-serif text-lg text-[#2D2723]"
              >
                Would you like to talk to this person again?
              </p>
              <p className="text-xs text-[#78716C] max-w-xs mx-auto leading-relaxed">
                With <strong>{postChatPartner.partnerDisplayName}</strong>. If both of you say yes, you will be connected as mutual friends.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                id="post-chat-yes-btn"
                onClick={() => handleChoice(true)}
                className="w-full sm:w-1/2 py-3.5 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] font-medium text-sm rounded-full transition-all cursor-pointer shadow-2xs"
              >
                Yes, I would
              </button>
              <button
                id="post-chat-no-btn"
                onClick={() => handleChoice(false)}
                className="w-full sm:w-1/2 py-3.5 bg-[#F5F2EB] hover:bg-[#EDE6DC] border border-[#E7E0D8] text-[#5C534D] hover:text-[#2D2723] font-medium text-sm rounded-full transition-all cursor-pointer shadow-2xs"
              >
                No, not this time
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
