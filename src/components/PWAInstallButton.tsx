import React from 'react';
import { Smartphone } from 'lucide-react';
import { useInstall } from '../context/InstallContext.js';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'navbar' | 'menu' | 'footer';
  onAction?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'navbar',
  onAction,
}) => {
  const { handleInstallClick, isStandalone } = useInstall();

  // If the app is already running in standalone mode (display-mode: standalone), hide this option completely
  if (isStandalone) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAction?.();
    handleInstallClick(e);
  };

  if (variant === 'footer') {
    return (
      <button
        id="footer-pwa-install-btn"
        type="button"
        onClick={handleClick}
        className={`hover:text-[#2D2723] underline underline-offset-4 decoration-[#E7E0D8] transition-colors cursor-pointer inline-flex items-center gap-1.5 ${className}`}
        title="Install Someone as a web app"
      >
        <Smartphone className="w-3.5 h-3.5 text-[#8C827A]" />
        <span>Install as web app</span>
      </button>
    );
  }

  if (variant === 'menu') {
    return (
      <button
        id="pwa-install-mobile-btn"
        type="button"
        onClick={handleClick}
        className={`w-full text-left px-3 py-2 rounded-xl text-xs text-[#5C534D] hover:text-[#2D2723] hover:bg-[#F2ECE4] flex items-center gap-2.5 transition-colors cursor-pointer ${className}`}
        title="Install Someone as a web app"
      >
        <Smartphone className="w-4 h-4 text-[#8C827A]" />
        <span>Install as web app</span>
      </button>
    );
  }

  // Desktop / Header bar button
  return (
    <button
      id="pwa-install-desktop-btn"
      type="button"
      onClick={handleClick}
      className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#F5F2EB] hover:bg-[#EDE6DC] text-[#5C534D] hover:text-[#2D2723] border border-[#E7E0D8] transition-all cursor-pointer shadow-2xs ${className}`}
      title="Install Someone as a web app on your device"
    >
      <Smartphone className="w-3.5 h-3.5 text-[#8C827A]" />
      <span>Install as web app</span>
    </button>
  );
};
