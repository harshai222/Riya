import React, { useState } from 'react';
import { Sparkles, Brain, Shield, Mic, Lock, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';

interface AuthScreenProps {
  onSignedIn: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSignedIn }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
      onSignedIn();
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in popup was closed. Please try again.');
      } else if (err?.code === 'auth/popup-blocked') {
        setAuthError('Popup was blocked by your browser. Please allow popups for this site.');
      } else {
        setAuthError(err?.message || 'Failed to sign in with Google. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col justify-between items-center select-none bg-[#07080d] text-slate-100 p-4 sm:p-6">
      {/* Dynamic Background Glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-violet-600/15 rounded-full blur-[130px]" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[480px] h-[480px] bg-fuchsia-600/10 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#1f293d_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
      </div>

      {/* Top Header Badge */}
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
              VOICE ENGINE
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 font-medium">
          <Lock className="w-3 h-3 text-emerald-400" />
          <span>Google Auth Required</span>
        </div>
      </header>

      {/* Main Hero Card */}
      <main className="relative z-10 w-full max-w-md my-auto flex flex-col items-center text-center">
        {/* Holographic Glowing Core Emblem */}
        <div className="relative mb-6">
          <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-cyan-400 p-0.5 shadow-2xl shadow-violet-500/30 animate-pulse">
            <div className="w-full h-full rounded-full bg-[#090b12] flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.35)_0%,transparent_70%)]" />
              <Mic className="w-10 h-10 text-violet-300 relative z-10 drop-shadow-[0_0_12px_rgba(192,132,252,0.8)]" />
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-slate-900 border border-violet-500/50 text-[10px] font-mono text-violet-300 tracking-wider">
            UID ISOLATED
          </div>
        </div>

        {/* Title & Sassy Description */}
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
          Meet Riya
        </h1>
        <p className="text-sm text-slate-300 max-w-sm mb-6 leading-relaxed">
          Your sharp, witty, and playful voice AI companion. Powered by sub-second real-time Gemini Live audio with persistent personal memory.
        </p>

        {/* Features Row */}
        <div className="w-full grid grid-cols-2 gap-2.5 mb-6 text-left">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center space-x-2 text-violet-300 mb-1">
              <Mic className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs font-semibold">Real-Time Voice</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Bidirectional 24kHz audio. Talk naturally with real interruptions.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center space-x-2 text-pink-300 mb-1">
              <Brain className="w-3.5 h-3.5 text-pink-400" />
              <span className="text-xs font-semibold">Personal Memory</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Firestore memory vault locked strictly to your Firebase Google UID.
            </p>
          </div>
        </div>

        {/* Auth Error Banner */}
        {authError && (
          <div className="w-full mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-200 text-xs flex items-center space-x-2 text-left animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        {/* Polished Google Sign-In Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          type="button"
          className="w-full relative group overflow-hidden rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold py-3.5 px-4 transition-all duration-200 shadow-xl shadow-white/5 active:scale-[0.99] flex items-center justify-center space-x-3 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed border border-slate-200"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
              <span className="text-sm text-slate-800">Signing into Firebase...</span>
            </>
          ) : (
            <>
              {/* Google G Logo SVG */}
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span className="text-sm font-bold tracking-tight">Sign in with Google</span>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </button>

        {/* Security & Isolation Assurance */}
        <div className="flex items-center space-x-1.5 mt-4 text-[11px] text-slate-500">
          <Shield className="w-3.5 h-3.5 text-emerald-500" />
          <span>Zero-Trust ABAC. Only your UID can access your data.</span>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="relative z-10 w-full max-w-4xl text-center py-2 text-[11px] text-slate-500 border-t border-slate-900">
        <span>Riya Voice Engine &middot; Firebase Firestore &middot; Gemini Live Audio</span>
      </footer>
    </div>
  );
};
