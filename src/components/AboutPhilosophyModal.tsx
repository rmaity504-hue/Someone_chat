import React, { useState, useEffect } from 'react';
import {
  X,
  Compass,
  Cpu,
  ShieldCheck,
  Zap,
  Lock,
  EyeOff,
  Sparkles,
  Layers,
  Check,
} from 'lucide-react';

interface AboutPhilosophyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'philosophy' | 'retention' | 'safety';
}

export const AboutPhilosophyModal: React.FC<AboutPhilosophyModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'philosophy',
}) => {
  const [activeTab, setActiveTab] = useState<'philosophy' | 'retention' | 'safety'>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2723]/60 backdrop-blur-sm spring-overlay-enter"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#FAF8F5] rounded-3xl border border-[#E7E0D8] shadow-2xl p-6 sm:p-8 flex flex-col max-h-[90vh] overflow-hidden spring-modal-enter"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E7E0D8] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#FAF0E6] flex items-center justify-center text-[#C86D51]">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 id="about-modal-title" className="text-xl font-serif font-medium text-[#2D2723]">
                Our Philosophy & System Architecture
              </h2>
              <p className="text-xs text-[#8C827A]">
                The principles and engineering behind Someone
              </p>
            </div>
          </div>
          <button
            id="about-modal-close-btn"
            onClick={onClose}
            aria-label="Close philosophy modal"
            className="text-[#8C827A] hover:text-[#2D2723] p-1.5 rounded-full hover:bg-[#F2ECE4] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 pt-4 pb-2 border-b border-[#E7E0D8]/60 shrink-0 overflow-x-auto">
          <button
            id="about-tab-philosophy-btn"
            onClick={() => setActiveTab('philosophy')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'philosophy'
                ? 'bg-[#2D2723] text-[#FAF8F5] shadow-2xs'
                : 'text-[#78716C] hover:text-[#2D2723] hover:bg-[#F2ECE4]'
            }`}
          >
            Core Purpose & Philosophy
          </button>
          <button
            id="about-tab-retention-btn"
            onClick={() => setActiveTab('retention')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'retention'
                ? 'bg-[#2D2723] text-[#FAF8F5] shadow-2xs'
                : 'text-[#78716C] hover:text-[#2D2723] hover:bg-[#F2ECE4]'
            }`}
          >
            Zero-Retention Engine
          </button>
          <button
            id="about-tab-safety-btn"
            onClick={() => setActiveTab('safety')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'safety'
                ? 'bg-[#2D2723] text-[#FAF8F5] shadow-2xs'
                : 'text-[#78716C] hover:text-[#2D2723] hover:bg-[#F2ECE4]'
            }`}
          >
            Safety & Moderation
          </button>
        </div>

        {/* Body Content */}
        <div className="overflow-y-auto py-5 space-y-5 text-[#3D352E] text-sm leading-relaxed pr-1">
          {activeTab === 'philosophy' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-[#FAF0E6] p-4 rounded-2xl border border-[#E7D7C5]">
                <h3 className="text-base font-serif font-medium text-[#2D2723] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#C86D51]" />
                  Liberation From Identity Performance
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-[#7A3E26] leading-relaxed">
                  Modern social networks are engines of social theater. Every comment, like, follower count, and photo is engineered to maximize dopamine, status anxiety, and algorithmic engagement.
                </p>
              </div>

              <div className="space-y-3 text-xs sm:text-sm">
                <p>
                  <strong>Someone</strong> was created as a peaceful antidote. There are no profiles to cultivate, no follower graphs to monetize, no image feeds, and no algorithmic feeds pushing rage or envy.
                </p>
                <p>
                  When you enter a room on Someone, you meet another human being without preconceptions. You are not evaluated by your credentials, appearance, follower tier, or demographic bucket. Two minds meet in real-time, sharing thoughts, vulnerabilities, perspectives, or quiet companionship.
                </p>
                <p>
                  By shedding the weight of identity performance, conversations become raw, unhurried, and genuinely restorative.
                </p>
              </div>

              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#E7E0D8]">
                  <h4 className="text-xs font-semibold text-[#2D2723] mb-1">No Algorithmic Feeds</h4>
                  <p className="text-[11px] text-[#78716C]">
                    We do not optimize for time-on-site or endless scrolling. When you're ready, talk; when you're finished, depart without algorithmic hooks.
                  </p>
                </div>
                <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#E7E0D8]">
                  <h4 className="text-xs font-semibold text-[#2D2723] mb-1">Mutual Friendship Consent</h4>
                  <p className="text-[11px] text-[#78716C]">
                    You can only reconnect if both participants independently choose "Yes" at the conclusion of a conversation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'retention' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-[#EBF3ED] p-4 rounded-2xl border border-[#C3D9C8]">
                <h3 className="text-base font-serif font-medium text-[#2F5938] flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#2F5938]" />
                  Ephemerality by Architectural Design
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-[#24462C] leading-relaxed">
                  Most platforms claim privacy while archiving every word you write into permanent database backups. We reject this paradigm at the infrastructural layer.
                </p>
              </div>

              <div className="space-y-3 text-xs sm:text-sm">
                <div className="flex items-start gap-3 p-3 bg-[#FAF8F5] rounded-2xl border border-[#E7E0D8]">
                  <Zap className="w-4 h-4 text-[#C86D51] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#2D2723]">Volatile RAM Only:</strong> Active chat messages exist strictly in volatile server process memory (RAM) to relay messages between paired WebSocket connections.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-[#FAF8F5] rounded-2xl border border-[#E7E0D8]">
                  <EyeOff className="w-4 h-4 text-[#C86D51] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#2D2723]">Instant Session Purge:</strong> The second either partner leaves or closes the room, all in-memory chat arrays are garbage-collected and permanently destroyed. No chat logs are ever written to disk, SQLite, PostgreSQL, or disk archives.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-[#FAF8F5] rounded-2xl border border-[#E7E0D8]">
                  <Lock className="w-4 h-4 text-[#C86D51] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#2D2723]">No Third-Party Analytics:</strong> No tracking pixels, marketing beacons, or external ad networks are permitted inside our codebase.
                  </div>
                </div>
              </div>

              <p className="text-xs text-[#78716C] italic">
                Because conversation transcripts do not exist on our servers, they cannot be leaked, subpoenaed, mined for advertising models, or accessed by future administrators.
              </p>
            </div>
          )}

          {activeTab === 'safety' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#E7E0D8]">
                <h3 className="text-base font-serif font-medium text-[#2D2723] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#C86D51]" />
                  Safety Without Surveillance
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-[#5C534D] leading-relaxed">
                  How do we maintain a safe, welcoming community without storing user transcripts? Through layered real-time filtering and explicit user accountability.
                </p>
              </div>

              <div className="space-y-3 text-xs sm:text-sm">
                <div className="p-3.5 bg-white/70 rounded-2xl border border-[#E7E0D8] space-y-1.5">
                  <div className="flex items-center gap-2 font-medium text-[#2D2723]">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Real-Time Automated Shielding</span>
                  </div>
                  <p className="text-xs text-[#78716C] pl-6">
                    Inbound messages pass through an inline pattern engine that inspects for severe predatory behavior, solicitations, hate speech, and spam before routing. Violations trigger immediate room disconnection and protective rate-limiting.
                  </p>
                </div>

                <div className="p-3.5 bg-white/70 rounded-2xl border border-[#E7E0D8] space-y-1.5">
                  <div className="flex items-center gap-2 font-medium text-[#2D2723]">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Post-Session User Reporting</span>
                  </div>
                  <p className="text-xs text-[#78716C] pl-6">
                    If someone behaves inappropriately, you can report them directly when leaving. A temporary cryptographic token binds the report to the offending user's account without exposing private identities.
                  </p>
                </div>

                <div className="p-3.5 bg-white/70 rounded-2xl border border-[#E7E0D8] space-y-1.5">
                  <div className="flex items-center gap-2 font-medium text-[#2D2723]">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Hardware & Network Ban Enforcement</span>
                  </div>
                  <p className="text-xs text-[#78716C] pl-6">
                    Repeat offenders are permanently barred via IP hashes, session invalidation, and account suspensions, protecting our community while preserving the privacy of good-faith members.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#E7E0D8] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#8C827A]">
            Zero data brokerage • Independent software
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[#2D2723] hover:bg-[#443C36] text-[#FAF8F5] text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
