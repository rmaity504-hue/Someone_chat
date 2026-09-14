import React, { useState } from 'react';
import { SocketProvider } from './context/SocketContext.js';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { HomeView } from './components/HomeView.js';
import { MatchingView } from './components/MatchingView.js';
import { ChatView } from './components/ChatView.js';
import { VolunteerPromptBanner } from './components/VolunteerPromptBanner.js';
import { PostChatModal } from './components/PostChatModal.js';
import { SafetyNoticeModal } from './components/SafetyNoticeModal.js';
import { AuthModal } from './components/AuthModal.js';
import { FriendsModal } from './components/FriendsModal.js';
import { AdminDashboard } from './components/AdminDashboard.js';
import { AppealModal } from './components/AppealModal.js';
import { DeleteAccountModal } from './components/DeleteAccountModal.js';
import { AccountSecurityModal } from './components/AccountSecurityModal.js';
import { AboutPhilosophyModal } from './components/AboutPhilosophyModal.js';
import { ContactAdminModal } from './components/ContactAdminModal.js';
import { InstallGuideModal } from './components/InstallGuideModal.js';
import { SessionClosureCard } from './components/SessionClosureCard.js';
import { InstallProvider, useInstall } from './context/InstallContext.js';
import { AlertOctagon, AlertCircle, X, MessageSquare, Info } from 'lucide-react';

