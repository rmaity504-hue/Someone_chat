import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface InstallContextType {
  isInstallModalOpen: boolean;
  setIsInstallModalOpen: (open: boolean) => void;
  toastMessage: string | null;
  setToastMessage: (msg: string | null) => void;
  isStandalone: boolean;
  isInstallable: boolean;
  handleInstallClick: (e: React.MouseEvent) => Promise<void>;
}

const InstallContext = createContext<InstallContextType | undefined>(undefined);

// Top-level variable for beforeinstallprompt event as specified
let deferredPrompt: any = null;

export const InstallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  useEffect(() => {
    // Check standalone / installed status
    const checkStandalone = () => {
      if (typeof window === 'undefined') return false;
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://')
      );
    };

    setIsStandalone(checkStandalone());

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      deferredPrompt = null;
      setIsInstallable(false);
      setIsStandalone(true);
      triggerToast('Someone app installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if app is already running in standalone mode
    if (isStandalone) {
      triggerToast('You are already using the installed app.');
      return;
    }

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          triggerToast('Someone app installed successfully!');
        }
        deferredPrompt = null;
        setIsInstallable(false);
      } catch (err) {
        console.warn('Install prompt error:', err);
        setIsInstallModalOpen(true);
      }
    } else {
      // Fallback for iOS Safari or when event hasn't fired
      setIsInstallModalOpen(true);
    }
  };

  return (
    <InstallContext.Provider
      value={{
        isInstallModalOpen,
        setIsInstallModalOpen,
        toastMessage,
        setToastMessage,
        isStandalone,
        isInstallable,
        handleInstallClick,
      }}
    >
      {children}
    </InstallContext.Provider>
  );
};

export const useInstall = () => {
  const context = useContext(InstallContext);
  if (!context) {
    throw new Error('useInstall must be used within an InstallProvider');
  }
  return context;
};
