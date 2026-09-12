import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Users, Shield, Radio, LogOut, Trash2, ChevronDown, User } from 'lucide-react';

interface NavbarProps {
  onOpenAuth: () => void;
  onOpenFriends: () => void;
  onOpenAdmin: () => void;
  onOpenSafety: () => void;
  onOpenDeleteAccount: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAuth,
  onOpenFriends,
  onOpenAdmin,
  onOpenSafety,
  onOpenDeleteAccount,
}) => {
  const { user, logout, toggleVolunteer } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    if (profileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileMenuOpen]);

  return (
    <header className="w-full border-b border-[#E7E0D8] bg-[#FAF8F5]/85 backdrop-blur-md sticky top-0 z-30 transition-colors">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <a
            href="#"
            id="brand-logo"
            className="text-xl font-serif font-medium tracking-tight text-[#2D2723] hover:text-[#C86D51] flex items-center gap-2.5 transition-colors"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#C86D51] shadow-xs"></span>
            Someone
          </a>
          <button
            id="nav-safety-link"
            onClick={onOpenSafety}
            className="text-xs text-[#8C827A] hover:text-[#2D2723] underline underline-offset-4 decoration-[#E7E0D8] hover:decoration-[#8C827A] transition-colors ml-1"
          >
            Safety notice
          </button>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 sm:gap-3 text-sm">
          {user ? (
            <>
              {/* Volunteer listener switch if eligible */}
              {user.isVolunteer && (
                <button
                  id="nav-volunteer-toggle"
                  onClick={() => toggleVolunteer(!user.volunteerActive)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    user.volunteerActive
                      ? 'bg-[#EBF3ED] text-[#2F5938] border-[#C3D9C8] shadow-xs'
                      : 'bg-[#F5F2EB] text-[#78716C] border-[#E7E0D8] hover:bg-[#EDE6DC]'
                  }`}
                  title="When available, you may be called upon if someone is waiting and no normal match is found."
                >
                  <Radio className={`w-3.5 h-3.5 ${user.volunteerActive ? 'animate-pulse text-[#2F5938]' : ''}`} />
                  <span className="hidden sm:inline">Listener:</span>
                  <span>{user.volunteerActive ? 'Available' : 'Off'}</span>
                </button>
              )}

              {/* Friends button */}
              <button
                id="nav-friends-btn"
                onClick={onOpenFriends}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[#5C534D] hover:text-[#2D2723] hover:bg-[#F2ECE4] transition-colors"
              >
                <Users className="w-4 h-4 text-[#8C827A]" />
                <span className="hidden sm:inline">Friends</span>
              </button>

              {/* Admin/Moderator dashboard link if staff */}
              {(user.role === 'admin' || user.role === 'moderator') && (
                <button
                  id="nav-admin-btn"
                  onClick={onOpenAdmin}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[#5C534D] hover:text-[#2D2723] hover:bg-[#F2ECE4] transition-colors"
                >
                  <Shield className="w-4 h-4 text-[#8C827A]" />
                  <span className="hidden sm:inline">Moderation</span>
                </button>
              )}

              {/* User Profile & Settings Dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  id="nav-user-menu-btn"
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="px-3 py-1.5 text-xs text-[#2D2723] bg-[#F5F2EB] hover:bg-[#EDE6DC] rounded-full border border-[#E7E0D8] font-medium inline-flex items-center gap-2 transition-all shadow-2xs"
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
                        {user.isVerified && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EBF3ED] text-[#2F5938] border border-[#C3D9C8]">
                            Verified
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="py-1">
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
              className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium text-[#2D2723] bg-[#F5F2EB] hover:bg-[#EDE6DC] border border-[#E7E0D8] transition-all shadow-2xs"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
