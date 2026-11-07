import React from 'react';
import { VibeType, VIBE_CONFIGS } from '../utils/sessionTypes';
import { X, Sparkles, ShieldCheck, Cpu, LogOut } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeVibe: VibeType;
  onSelectVibe: (vibe: VibeType) => void;
  onSignOut?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  activeVibe,
  onSelectVibe,
  onSignOut,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h2 className="text-base font-bold text-white tracking-wide">
              Riya Assistant Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 overflow-y-auto space-y-6 text-sm text-slate-300">
          {/* Persona Card */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-violet-950/40 via-purple-950/20 to-pink-950/40 border border-violet-800/40">
            <div className="flex items-center space-x-2 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-violet-400">
                Persona Profile
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-900/80 text-violet-200">
                Witty & Sassy
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Riya is a young, confident female companion who talks with casual banter, playful eye-rolls, and genuine warmth. No robotic corporate jargon—just pure voice conversation.
            </p>
          </div>

          {/* Vibe Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Ambient Aura & Lighting
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.values(VIBE_CONFIGS).map((vibe) => (
                <button
                  key={vibe.id}
                  onClick={() => onSelectVibe(vibe.id)}
                  type="button"
                  className={`p-3 rounded-xl border text-left flex items-center space-x-3 transition-all cursor-pointer ${
                    activeVibe === vibe.id
                      ? 'bg-violet-950/70 border-violet-500 shadow-lg text-white'
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: vibe.accentColor }}
                  />
                  <div>
                    <div className="font-semibold text-xs">{vibe.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{vibe.tagline}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Audio Engine Specs */}
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Real-Time Audio Pipeline</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <div className="text-slate-500 text-[10px] uppercase font-bold">Mic Input</div>
                <div className="font-mono text-cyan-300 font-semibold mt-0.5">16kHz PCM16</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Native AudioContext</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <div className="text-slate-500 text-[10px] uppercase font-bold">Voice Output</div>
                <div className="font-mono text-pink-300 font-semibold mt-0.5">24kHz PCM16</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Gapless Web Audio API</div>
              </div>
            </div>
          </div>

          {/* Active Voice Tools */}
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Voice Tools & Memory Actions</span>
            </div>
            <ul className="text-xs space-y-1.5 text-slate-300">
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span><strong>openWebsite</strong>: "Open YouTube and play lo-fi"</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                <span><strong>changeVibe</strong>: "Change the vibe to Romantic"</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span><strong>setTimer</strong>: "Set a 5-minute timer for my break"</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span><strong>rememberFact</strong>: "Remember that I love matcha lattes"</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                <span><strong>forgetFact</strong>: "Forget that I have a cat"</span>
              </li>
            </ul>
          </div>

          {/* Account & Sign Out */}
          {onSignOut && (
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-rose-300">Firebase Session</div>
                <div className="text-[11px] text-slate-400">Sign out and switch Google account</div>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onSignOut();
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-xs font-semibold border border-rose-700/60 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-300" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-900/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
