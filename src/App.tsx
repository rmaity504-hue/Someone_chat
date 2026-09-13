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
import { AlertOctagon, AlertCircle, X } from 'lucide-react';

function MainApp() {
  const {
    user,
    activeSession,
    matchingState,
    enterMatching,
    systemNotification,
    clearNotification,
  } = useAuth();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  const [friendsModalOpen, setFriendsModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [appealModalOpen, setAppealModalOpen] = useState(false);
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);

  const handleFindSomeone = () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (!user.safetyAcknowledged) {
      setSafetyModalOpen(true);
      return;
    }
    enterMatching();
  };

  const isRestrictedOrSuspended =
    user && (user.status === 'restricted' || user.status === 'suspended' || user.status === 'banned');

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2D2723] flex flex-col font-sans selection:bg-[#C86D51]/20 selection:text-[#2D2723]">
      {/* Navigation */}
      <Navbar
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenFriends={() => setFriendsModalOpen(true)}
        onOpenAdmin={() => setAdminModalOpen(true)}
        onOpenSafety={() => setSafetyModalOpen(true)}
        onOpenDeleteAccount={() => setDeleteAccountModalOpen(true)}
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
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {activeSession ? (
          <ChatView />
        ) : matchingState.state !== 'idle' ? (
          <MatchingView onCancel={() => {}} />
        ) : (
          <HomeView
            onFindSomeone={handleFindSomeone}
            onOpenAuth={() => setAuthModalOpen(true)}
            onOpenSafety={() => setSafetyModalOpen(true)}
          />
        )}
      </main>

      {/* Footer minimal philosophy reassurance */}
      <footer className="w-full py-6 text-center text-xs text-[#8C827A] border-t border-[#E7E0D8]/60">
        <p>Someone • A quiet corner for genuine human conversation.</p>
      </footer>

      {/* Persistent & Interactive Overlays */}
      <VolunteerPromptBanner />
      <PostChatModal />

      <SafetyNoticeModal
        isOpen={safetyModalOpen}
        onClose={() => setSafetyModalOpen(false)}
        onProceedToMatch={() => enterMatching()}
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
        <MainApp />
      </AuthProvider>
    </SocketProvider>
  );
}
