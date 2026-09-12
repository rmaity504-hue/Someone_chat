import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, ShieldCheck, HeartHandshake, Check, Info } from 'lucide-react';

export const VolunteerPromptBanner: React.FC = () => {
  const { user, pendingVolunteerRequest, respondToVolunteer, toggleVolunteer } = useAuth();
  const [isToggling, setIsToggling] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // STRICT SERVER-AUTHORIZED GATE:
  // Only users who have been approved by the platform as verified volunteer listeners
  // can view or interact with volunteer listener mechanics.
  if (!user || !user.isVolunteer) {
    return null;
  }

  const handleToggle = async () => {
    setIsToggling(true);
    await toggleVolunteer(!user.volunteerActive);
    setIsToggling(false);
  };

  return (
    <>
      {/* 1. HIGH-PRIORITY INCOMING REQUEST: Someone waiting beyond threshold */}
      <AnimatePresence>
        {pendingVolunteerRequest && (
          <div className="fixed bottom-6 right-6 left-6 sm:left-auto sm:max-w-md z-40">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="p-5 sm:p-6 bg-[#2D2723] text-[#FAF8F5] rounded-3xl shadow-[0_16px_40px_rgba(0,0,0,0.3)] border border-[#423934] space-y-4"
              id="volunteer-request-banner"
            >
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-[#423934] rounded-2xl text-[#E8C7BC] mt-0.5 shrink-0">
                  <Radio className="w-5 h-5 animate-pulse text-[#C86D51]" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-serif font-medium text-base text-[#FAF8F5]">
                    Someone is waiting to talk.
                  </h3>
                  <p className="text-xs text-[#D5CBC2] leading-relaxed">
                    No normal match was found after 45 seconds. Would you like to connect as a listener?
                  </p>
                  <p className="text-[11px] text-[#A89C92] pt-1 leading-snug">
                    Volunteer sessions follow the exact same ephemeral privacy rules, post-chat options, and reporting capabilities as standard matches.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#423934]">
                <button
                  id="volunteer-decline-btn"
                  onClick={() => respondToVolunteer(pendingVolunteerRequest.offerId, 'not_now')}
                  className="px-4 py-2 text-xs font-medium text-[#C2B7AE] hover:text-[#FAF8F5] rounded-full transition-colors cursor-pointer"
                >
                  Not now
                </button>
                <button
                  id="volunteer-connect-btn"
                  onClick={() => respondToVolunteer(pendingVolunteerRequest.offerId, 'connect')}
                  className="px-5 py-2 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] text-xs font-medium rounded-full transition-all shadow-xs cursor-pointer"
                >
                  Connect
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. CALM LISTENER AVAILABILITY STATUS (For approved volunteer listeners only) */}
      {!pendingVolunteerRequest && (
        <aside
          aria-label="Volunteer listener availability controls"
          className="fixed bottom-4 left-4 z-30 hidden sm:block max-w-xs"
          id="volunteer-status-card"
        >
          <div className="p-3.5 bg-[#FAF8F5]/95 backdrop-blur-sm border border-[#E7E0D8] rounded-2xl shadow-xs text-[#2D2723] space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-medium text-[#2D2723]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2F5938]" />
                <span>Approved Listener</span>
              </div>
              <button
                onClick={() => setShowInfo(!showInfo)}
                className="text-[#8C827A] hover:text-[#2D2723] p-0.5 cursor-pointer"
                title="About volunteer listening"
                id="volunteer-info-toggle-btn"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 pt-0.5">
              <span className="text-[11px] text-[#78716C]">
                {user.volunteerActive ? 'Active (available for queue fallback)' : 'Paused'}
              </span>
              <button
                id="volunteer-opt-in-toggle-btn"
                onClick={handleToggle}
                disabled={isToggling}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  user.volunteerActive
                    ? 'bg-[#EBF3ED] text-[#2F5938] border border-[#C3D9C8] hover:bg-[#DDECE0]'
                    : 'bg-[#F5F2EB] text-[#5C534D] border border-[#E7E0D8] hover:bg-[#EDE6DC]'
                }`}
              >
                {isToggling ? 'Updating...' : user.volunteerActive ? 'Active' : 'Turn on'}
              </button>
            </div>

            {showInfo && (
              <div className="pt-2 border-t border-[#E7E0D8] text-[11px] text-[#78716C] space-y-1">
                <p>
                  As an approved listener, you only receive prompts when someone has waited in queue beyond 45 seconds without finding another participant.
                </p>
                <p>
                  All conversations are strictly confidential and 100% ephemeral. Mutual post-chat options apply equally.
                </p>
              </div>
            )}
          </div>
        </aside>
      )}
    </>
  );
};
