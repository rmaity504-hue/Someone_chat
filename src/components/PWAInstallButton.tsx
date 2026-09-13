import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone, Share, MoreVertical, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePWAInstall } from '../utils/usePWAInstall.js';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'navbar' | 'menu';
  onAction?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'navbar',
  onAction,
}) => {
  const { deferredPrompt, isInstalled } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleClick = async () => {
    onAction?.();

    // Check standalone mode / already running as installed app
    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://'));

    if (isStandalone || isInstalled) {
      triggerToast('You are already using the installed app.');
      return;
    }

    // Case A: Native browser beforeinstallprompt is ready
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          triggerToast('Someone app installed successfully!');
        }
      } catch (err) {
        console.error('Install prompt error:', err);
        setShowModal(true);
      }
      return;
    }

    // Case B: Fallback / iOS Safari / iframe / preview mode -> Guaranteed modal dialog
    setShowModal(true);
  };

  const modalAndToast = mounted
    ? createPortal(
        <>
          {/* Install Instructions Modal Dialog */}
          <AnimatePresence>
            {showModal && (
              <div
                className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#2D2723]/40 backdrop-blur-xs"
                role="dialog"
                aria-modal="true"
                aria-labelledby="pwa-install-title"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 10 }}
                  transition={{ duration: 0.18 }}
                  className="bg-[#FAF8F5] border border-[#E7E0D8] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-[0_12px_40px_rgba(45,39,35,0.15)] space-y-5 text-[#2D2723]"
                  id="pwa-install-modal"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#E7E0D8]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-[#FAF0EB] text-[#C86D51] flex items-center justify-center border border-[#E8C7BC] shrink-0">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div>
                        <h3
                          id="pwa-install-title"
                          className="font-serif font-medium text-lg text-[#2D2723] leading-tight"
                        >
                          Install Someone on Your Device
                        </h3>
                        <p className="text-[11px] text-[#8C827A]">
                          Quick access with an app icon on your home screen
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowModal(false)}
                      className="p-1.5 text-[#8C827A] hover:text-[#2D2723] rounded-full transition-colors cursor-pointer"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Instructions */}
                  <div className="space-y-3">
                    {/* Android (Chrome) */}
                    <div className="p-3.5 bg-[#F5F2EB] border border-[#E7E0D8] rounded-2xl space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-medium text-[#2D2723]">
                        <MoreVertical className="w-3.5 h-3.5 text-[#C86D51]" />
                        <span>For Android (Chrome):</span>
                      </div>
                      <p className="text-xs text-[#5C534D] leading-relaxed pl-5">
                        Tap the 3 dots (⋮) in your browser address bar and select &apos;Install app&apos; or &apos;Add to Home screen&apos;.
                      </p>
                    </div>

                    {/* iPhone (Safari) */}
                    <div className="p-3.5 bg-[#F5F2EB] border border-[#E7E0D8] rounded-2xl space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-medium text-[#2D2723]">
                        <Share className="w-3.5 h-3.5 text-[#C86D51]" />
                        <span>For iPhone (Safari):</span>
                      </div>
                      <p className="text-xs text-[#5C534D] leading-relaxed pl-5">
                        Tap the Share icon at the bottom of the screen, scroll down, and tap &apos;Add to Home Screen&apos;.
                      </p>
                    </div>
                  </div>

                  {/* Clean dismiss / got it button */}
                  <div className="pt-1 flex gap-2">
                    <button
                      id="pwa-modal-got-it-btn"
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="w-full py-2.5 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] font-medium text-xs rounded-full transition-all cursor-pointer shadow-2xs text-center"
                    >
                      Got it
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Standalone / Already Installed Toast Notification */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                transition={{ duration: 0.18 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-full bg-[#2D2723] text-[#FAF8F5] text-xs font-medium shadow-xl flex items-center gap-2 border border-[#453D37]"
                role="status"
              >
                <Info className="w-4 h-4 text-[#E8C7BC] shrink-0" />
                <span>{toastMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </>,
        document.body
      )
    : null;

  if (variant === 'menu') {
    return (
      <>
        <button
          id="pwa-install-mobile-btn"
          type="button"
          onClick={handleClick}
          className={`w-full text-left px-3 py-2 rounded-xl text-xs text-[#5C534D] hover:text-[#2D2723] hover:bg-[#F2ECE4] flex items-center gap-2.5 transition-colors cursor-pointer ${className}`}
        >
          <Smartphone className="w-4 h-4 text-[#8C827A]" />
          <span>Install App</span>
        </button>

        {modalAndToast}
      </>
    );
  }

  // Desktop / Header bar button
  return (
    <>
      <button
        id="pwa-install-desktop-btn"
        type="button"
        onClick={handleClick}
        className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#F5F2EB] hover:bg-[#EDE6DC] text-[#5C534D] hover:text-[#2D2723] border border-[#E7E0D8] transition-all cursor-pointer shadow-2xs ${className}`}
        title="Install Someone on your device"
      >
        <Smartphone className="w-3.5 h-3.5 text-[#8C827A]" />
        <span>Install App</span>
      </button>

      {modalAndToast}
    </>
  );
};
