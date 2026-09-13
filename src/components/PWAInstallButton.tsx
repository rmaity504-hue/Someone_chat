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
  const { isInstallable, isInstalled, install } = usePWAInstall();
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

    // Case B: Already installed / Standalone mode
    if (isInstalled) {
      triggerToast('Someone is already installed and running as an app.');
      return;
    }

    // Case A: Native prompt ready
    if (isInstallable) {
      try {
        const success = await install();
        if (success) {
          triggerToast('Someone app installed successfully!');
        }
      } catch {
        setShowModal(true);
      }
      return;
    }

    // Case C: Fallback / iOS Safari / in-app preview
    setShowModal(true);
  };

  const modalAndToast = mounted ? (
    createPortal(
      <>
        {/* Case C: Fallback Instructions Modal / Bottom Sheet */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#2D2723]/40 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="bg-[#FAF8F5] border border-[#E7E0D8] rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-[#2D2723]"
                id="pwa-fallback-modal"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-[#E7E0D8]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#FAF0EB] text-[#C86D51] flex items-center justify-center border border-[#E8C7BC]">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-serif font-medium text-lg text-[#2D2723]">Install Someone</h3>
                      <p className="text-[11px] text-[#8C827A]">Add to home screen for the full app experience</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-1 text-[#8C827A] hover:text-[#2D2723] rounded-full transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Instructions */}
                <div className="space-y-3">
                  {/* iOS / Safari */}
                  <div className="p-3.5 bg-[#F5F2EB] border border-[#E7E0D8] rounded-2xl space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#2D2723]">
                      <Share className="w-3.5 h-3.5 text-[#C86D51]" />
                      <span>For iOS / Safari:</span>
                    </div>
                    <p className="text-xs text-[#5C534D] leading-relaxed pl-5">
                      To install: Tap the Share button at the bottom of Safari, then tap &apos;Add to Home Screen&apos;.
                    </p>
                  </div>

                  {/* Android / Chrome */}
                  <div className="p-3.5 bg-[#F5F2EB] border border-[#E7E0D8] rounded-2xl space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#2D2723]">
                      <MoreVertical className="w-3.5 h-3.5 text-[#C86D51]" />
                      <span>For Android / Chrome:</span>
                    </div>
                    <p className="text-xs text-[#5C534D] leading-relaxed pl-5">
                      To install: Tap the 3-dot menu at top right of Chrome, then tap &apos;Install app&apos; or &apos;Add to Home screen&apos;.
                    </p>
                  </div>
                </div>

                {/* Got it button */}
                <button
                  id="pwa-modal-got-it-btn"
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full py-3 bg-[#C86D51] hover:bg-[#B65E43] text-[#FAF8F5] font-medium text-xs sm:text-sm rounded-full transition-all cursor-pointer shadow-2xs text-center"
                >
                  Got it
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Case B: Standalone Toast Notification */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              transition={{ duration: 0.18 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-full bg-[#2D2723] text-[#FAF8F5] text-xs font-medium shadow-xl flex items-center gap-2 border border-[#453D37]"
            >
              <Info className="w-4 h-4 text-[#E8C7BC] shrink-0" />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </>,
      document.body
    )
  ) : null;

  if (variant === 'menu') {
    return (
      <>
        <button
          id="pwa-install-mobile-btn"
          type="button"
          onClick={handleClick}
          className={`w-full text-left px-3 py-2 rounded-xl text-xs text-[#5C534D] hover:text-[#2D2723] hover:bg-[#F2ECE4] flex items-center justify-between transition-colors cursor-pointer ${className}`}
        >
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-4 h-4 text-[#C86D51]" />
            <span className="font-medium text-[#2D2723]">📱 Install App</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FAF0EB] text-[#C86D51] font-medium border border-[#E8C7BC]">
            PWA
          </span>
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
        title="Install as Progressive Web App"
      >
        <Smartphone className="w-3.5 h-3.5 text-[#C86D51]" />
        <span>📱 Install App</span>
      </button>

      {modalAndToast}
    </>
  );
};