function MainApp() {
  const {
    user,
    activeSession,
    matchingState,
    enterMatching,
    systemNotification,
    clearNotification,
    sessionClosureActive,
    dismissSessionClosure,
  } = useAuth();
  const { isInstallModalOpen, setIsInstallModalOpen, toastMessage } = useInstall();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  const [friendsModalOpen, setFriendsModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [appealModalOpen, setAppealModalOpen] = useState(false);
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [aboutInitialTab, setAboutInitialTab] = useState<'philosophy' | 'retention' | 'safety'>('philosophy');
  const [contactAdminOpen, setContactAdminOpen] = useState(false);
  const [pendingTopics, setPendingTopics] = useState<string[]>([]);

  const handleFindSomeone = (topics?: string[]) => {
    const activeTopics = topics || [];
    setPendingTopics(activeTopics);
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (!user.safetyAcknowledged) {
      setSafetyModalOpen(true);
      return;
    }
    enterMatching(activeTopics);
  };

  const isRestrictedOrSuspended =
    user && (user.status === 'restricted' || user.status === 'suspended' || user.status === 'banned');

  return (
    <div className="min-h-screen text-[#2D2723] flex flex-col font-sans selection:bg-[#C86D51]/20 selection:text-[#2D2723]">
      {/* Navigation */}
      <Navbar
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenFriends={() => setFriendsModalOpen(true)}
        onOpenAdmin={() => setAdminModalOpen(true)}
        onOpenSafety={() => setSafetyModalOpen(true)}
        onOpenDeleteAccount={() => setDeleteAccountModalOpen(true)}
        onOpenSecurity={() => setSecurityModalOpen(true)}
        onOpenAbout={(tab) => {
          setAboutInitialTab(tab || 'philosophy');
          setAboutModalOpen(true);
        }}
        onOpenContactAdmin={() => setContactAdminOpen(true)}
        onChatNow={() => handleFindSomeone()}
      />

      {/* Account Enforcement Banner if Restricted/Suspended */}
      {isRestrictedOrSuspended && (
        <div className="bg-[#FAF0E6] border-b border-[#E7D7C5] py-3 px-4 text-xs text-[#7A3E26] flex items-center justify-between">
          <div className="max-w-4xl mx-auto flex items-center gap-2 w-full justify-between">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-[#C86D51] shrink-0" />
              <span>
                <strong>Account notice:</strong> Your account is currently {user.status}.{' '}
                {user.restrictionReason && `(${user.restrictionReason})`}
              </span>
            </div>
            <button
              onClick={() => setAppealModalOpen(true)}
              className="underline font-medium text-[#7A3E26] hover:text-[#2D2723] ml-4 shrink-0"
            >
              Submit an appeal
            </button>
          </div>
        </div>
      )}

      {/* Primary Content View */}
      <main className={`flex-1 flex flex-col items-center justify-center ${activeSession ? 'p-0 sm:p-4 w-full' : 'p-4'}`}>
        {activeSession ? (
          <ChatView />
        ) : matchingState.state !== 'idle' ? (
          <MatchingView onCancel={() => {}} topics={pendingTopics} />
        ) : (
          <HomeView
            onFindSomeone={handleFindSomeone}
            onOpenAuth={() => setAuthModalOpen(true)}
            onOpenSafety={() => setSafetyModalOpen(true)}
          />
        )}
      </main>

      {/* Footer minimal philosophy reassurance & links (hidden during active chat for clean mobile viewport) */}
      {!activeSession && (
        <footer className="w-full py-6 px-4 text-center text-xs text-[#8C827A] border-t border-[#E7E0D8]/60 bg-[#F6F3EE]/75 backdrop-blur-xs">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <p>Someone • A quiet corner for genuine human conversation.</p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
              <button
                id="footer-philosophy-btn"
                onClick={() => {
                  setAboutInitialTab('philosophy');
                  setAboutModalOpen(true);
                }}
                className="hover:text-[#2D2723] underline underline-offset-4 decoration-[#E7E0D8] transition-colors cursor-pointer"
              >
                Our Philosophy & Architecture
              </button>
              <button
                id="footer-retention-btn"
                onClick={() => {
                  setAboutInitialTab('retention');
                  setAboutModalOpen(true);
                }}
                className="hover:text-[#2D2723] underline underline-offset-4 decoration-[#E7E0D8] transition-colors cursor-pointer"
              >
                Zero-Retention Policy
              </button>
              <button
                id="footer-contact-admin-btn"
                onClick={() => setContactAdminOpen(true)}
                className="hover:text-[#2D2723] underline underline-offset-4 decoration-[#E7E0D8] transition-colors cursor-pointer flex items-center gap-1"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#8C827A]" />
                <span>Contact Admin</span>
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Persistent & Interactive Overlays */}
      <VolunteerPromptBanner />
      <PostChatModal onOpenSavedConnections={() => setFriendsModalOpen(true)} />

      <SafetyNoticeModal
        isOpen={safetyModalOpen}
        onClose={() => setSafetyModalOpen(false)}
        onProceedToMatch={() => enterMatching(pendingTopics)}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      <FriendsModal
        isOpen={friendsModalOpen}
        onClose={() => setFriendsModalOpen(false)}
      />

      <AdminDashboard
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
      />

      <AppealModal
        isOpen={appealModalOpen}
        onClose={() => setAppealModalOpen(false)}
      />

      <DeleteAccountModal
        isOpen={deleteAccountModalOpen}
        onClose={() => setDeleteAccountModalOpen(false)}
      />

      <AccountSecurityModal
        isOpen={securityModalOpen}
        onClose={() => setSecurityModalOpen(false)}
      />

      <AboutPhilosophyModal
        isOpen={aboutModalOpen}
        onClose={() => setAboutModalOpen(false)}
        initialTab={aboutInitialTab}
      />

      <ContactAdminModal
        isOpen={contactAdminOpen}
        onClose={() => setContactAdminOpen(false)}
      />

      <InstallGuideModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      {/* Ephemeral Session Closure Ritual Modal */}
      <SessionClosureCard
        isOpen={sessionClosureActive}
        onFindAnother={() => {
          dismissSessionClosure();
          handleFindSomeone(pendingTopics);
        }}
        onReturnHome={() => dismissSessionClosure()}
      />

      {/* PWA / Standalone Toast Notification */}
      {toastMessage && (
        <aside
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-full bg-[#2D2723] text-[#FAF8F5] text-xs font-medium shadow-xl flex items-center gap-2 border border-[#453D37] animate-fade-in"
        >
          <Info className="w-4 h-4 text-[#E8C7BC] shrink-0" />
          <span>{toastMessage}</span>
        </aside>
      )}

      {/* Diagnostic & Connection Notification Toast */}
      {systemNotification && (
        <aside
          role="alert"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-[#2D2723] text-[#FAF8F5] rounded-2xl p-4 shadow-xl border border-[#443C36] flex items-start justify-between gap-3 animate-fade-in"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-[#E89578] shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-[#E7E0D8] leading-relaxed">
              {systemNotification}
            </p>
          </div>
          <button
            onClick={clearNotification}
            className="text-[#A89F97] hover:text-[#FAF8F5] p-1 rounded-full transition-colors cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </aside>
      )}
    </div>
  );
}

export default function App() {
  return (
    <SocketProvider>
      <AuthProvider>
        <InstallProvider>
          <MainApp />
        </InstallProvider>
      </AuthProvider>
    </SocketProvider>
  );
}
