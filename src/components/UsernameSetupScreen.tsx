import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, Loader2, ArrowRight, ShieldCheck, User as UserIcon, LogOut } from 'lucide-react';
import {
  User,
  DbUserProfile,
  checkUsernameAvailability,
  claimUsernameTransaction,
  validateUsernameFormat,
  normalizeUsername,
} from '../lib/firebase';

interface UsernameSetupScreenProps {
  currentUser: User;
  currentProfile: DbUserProfile | null;
  onUsernameClaimed: (updatedProfile: DbUserProfile) => void;
  onSignOut: () => void;
}

export const UsernameSetupScreen: React.FC<UsernameSetupScreenProps> = ({
  currentUser,
  currentProfile,
  onUsernameClaimed,
  onSignOut,
}) => {
  const [usernameInput, setUsernameInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Debounced availability check
  useEffect(() => {
    const raw = usernameInput.trim();
    if (!raw) {
      setStatus('idle');
      setStatusMessage('');
      return;
    }

    const validation = validateUsernameFormat(raw);
    if (!validation.isValid) {
      setStatus('invalid');
      setStatusMessage(validation.error!);
      return;
    }

    setStatus('checking');
    setStatusMessage('Checking availability...');

    const timer = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailability(raw, currentUser.uid);
        if (result.available) {
          setStatus('available');
          setStatusMessage('Username available');
        } else {
          setStatus('taken');
          setStatusMessage('This username is already in use. Please choose another one.');
        }
      } catch (err) {
        console.error('Availability check error:', err);
        setStatus('idle');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [usernameInput, currentUser.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = usernameInput.trim();
    const validation = validateUsernameFormat(raw);
    if (!validation.isValid) {
      setStatus('invalid');
      setStatusMessage(validation.error!);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const updated = await claimUsernameTransaction(currentUser, raw, currentProfile);
      onUsernameClaimed(updated);
    } catch (err: any) {
      console.error('Claim username error:', err);
      setSubmitError(err?.message || 'Failed to claim username. Please try again.');
      setStatus('taken');
      setStatusMessage(err?.message || 'This username is already in use. Please choose another one.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col justify-between items-center select-none bg-[#07080d] text-slate-100 p-4 sm:p-6">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-violet-600/15 rounded-full blur-[130px]" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[450px] h-[450px] bg-cyan-600/10 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#1f293d_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full max-w-4xl flex items-center justify-between pt-2">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-base font-extrabold tracking-wider text-white font-['Space_Grotesk']">
              RIYA
            </span>
            <span className="ml-2 text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-violet-950/90 text-violet-300 border border-violet-700/50">
              IDENTITY PROTOCOL
            </span>
          </div>
        </div>

        <button
          onClick={onSignOut}
          type="button"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-400" />
          <span>Switch Account</span>
        </button>
      </header>

      {/* Main Setup Card */}
      <main className="relative z-10 w-full max-w-md my-auto flex flex-col items-center text-center">
        {/* User Google badge */}
        <div className="flex items-center space-x-2.5 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 mb-5">
          {currentUser.photoURL ? (
            <img
              src={currentUser.photoURL}
              alt="Avatar"
              className="w-5 h-5 rounded-full object-cover ring-1 ring-violet-500"
            />
          ) : (
            <UserIcon className="w-4 h-4 text-violet-400" />
          )}
          <span className="text-xs text-slate-300 font-medium">
            Signed in as <strong className="text-white">{currentUser.displayName || currentUser.email}</strong>
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2 font-['Space_Grotesk']">
          Claim Your Username
        </h1>
        <p className="text-xs text-slate-300 max-w-sm mb-6 leading-relaxed">
          Choose a unique username for your Riya profile. This reserves your global identity across conversations and the memory vault.
        </p>

        {/* Submission Error Banner */}
        {submitError && (
          <div className="w-full mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-200 text-xs flex items-center space-x-2 text-left animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="text-left">
            <label htmlFor="username-input" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Unique Username
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm font-bold">
                @
              </span>
              <input
                id="username-input"
                type="text"
                autoComplete="off"
                spellCheck="false"
                maxLength={20}
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="e.g. harsh_dev"
                className="w-full pl-8 pr-10 py-3 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-sm font-mono tracking-wide transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {status === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                {status === 'available' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {(status === 'taken' || status === 'invalid') && (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                )}
              </div>
            </div>

            {/* Availability / Validation Status message */}
            <div className="min-h-[22px] mt-1.5 flex items-center justify-between text-[11px]">
              {status === 'available' && (
                <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 inline" />
                  <span>{statusMessage}</span>
                </span>
              )}
              {status === 'taken' && (
                <span className="text-rose-400 font-medium">
                  {statusMessage}
                </span>
              )}
              {status === 'invalid' && (
                <span className="text-amber-400 font-medium">
                  {statusMessage}
                </span>
              )}
              {status === 'checking' && (
                <span className="text-slate-400 italic">
                  {statusMessage}
                </span>
              )}
              {status === 'idle' && (
                <span className="text-slate-500">
                  3-20 characters, letters, numbers, and underscores
                </span>
              )}

              {usernameInput.trim().length > 0 && (
                <span className="text-[10px] font-mono text-slate-500">
                  Key: {normalizeUsername(usernameInput)}
                </span>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={status !== 'available' || isSubmitting}
            className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold py-3.5 px-4 transition-all duration-200 shadow-xl shadow-violet-600/20 active:scale-[0.99] flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span className="text-sm">Reserving @{normalizeUsername(usernameInput)}...</span>
              </>
            ) : (
              <>
                <span className="text-sm font-bold">Reserve Username & Enter Riya</span>
                <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="flex items-center space-x-1.5 mt-5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
          <span>Atomic Firestore transaction. Globally unique reservation.</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-4xl text-center py-2 text-[11px] text-slate-500 border-t border-slate-900">
        <span>Riya Voice Engine &middot; Verified Firebase Google Identity</span>
      </footer>
    </div>
  );
};
