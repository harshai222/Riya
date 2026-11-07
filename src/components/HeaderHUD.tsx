import React, { useState } from 'react';
import { LiveSessionStatus, VibeConfig, VibeType, VIBE_CONFIGS } from '../utils/sessionTypes';
import { Settings, Sparkles, Volume2, Mic, Palette, Brain, LogOut, User as UserIcon, Shield, ShieldCheck } from 'lucide-react';
import { User, isUserAdmin } from '../lib/firebase';

interface HeaderHUDProps {
  status: LiveSessionStatus;
  currentVibe: VibeConfig;
  userVolume: number;
  riyaVolume: number;
  memoryCount: number;
  currentUser: User | null;
  username?: string;
  onOpenSettings: () => void;
  onOpenMemoryVault: () => void;
  onOpenAdminPanel?: () => void;
  onSelectVibe: (vibe: VibeType) => void;
  onSignOut: () => void;
  onInterrupt?: () => void;
}

export const HeaderHUD: React.FC<HeaderHUDProps> = ({
  status,
  currentVibe,
  userVolume,
  riyaVolume,
  memoryCount,
  currentUser,
  username,
  onOpenSettings,
  onOpenMemoryVault,
  onOpenAdminPanel,
  onSelectVibe,
  onSignOut,
}) => {
  const [showVibeDropdown, setShowVibeDropdown] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const isAdmin = isUserAdmin(currentUser);

  const getStatusBadge = () => {
    switch (status) {
      case 'speaking':
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping" />
            <span>SPEAKING</span>
          </div>
        );
      case 'listening':
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>LISTENING</span>
          </div>
        );
      case 'connecting':
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-spin" />
            <span>CONNECTING</span>
          </div>
        );
      case 'executing_tool':
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
            <span>ACTION</span>
          </div>
        );
      case 'disconnected':
      default:
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/60 border border-slate-700 text-slate-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span>OFFLINE</span>
          </div>
        );
    }
  };

  return (
    <header className="w-full max-w-4xl mx-auto px-4 pt-3 pb-2 flex items-center justify-between relative z-30">
      {/* Brand Identity */}
      <div className="flex items-center space-x-2.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg transition-colors border"
          style={{
            background: `linear-gradient(135deg, ${currentVibe.orbGradient[0]} 0%, ${currentVibe.orbGradient[1]} 100%)`,
            borderColor: `${currentVibe.accentColor}80`,
          }}
        >
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-extrabold tracking-wide text-white font-['Space_Grotesk']">
              RIYA
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-violet-950/80 text-violet-300 border border-violet-800/40">
              LIVE
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium tracking-tight">
            Voice Companion &middot; {username ? `@${username}` : 'Unique User'}
          </p>
        </div>
      </div>

      {/* Center Status and Audio Levels */}
      <div className="hidden sm:flex items-center space-x-3">
        {getStatusBadge()}

        {/* Dynamic Dual Mini Audio Meters */}
        {status !== 'disconnected' && (
          <div className="flex items-center space-x-3 px-3 py-1 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
            {/* User Mic level */}
            <div className="flex items-center space-x-1" title="User mic volume">
              <Mic className="w-3 h-3 text-emerald-400" />
              <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-75"
                  style={{ width: `${Math.min(100, userVolume * 100)}%` }}
                />
              </div>
            </div>

            <span className="text-slate-600">|</span>

            {/* Riya Output Voice level */}
            <div className="flex items-center space-x-1" title="Riya voice level">
              <Volume2 className="w-3 h-3 text-pink-400" />
              <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-pink-400 transition-all duration-75"
                  style={{ width: `${Math.min(100, riyaVolume * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Controls: Admin Button, Vibe Preset, Memory Vault & Google Profile */}
      <div className="flex items-center space-x-2">
        {/* Mobile status pill */}
        <div className="sm:hidden">{getStatusBadge()}</div>

        {/* Dedicated Admin Panel Trigger (Shown ONLY to verified admin) */}
        {isAdmin && onOpenAdminPanel && (
          <button
            onClick={onOpenAdminPanel}
            type="button"
            aria-label="Open Admin Panel"
            title="Administrator Control Panel"
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 hover:text-white transition-all text-xs font-semibold cursor-pointer shadow-lg shadow-emerald-950/30"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Admin Panel</span>
          </button>
        )}

        {/* Vibe Selector dropdown trigger */}
        <div className="relative">
          <button
            onClick={() => {
              setShowVibeDropdown(!showVibeDropdown);
              setShowProfileMenu(false);
            }}
            type="button"
            aria-label="Change ambient vibe"
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all text-xs font-semibold cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5 text-violet-400" />
            <span className="hidden md:inline">{currentVibe.name}</span>
          </button>

          {showVibeDropdown && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-950/95 border border-slate-800 shadow-2xl backdrop-blur-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
              onMouseLeave={() => setShowVibeDropdown(false)}
            >
              <div className="px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Select Aura Vibe
              </div>
              {Object.values(VIBE_CONFIGS).map((vibe) => (
                <button
                  key={vibe.id}
                  onClick={() => {
                    onSelectVibe(vibe.id);
                    setShowVibeDropdown(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center space-x-2 transition-all ${
                    currentVibe.id === vibe.id
                      ? 'bg-violet-950/80 text-violet-200 border border-violet-800/40'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: vibe.accentColor }}
                  />
                  <div className="truncate">
                    <div className="font-semibold">{vibe.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{vibe.tagline}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Memory Vault Button */}
        <button
          onClick={onOpenMemoryVault}
          type="button"
          aria-label="Open Memory Vault"
          title="Riya's Memory Vault (Persistent database)"
          className="relative flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-violet-300 hover:text-white transition-all text-xs font-semibold cursor-pointer"
        >
          <Brain className="w-3.5 h-3.5 text-violet-400" />
          <span className="hidden sm:inline">Memory</span>
          {memoryCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-violet-600 text-[10px] text-white font-mono font-bold">
              {memoryCount}
            </span>
          )}
        </button>

        {/* Google User Profile Avatar / Sign-Out Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowVibeDropdown(false);
            }}
            type="button"
            aria-label="User account menu"
            className="flex items-center space-x-1.5 p-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
          >
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName || 'User'}
                className="w-6 h-6 rounded-md object-cover ring-1 ring-violet-500/50"
              />
            ) : (
              <div className="w-6 h-6 rounded-md bg-violet-900/80 text-violet-200 flex items-center justify-center text-xs font-bold ring-1 ring-violet-500/50">
                {username ? username[0].toUpperCase() : (currentUser?.displayName?.[0] || <UserIcon className="w-3.5 h-3.5" />)}
              </div>
            )}
            <span className="text-xs font-medium text-slate-200 hidden lg:inline max-w-[90px] truncate pr-1">
              {username ? `@${username}` : (currentUser?.displayName?.split(' ')[0] || 'Account')}
            </span>
          </button>

          {showProfileMenu && (
            <div
              className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-950/95 border border-slate-800 shadow-2xl backdrop-blur-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 text-left"
              onMouseLeave={() => setShowProfileMenu(false)}
            >
              {/* User Identity info */}
              <div className="flex items-center space-x-2.5 pb-2.5 border-b border-slate-800">
                {currentUser?.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-9 h-9 rounded-lg object-cover ring-1 ring-violet-500/50"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-violet-900/80 text-violet-200 flex items-center justify-center font-bold">
                    {username ? username[0].toUpperCase() : (currentUser?.displayName?.[0] || <UserIcon className="w-4 h-4" />)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate flex items-center space-x-1.5">
                    <span>{username ? `@${username}` : currentUser?.displayName}</span>
                    {isAdmin && (
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {currentUser?.email || 'Google Account'}
                  </div>
                </div>
              </div>

              {/* UID badge for complete transparency */}
              <div className="mt-2 py-1 px-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-[10px]">
                <span className="text-slate-400 flex items-center space-x-1">
                  <Shield className="w-3 h-3 text-emerald-400" />
                  <span>UID</span>
                </span>
                <span className="font-mono text-slate-300 truncate max-w-[140px]">
                  {currentUser?.uid}
                </span>
              </div>

              {/* Menu Actions */}
              <div className="mt-2.5 space-y-1">
                {isAdmin && onOpenAdminPanel && (
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onOpenAdminPanel();
                    }}
                    className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs text-emerald-300 hover:text-white hover:bg-emerald-950/60 border border-emerald-800/40 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Open Admin Panel</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenMemoryVault();
                  }}
                  className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <Brain className="w-3.5 h-3.5 text-violet-400" />
                  <span>Memory Vault ({memoryCount} facts)</span>
                </button>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenSettings();
                  }}
                  className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  <span>Voice Settings</span>
                </button>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onSignOut();
                  }}
                  className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 transition-colors cursor-pointer mt-1 border-t border-slate-800/80 pt-2"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
