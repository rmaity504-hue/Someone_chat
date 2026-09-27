import React from 'react';
import { ShieldCheck, ArrowLeft, Lock, EyeOff, Trash2, HeartHandshake, ServerOff } from 'lucide-react';

interface PrivacyPolicyViewProps {
  onBackToHome?: () => void;
}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ onBackToHome }) => {
  const handleReturnHome = () => {
    if (onBackToHome) {
      onBackToHome();
    } else {
      window.history.pushState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div
      id="privacy-policy-view"
      className="min-h-[100dvh] w-full bg-[#F6F3EE] text-[#2D2723] flex flex-col font-sans selection:bg-[#C86D51]/20 selection:text-[#2D2723]"
    >
      {/* Top Header */}
      <header className="sticky top-0 z-30 w-full bg-[#F6F3EE]/95 backdrop-blur-md border-b border-[#E7E0D8]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <button
            id="privacy-back-btn"
            type="button"
            onClick={handleReturnHome}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-[#5C534D] hover:text-[#2D2723] bg-[#EFE9DF] hover:bg-[#E4DDD1] transition-colors cursor-pointer border border-[#E7E0D8]"
            aria-label="Return to Quiet Corner"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Someone</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-[#78716C]">
            <ShieldCheck className="w-4 h-4 text-[#2F5938]" />
            <span className="font-mono text-[11px]">Zero-Retention Architecture</span>
          </div>
        </div>
      </header>

      {/* Main Document Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Title Section */}
        <section className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF0EB] text-[#C86D51] text-xs font-medium border border-[#E8C7BC]">
            <Lock className="w-3.5 h-3.5" />
            <span>Privacy & Ephemeral Storage Policy</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#2D2723] tracking-tight">
            Privacy Built by Absence
          </h1>
          <p className="text-[#78716C] text-sm sm:text-base leading-relaxed">
            Someone was created with a fundamental engineering axiom: <em>the safest data is the data that does not exist.</em> We never record, persist, archive, or monetize your private conversations.
          </p>
        </section>

        {/* Core Pillars */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <article className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E7E0D8] space-y-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-[#FAF0EB] flex items-center justify-center text-[#C86D51]">
              <ServerOff className="w-4 h-4" />
            </div>
            <h2 className="font-serif text-base font-medium text-[#2D2723]">
              Zero-Retention Chat Stream
            </h2>
            <p className="text-xs text-[#5C534D] leading-relaxed">
              Messages exist solely in transient memory buffers while both participants are connected. The moment a session concludes, all messages and session tokens are purged.
            </p>
          </article>

          <article className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E7E0D8] space-y-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-[#FAF0EB] flex items-center justify-center text-[#C86D51]">
              <EyeOff className="w-4 h-4" />
            </div>
            <h2 className="font-serif text-base font-medium text-[#2D2723]">
              No Tracker & No Ad SDKs
            </h2>
            <p className="text-xs text-[#5C534D] leading-relaxed">
              We run zero third-party behavioral trackers, marketing analytics pixels, or advertisement networks. Your digital presence belongs strictly to you.
            </p>
          </article>

          <article className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E7E0D8] space-y-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-[#FAF0EB] flex items-center justify-center text-[#C86D51]">
              <Lock className="w-4 h-4" />
            </div>
            <h2 className="font-serif text-base font-medium text-[#2D2723]">
              Client-Side State Scrubbing
            </h2>
            <p className="text-xs text-[#5C534D] leading-relaxed">
              When a conversation ends, your client device completely overwrites input text, zeroes active arrays, cleans session storage, and invokes garbage collection routines.
            </p>
          </article>

          <article className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E7E0D8] space-y-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-[#FAF0EB] flex items-center justify-center text-[#C86D51]">
              <Trash2 className="w-4 h-4" />
            </div>
            <h2 className="font-serif text-base font-medium text-[#2D2723]">
              1-Tap Account Deletion
            </h2>
            <p className="text-xs text-[#5C534D] leading-relaxed">
              You maintain total control. At any time, delete your profile and credentials with immediate cascade removal across all authentication records.
            </p>
          </article>
        </section>

        {/* Detailed Sections */}
        <section className="space-y-6 pt-2 text-xs sm:text-sm text-[#5C534D] leading-relaxed">
          <div className="space-y-2">
            <h3 className="font-serif text-lg font-medium text-[#2D2723]">
              1. Information We Collect (and What We Avoid)
            </h3>
            <p>
              We do not ask for your real name, phone number, address, or social media profiles. Creating an account requires only a chosen display pseudonym and password. If you opt into email verification, your email is used solely for account recovery and verification links.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-serif text-lg font-medium text-[#2D2723]">
              2. Privacy Shield & On-Device Filtering
            </h3>
            <p>
              To protect users from accidental disclosure, Someone includes an on-device Privacy Filter that actively checks outgoing messages for phone numbers, email addresses, and external social URLs, giving you the choice to edit before sending.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-serif text-lg font-medium text-[#2D2723]">
              3. Crisis Intervention & Safety Helplines
            </h3>
            <p>
              If our safety interceptor detects crisis language indicative of self-harm, messaging is paused locally and verified helpline contact points (Tele-MANAS 14416, KIRAN 1800-599-0019, 988 Lifeline) are immediately surfaced for supportive care.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-serif text-lg font-medium text-[#2D2723]">
              4. Mutual Consensual Connection
            </h3>
            <p>
              Conversations conclude cleanly when either person steps away. Mutual friendship or contact exchange only occurs if both participants explicitly and independently tap &quot;Keep Connection&quot; at the conclusion of a session.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-serif text-lg font-medium text-[#2D2723]">
              5. Statutory Legal Compliance & Zero-Tolerance Abuse Protocol
            </h3>
            <p>
              The platform does not log chat history. In cases of severe violations, automated filters sever connections immediately. The platform complies with lawful requests and statutory obligations under applicable information technology laws.
            </p>
          </div>
        </section>

        {/* Bottom Call to Action */}
        <section className="pt-6 border-t border-[#E7E0D8] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#8C827A]">
            Last updated: September 2026 • Standalone verified route
          </p>
          <button
            type="button"
            id="privacy-bottom-return-btn"
            onClick={handleReturnHome}
            className="w-full sm:w-auto px-6 py-2.5 bg-[#2D2723] hover:bg-[#433B35] text-[#FAF8F5] text-xs font-medium rounded-full transition-colors cursor-pointer"
          >
            Return to Quiet Corner
          </button>
        </section>
      </main>
    </div>
  );
};

export default PrivacyPolicyView;
