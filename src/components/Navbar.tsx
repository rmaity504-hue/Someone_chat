import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  Users,
  Shield,
  Radio,
  LogOut,
  Trash2,
  ChevronDown,
  ShieldCheck,
  Menu,
  X,
  Compass,
  Lock,
  MessageSquare,
  MessageCircle,
  AlertCircle,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton.js';

interface NavbarProps {
  onOpenAuth: () => void;
  onOpenFriends: () => void;
  onOpenAdmin: () => void;
  onOpenSafety: () => void;
  onOpenDeleteAccount: () => void;
  onOpenSecurity?: () => void;
  onOpenAbout?: (tab?: 'philosophy' | 'retention' | 'safety') => void;
  onOpenContactAdmin?: () => void;
  onChatNow?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAuth,
  onOpenFriends,
  onOpenAdmin,
  onOpenSafety,
  onOpenDeleteAccount,
  onOpenSecurity,
  onOpenAbout,
  onOpenContactAdmin,
  onChatNow,
}) => {
  const { user, logout, toggleVolunteer } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('#nav-mobile-menu-btn')
      ) {
        setMobileMenuOpen(false);
      }
    };
    if (profileMenuOpen || mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileMenuOpen, mobileMenuOpen]);

  return (
    <header className="w-full border-b border-[#E7E0D8] bg-[#FAF8F5]/90 backdrop-blur-md sticky top-0 z-30 transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand and primary desktop links */}
        <div className="flex items-center gap-6">
          <a
            href="#"
            id="brand-logo"
            onClick={(e) => {
              e.preventDefault();
              onChatNow?.();
            }}
            className="text-xl font-serif font-medium tracking-tight text-[#2D2723] hover:text-[#C86D51] flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#C86D51] shadow-xs"></span>
            Someone
          </a>

          {/* Minimalist Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-5 text-xs text-[#5C534D]">
            <button
              id="nav-chat-now-btn"
              onClick={onChatNow}
              className="hover:text-[#2D2723] font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[#C86D51]" />
              <span>Chat Now</span>
            </button>
            <button
              id="nav-philosophy-btn"
              onClick={() => onOpenAbout?.('philosophy')}
              className="hover:text-[#2D2723] transition-colors cursor-pointer"
            >
              Our Philosophy
            </button>
            <button
              id="nav-retention-btn"
              onClick={() => onOpenAbout?.('retention')}
              className="hover:text-[#2D2723] transition-colors cursor-pointer"
            >
              Zero-Retention
            </button>
            <button
              id="nav-contact-admin-desktop-btn"
              onClick={onOpenContactAdmin}
              className="hover:text-[#2D2723] transition-colors cursor-pointer flex items-center gap-1"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#8C827A]" />
              <span>Contact Admin</span>
            </button>
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 sm:gap-3 text-sm">
          {/* Always visible Install App on desktop navigation */}
          <PWAInstallButton variant="navbar" />

          {user ? (
            <>
              {/* Volunteer listener switch if eligible */}
              {user.isVolunteer && (
                <button
                  id="nav-volunteer-toggle"
                  onClick={() => toggleVolunteer(!user.volunteerActive)}
                  className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    user.volunteerActive
                      ? 'bg-[#EBF3ED] text-[#2F5938] border-[#C3D9C8] shadow-xs'
                      : 'bg-[#F5F2EB] text-[#78716C] border-[#E7E0D8] hover:bg-[#EDE6DC]'
                  }`}
                  title="When available, you may be called upon if someone is waiting and no normal match is found."
                >
                  <Radio className={`w-3.5 h-3.5 ${user.volunteerActive ? 'animate-pulse text-[#2F5938]' : ''}`} />
                  <span>{user.volunteerActive ? 'Listener: On' : 'Listener: Off'}</span>
                </button>
              )}

              {/* Saved Connections button */}
              <button
                id="nav-friends-btn"
                onClick={onOpenFriends}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[#5C534D] hover:text-[#2D2723] hover:bg-[#F2ECE4] text-xs font-medium transition-colors"
                title="View your private saved connections"
              >
                <Users className="w-3.5 h-3.5 text-[#8C827A]" />
                <span>Saved Connections</span>
              </button>

              {/* Admin/Moderator dashboard link if staff */}
              {(user.role === 'admin' || user.role === 'moderator') && (
                <button
                  id="nav-admin-btn"
                  onClick={onOpenAdmin}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[#5C534D] hover:text-[#2D2723] hover:bg-[#F2ECE4] text-xs font-medium transition-colors"
                >
                  <Shield className="w-3.5 h-3.5 text-[#8C827A]" />
                  <span>Admin</span>
                </button>
              )}

              {/* User Profile & Settings Dropdown */}
              <div className="relative hidden sm:block" ref={menuRef}>
                <button
                  id="nav-user-menu-btn"
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="px-3 py-1.5 text-xs text-[#2D2723] bg-[#F5F2EB] hover:bg-[#EDE6DC] rounded-full border border-[#E7E0D8] font-medium inline-flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="true"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="max-w-[110px] truncate">{user.displayName}</span>
                  <ChevronDown className="w-3 h-3 text-[#8C827A] shrink-0" />
                </button>

                {profileMenuOpen && (
                  <div
                    id="nav-profile-dropdown"
                    className="absolute right-0 mt-2 w-60 bg-[#FAF8F5] rounded-2xl border border-[#E7E0D8] shadow-[0_12px_36px_-8px_rgba(45,39,35,0.12)] py-2 z-40 animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    <div className="px-4 py-2.5 border-b border-[#E7E0D8]/60">
                      <p className="text-xs font-medium text-[#2D2723] truncate">{user.displayName}</p>
                      <p className="text-[11px] text-[#8C827A] truncate">{user.email}</p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F3EFEA] text-[#78716C] border border-[#E7E0D8]">
                          {user.role}
                        </span>
                      </div>
                    </div>

                    <div className="py-1">
                      <button
                        id="nav-security-question-btn"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          onOpenSecurity?.();
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs text-[#5C534D] hover:text-[#2D2723] hover:bg-[#F3EFEA] flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#8C827A]" />
                          <span>Security Question</span>
                        </div>
                        {!user.hasSecurityQuestion && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FAF0E6] text-[#C86D51] font-medium border border-[#E7D7C5]">
                            Setup needed
                          </span>
                        )}
                      </button>

                      <button
                        id="nav-profile-signout-btn"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          logout();
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs text-[#5C534D] hover:text-[#2D2723] hover:bg-[#F3EFEA] flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5 text-[#8C827A]" />
                        <span>Sign out</span>
                      </button>

                      <div className="my-1 border-t border-[#E7E0D8]/60"></div>

                      <button
                        id="nav-delete-account-btn"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          onOpenDeleteAccount();
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs text-[#A84332] hover:bg-[#FAF0EE] flex items-center gap-2.5 transition-colors font-medium cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[#A84332]" />
                        <span>Delete Account</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button
              id="nav-signin-btn"
              onClick={onOpenAuth}
              className="hidden sm:inline-block px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium text-[#2D2723] bg-[#F5F2EB] hover:bg-[#EDE6DC] border border-[#E7E0D8] transition-all shadow-2xs cursor-pointer"
            >
              Sign in
            </button>
          )}

          {/* Mobile hamburger menu toggle */}
          <button
            id="nav-mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className="p-2 rounded-xl text-[#5C534D] hover:text-[#2D2723] hover:bg-[#F2ECE4] transition-colors md:hidden cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown Menu */}
      {mobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          id="nav-mobile-dropdown"
          className="md:hidden border-t border-[#E7E0D8] bg-[#FAF8F5] px-4 py-4 space-y-2 shadow-xl animate-in slide-in-from-top-2 duration-150"
        >
          <div className="space-y-1 pb-2 border-b border-[#E7E0D8]">
            <button
              id="mobile-nav-chat-now"
              onClick={() => {
                setMobileMenuOpen(false);
                onChatNow?.();
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-[#2D2723] hover:bg-[#F2ECE4] flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-[#C86D51]" />
              <span>Chat Now</span>
            </button>

            {/* Always visible Install App in mobile menu alongside Chat Now */}
            <PWAInstallButton
              variant="menu"
              onAction={() => setMobileMenuOpen(false)}
            />

            <button
              id="mobile-nav-philosophy"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAbout?.('philosophy');
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs text-[#5C534D] hover:text-[#2D2723] hover:bg-[#F2ECE4] flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <Compass className="w-4 h-4 text-[#8C827A]" />
              <span>Our Philosophy & Architecture</span>
            </button>

            <button
              id="mobile-nav-retention"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAbout?.('retention');
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs text-[#5C534D] hover:text-[#2D2723] hover:bg-[#F2ECE4] flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <Lock className="w-4 h-4 text-[#8C827A]" />
              <span>Privacy & Zero-Retention Policy</span>
            </button>

            <button
              id="mobile-nav-contact-admin"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenContactAdmin?.();
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs text-[#5C534D] hover:text-[#2D2723] hover:bg-[#F2ECE4] flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-[#8C827A]" />
              <span>Contact Admin</span>
            </button>

            <button
              id="mobile-nav-safety"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenSafety();
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs text-[#5C534D] hover:text-[#2D2723] hover:bg-[#F2ECE4] flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <AlertCircle className="w-4 h-4 text-[#8C827A]" />
              <span>Safety Notice</span>
            </button>
          </div>

          {/* User authenticated items on mobile */}
          {user ? (
            <div className="pt-2 space-y-1">
              <div className="px-3 py-1.5 text-xs text-[#2D2723] font-medium flex items-center justify-between">
                <span>{user.displayName}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F3EFEA] text-[#78716C] border border-[#E7E0D8]">
                  {user.role}
                </span>
              </div>

              {user.isVolunteer && (
                <button
                  id="mobile-nav-volunteer-toggle"
                  onClick={() => toggleVolunteer(!user.volunteerActive)}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-[#5C534D] hover:bg-[#F2ECE4] flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Radio className={`w-3.5 h-3.5 ${user.volunteerActive ? 'text-[#2F5938]' : 'text-[#8C827A]'}`} />
                    <span>Listener Role</span>
                  </div>
                  <span className={`text-[11px] font-medium ${user.volunteerActive ? 'text-[#2F5938]' : 'text-[#78716C]'}`}>
                    {user.volunteerActive ? 'Available' : 'Off'}
                  </span>
                </button>
              )}

              <button
                id="mobile-nav-friends"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenFriends();
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs text-[#5C534D] hover:bg-[#F2ECE4] flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Users className="w-4 h-4 text-[#8C827A]" />
                <span>Saved Connections</span>
              </button>

              {(user.role === 'admin' || user.role === 'moderator') && (
                <button
                  id="mobile-nav-admin"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAdmin();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-[#5C534D] hover:bg-[#F2ECE4] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Shield className="w-4 h-4 text-[#8C827A]" />
                  <span>Admin Dashboard</span>
                </button>
              )}

              <button
                id="mobile-nav-security"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenSecurity?.();
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs text-[#5C534D] hover:bg-[#F2ECE4] flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#8C827A]" />
                  <span>Security Question</span>
                </div>
                {!user.hasSecurityQuestion && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FAF0E6] text-[#C86D51]">
                    Setup
                  </span>
                )}
              </button>

              <button
                id="mobile-nav-signout"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs text-[#5C534D] hover:bg-[#F2ECE4] flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-[#8C827A]" />
                <span>Sign out</span>
              </button>

              <button
                id="mobile-nav-delete-account"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenDeleteAccount();
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs text-[#A84332] hover:bg-[#FAF0EE] flex items-center gap-2.5 transition-colors font-medium cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-[#A84332]" />
                <span>Delete Account</span>
              </button>
            </div>
          ) : (
            <div className="pt-2">
              <button
                id="mobile-nav-signin"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth();
                }}
                className="w-full py-2 px-4 rounded-xl text-xs font-medium text-[#2D2723] bg-[#F5F2EB] hover:bg-[#EDE6DC] border border-[#E7E0D8] text-center transition-colors cursor-pointer"
              >
                Sign in to account
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
