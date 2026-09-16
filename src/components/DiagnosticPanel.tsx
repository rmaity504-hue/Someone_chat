import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  Wrench,
  X,
  AlertTriangle,
  UserCheck,
  UserX,
  ShieldAlert,
  Smartphone,
  CheckCircle2,
  Lock,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { ReportModal } from './ReportModal.js';
import { CrisisSupportModal } from './CrisisSupportModal.js';

interface DiagnosticPanelProps {
  onOpenPrivacy?: () => void;
}

export const DiagnosticPanel: React.FC<DiagnosticPanelProps> = ({ onOpenPrivacy }) => {
  const {
    activeSession,
    simulateMockSession,
    simulatePartnerExit,
    systemNotification,
  } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [hapticFeedback, setHapticFeedback] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [crisisModalOpen, setCrisisModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Auto-open if ?debug=true or #debug is in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      if (search.get('debug') === 'true' || window.location.hash === '#debug') {
        setIsOpen(true);
      }
    }
  }, []);

  // Quick feedback notification banner
  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // 1. [ Simulate Crisis Keyword ]
  const handleSimulateCrisis = () => {
    navigator.vibrate?.(25);
    // If in chat, target the chat input and dispatch
    const chatInput = document.getElementById('chat-input') as HTMLInputElement | null;
    const chatForm = document.getElementById('chat-input-form') as HTMLFormElement | null;

    if (activeSession && chatInput && chatForm) {
      chatInput.value = 'I feel like ending my life';
      chatInput.dispatchEvent(new Event('input', { bubbles: true }));
      setTimeout(() => {
        chatForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }, 50);
      showStatus('Crisis keyword injected into active chat stream.');
    } else {
      // Direct modal invocation to verify Tele-MANAS/KIRAN resources immediately
      setCrisisModalOpen(true);
      showStatus('Crisis Support Modal triggered (Tele-MANAS 14416 / KIRAN 1800-599-0019).');
    }
  };

  // 2. [ Simulate Partner Connect ]
  const handleSimulatePartnerConnect = () => {
    simulateMockSession(['Mindfulness', 'Midnight thoughts']);
    showStatus('Connected to simulated partner "A Quiet Companion".');
  };

  // 3. [ Simulate Partner Exit ]
  const handleSimulatePartnerExit = () => {
    simulatePartnerExit();
    showStatus('Simulated partner exit dispatched -> Session Closure ritual active.');
  };

  // 4. [ Simulate Report & Block ]
  const handleSimulateReport = () => {
    navigator.vibrate?.(15);
    setReportModalOpen(true);
    showStatus('Report confirmation sheet opened.');
  };

  // 5. [ Test Micro-Haptic ]
  const handleTestHaptic = () => {
    const hasVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    if (hasVibrate) {
      const success = navigator.vibrate(15);
      setHapticFeedback(`Haptic 15ms pulse fired (API returned: ${String(success)})`);
    } else {
      setHapticFeedback('navigator.vibrate not supported on this platform');
    }
    setTimeout(() => setHapticFeedback(null), 3500);
  };

  // 6. [ Navigate to /privacy ]
  const handleGoToPrivacy = () => {
    if (onOpenPrivacy) {
      onOpenPrivacy();
    } else {
      window.history.pushState(null, '', '/privacy');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    setIsOpen(false);
  };

  return (
    <>
      {/* Discreet Trigger Button (Bottom-Left) */}
      <button
        id="diagnostic-panel-toggle-btn"
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Toggle Diagnostic Test Panel"
        title="Diagnostics & Functional Integrity Suite"
        className="fixed bottom-3 left-3 z-[60] flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#2D2723]/80 hover:bg-[#2D2723] text-[#FAF8F5] text-[11px] font-mono tracking-tight backdrop-blur-md shadow-md border border-[#443C36] cursor-pointer transition-opacity opacity-70 hover:opacity-100"
      >
        <Wrench className="w-3 h-3 text-[#E8C7BC]" />
        <span className="hidden sm:inline">Diagnostics</span>
      </button>

      {/* Diagnostics Slide-over Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="diagnostic-panel-title"
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-end sm:justify-center p-3 sm:p-4 bg-[#2D2723]/50 backdrop-blur-xs spring-overlay-enter"
          onClick={() => setIsOpen(false)}
        >
          <div
            id="diagnostic-panel-card"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#FAF8F5] border border-[#E7E0D8] rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl text-[#2D2723] spring-modal-enter max-h-[88vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0D8]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#FAF0EB] text-[#C86D51] flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="diagnostic-panel-title" className="text-sm font-semibold font-serif text-[#2D2723]">
                    Diagnostics & Audit Suite
                  </h3>
                  <p className="text-[11px] text-[#78716C]">
                    Interactive functional tests & viewport verification
                  </p>
                </div>
              </div>
              <button
                id="diagnostic-panel-close-btn"
                onClick={() => setIsOpen(false)}
                className="text-[#8C827A] hover:text-[#2D2723] p-1 rounded-full hover:bg-[#EFE9DF] transition-colors cursor-pointer"
                aria-label="Close diagnostics"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Feedback Banner */}
            {(statusMessage || hapticFeedback || systemNotification) && (
              <div className="p-2.5 rounded-xl bg-[#FAF0EB] border border-[#E8C7BC] text-xs text-[#8C4B37] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#C86D51]" />
                <span className="leading-tight">
                  {hapticFeedback || statusMessage || systemNotification}
                </span>
              </div>
            )}

            {/* Test Action Buttons */}
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#8C827A] block">
                Interactive State Simulations
              </span>

              {/* [ Simulate Crisis Keyword ] */}
              <button
                id="btn-diag-crisis-keyword"
                type="button"
                onClick={handleSimulateCrisis}
                className="w-full p-2.5 rounded-xl bg-[#FAF8F5] hover:bg-[#FAF0EB] border border-[#E7E0D8] hover:border-[#E8C7BC] text-left flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-[#C86D51] shrink-0" />
                  <div>
                    <span className="font-medium text-[#2D2723] block">
                      Simulate Crisis Keyword
                    </span>
                    <span className="text-[11px] text-[#78716C]">
                      Fires &quot;I feel like ending my life&quot; &rarr; Tele-MANAS/KIRAN
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FAF0EB] text-[#C86D51] group-hover:bg-[#E8C7BC]">
                  Test
                </span>
              </button>

              {/* [ Simulate Partner Connect ] */}
              <button
                id="btn-diag-partner-connect"
                type="button"
                onClick={handleSimulatePartnerConnect}
                className="w-full p-2.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F2ECE4] border border-[#E7E0D8] text-left flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <UserCheck className="w-4 h-4 text-[#2F5938] shrink-0" />
                  <div>
                    <span className="font-medium text-[#2D2723] block">
                      Simulate Partner Connect
                    </span>
                    <span className="text-[11px] text-[#78716C]">
                      Instantly mounts active chat room stream
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#EBF2EC] text-[#2F5938]">
                  Connect
                </span>
              </button>

              {/* [ Simulate Partner Exit ] */}
              <button
                id="btn-diag-partner-exit"
                type="button"
                onClick={handleSimulatePartnerExit}
                className="w-full p-2.5 rounded-xl bg-[#FAF8F5] hover:bg-[#FAF0EB] border border-[#E7E0D8] text-left flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <UserX className="w-4 h-4 text-[#A84332] shrink-0" />
                  <div>
                    <span className="font-medium text-[#2D2723] block">
                      Simulate Partner Exit
                    </span>
                    <span className="text-[11px] text-[#78716C]">
                      Triggers &quot;This moment has passed&quot; closure ritual
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FAF0EB] text-[#A84332]">
                  Exit
                </span>
              </button>

              {/* [ Simulate Report & Block ] */}
              <button
                id="btn-diag-report-block"
                type="button"
                onClick={handleSimulateReport}
                className="w-full p-2.5 rounded-xl bg-[#FAF8F5] hover:bg-[#FAF0EB] border border-[#E7E0D8] text-left flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-[#C86D51] shrink-0" />
                  <div>
                    <span className="font-medium text-[#2D2723] block">
                      Simulate Report & Block
                    </span>
                    <span className="text-[11px] text-[#78716C]">
                      Opens Report confirmation & block sheet
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FAF0EB] text-[#C86D51]">
                  Report
                </span>
              </button>

              {/* [ Test Micro-Haptic ] */}
              <button
                id="btn-diag-test-haptic"
                type="button"
                onClick={handleTestHaptic}
                className="w-full p-2.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F2ECE4] border border-[#E7E0D8] text-left flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-[#78716C] shrink-0" />
                  <div>
                    <span className="font-medium text-[#2D2723] block">
                      Test Micro-Haptic
                    </span>
                    <span className="text-[11px] text-[#78716C]">
                      Fires navigator.vibrate(15)
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#EFE9DF] text-[#5C534D]">
                  Pulse
                </span>
              </button>
            </div>

            {/* Route & Viewport Lockdown Verification */}
            <div className="pt-2 border-t border-[#E7E0D8] space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#8C827A] block">
                Routing & Environment Lockdown
              </span>

              <button
                id="btn-diag-goto-privacy"
                type="button"
                onClick={handleGoToPrivacy}
                className="w-full p-2.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F2ECE4] border border-[#E7E0D8] text-left flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#5C534D]" />
                  <span className="font-medium text-[#2D2723]">
                    Inspect /privacy Route (Standalone)
                  </span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[#8C827A]" />
              </button>

              <div className="p-3 rounded-xl bg-[#F6F3EE] border border-[#E7E0D8] text-[11px] font-mono text-[#5C534D] space-y-1">
                <div className="flex items-center justify-between">
                  <span>overscroll-behavior-y:</span>
                  <span className="text-[#2F5938] font-bold">none (locked)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>touch-action:</span>
                  <span className="text-[#2F5938] font-bold">manipulation</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>height metric:</span>
                  <span className="text-[#2F5938] font-bold">100dvh</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>tap-highlight:</span>
                  <span className="text-[#2F5938] font-bold">transparent</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Report Modal for Simulated Testing */}
      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        targetUserId="simulated-test-user-id"
        targetDisplayName="Simulated Test Partner"
        roomId={activeSession?.roomId || 'mock-debug-room'}
        evidenceSnippet="Diagnostic simulated evidence snippet."
      />

      {/* Embedded Crisis Support Modal for Simulated Testing */}
      <CrisisSupportModal
        isOpen={crisisModalOpen}
        onClose={() => setCrisisModalOpen(false)}
        onContinueChat={() => setCrisisModalOpen(false)}
        onClearAndClose={() => setCrisisModalOpen(false)}
      />
    </>
  );
};

export default DiagnosticPanel;
