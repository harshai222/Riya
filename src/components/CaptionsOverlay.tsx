import React, { useState } from 'react';
import { LiveTranscriptItem } from '../utils/sessionTypes';
import { Subtitles, EyeOff } from 'lucide-react';

interface CaptionsOverlayProps {
  latestTranscript: LiveTranscriptItem | null;
  status: string;
}

export const CaptionsOverlay: React.FC<CaptionsOverlayProps> = ({
  latestTranscript,
  status,
}) => {
  const [enabled, setEnabled] = useState(true);

  if (!enabled || !latestTranscript || status === 'disconnected') {
    return (
      <div className="fixed bottom-3 right-4 z-30">
        <button
          onClick={() => setEnabled(!enabled)}
          title={enabled ? 'Hide live captions' : 'Show live captions'}
          aria-label={enabled ? 'Hide live captions' : 'Show live captions'}
          className="p-2 rounded-full bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white transition-colors backdrop-blur-md"
        >
          {enabled ? <EyeOff className="w-4 h-4" /> : <Subtitles className="w-4 h-4" />}
        </button>
      </div>
    );
  }

  const isUser = latestTranscript.speaker === 'user';

  return (
    <div className="fixed bottom-4 inset-x-0 mx-auto max-w-lg px-4 z-30 pointer-events-none">
      <div className="relative pointer-events-auto flex items-center justify-between p-3 rounded-2xl bg-slate-950/85 border border-slate-800/80 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-start space-x-2.5 overflow-hidden pr-2">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
              isUser
                ? 'bg-violet-950/90 text-violet-300 border border-violet-800/60'
                : 'bg-pink-950/90 text-pink-300 border border-pink-800/60'
            }`}
          >
            {isUser ? 'You' : 'Riya'}
          </span>
          <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed line-clamp-3">
            {latestTranscript.text}
          </p>
        </div>

        <button
          onClick={() => setEnabled(false)}
          className="p-1 rounded-md text-slate-500 hover:text-slate-300 shrink-0 transition-colors"
          title="Hide captions"
          aria-label="Hide captions"
        >
          <EyeOff className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
