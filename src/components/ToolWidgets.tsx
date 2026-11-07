import React, { useEffect, useState } from 'react';
import { ActiveTimer, OpenedLinkAction, ToolCallExecution } from '../utils/sessionTypes';
import { ExternalLink, Timer, X, Sparkles, CheckCircle2 } from 'lucide-react';

interface ToolWidgetsProps {
  activeTimers: ActiveTimer[];
  openedLinks: OpenedLinkAction[];
  latestToolCall: ToolCallExecution | null;
  onDismissTimer: (timerId: string) => void;
  onDismissLink: (linkId: string) => void;
}

export const ToolWidgets: React.FC<ToolWidgetsProps> = ({
  activeTimers,
  openedLinks,
  latestToolCall,
  onDismissTimer,
  onDismissLink,
}) => {
  const [timers, setTimers] = useState<ActiveTimer[]>(activeTimers);

  useEffect(() => {
    setTimers(activeTimers);
  }, [activeTimers]);

  // Tick active timers
  useEffect(() => {
    if (timers.length === 0) return;

    const interval = setInterval(() => {
      setTimers((prev) =>
        prev
          .map((t) => {
            const nextRemaining = t.remainingSeconds - 1;
            return {
              ...t,
              remainingSeconds: Math.max(0, nextRemaining),
            };
          })
          .filter((t) => t.remainingSeconds >= 0)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [timers.length]);

  return (
    <div className="w-full max-w-md mx-auto px-4 space-y-2.5 z-20 pointer-events-auto">
      {/* Latest Tool Execution Flash Badge */}
      {latestToolCall && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-violet-950/80 border border-violet-800/60 shadow-lg shadow-violet-950/40 backdrop-blur-md animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center space-x-2 text-xs">
            <Sparkles className="w-4 h-4 text-violet-400 animate-spin" />
            <span className="text-violet-200 font-semibold uppercase tracking-wider">
              {latestToolCall.toolName}
            </span>
            <span className="text-slate-400">executed</span>
          </div>
          <span className="text-[10px] text-violet-400 font-mono">
            Just now
          </span>
        </div>
      )}

      {/* Active Countdowns */}
      {timers.map((t) => {
        const mins = Math.floor(t.remainingSeconds / 60);
        const secs = t.remainingSeconds % 60;
        const isDone = t.remainingSeconds === 0;

        return (
          <div
            key={t.id}
            className={`flex items-center justify-between p-3 rounded-xl border backdrop-blur-md transition-all ${
              isDone
                ? 'bg-emerald-950/90 border-emerald-500/60 shadow-lg shadow-emerald-900/40 animate-pulse'
                : 'bg-slate-900/80 border-slate-700/80 shadow-md'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`p-2 rounded-lg ${
                  isDone ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-violet-400'
                }`}
              >
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Timer className="w-4 h-4" />}
              </div>
              <div>
                <h4 className="text-xs font-bold text-white capitalize">{t.label}</h4>
                <div className="text-base font-extrabold font-mono tracking-wider text-violet-300">
                  {isDone ? 'TIME IS UP!' : `${mins}:${secs < 10 ? '0' : ''}${secs}`}
                </div>
              </div>
            </div>
            <button
              onClick={() => onDismissTimer(t.id)}
              className="p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title="Dismiss timer"
              aria-label="Dismiss timer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}

      {/* Opened Link Action Cards */}
      {openedLinks.map((link) => (
        <div
          key={link.id}
          className="flex items-center justify-between p-3 rounded-xl bg-slate-900/90 border border-slate-700/90 shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex items-center space-x-2.5 overflow-hidden pr-2">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 shrink-0">
              <ExternalLink className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-slate-200 truncate">
                Riya launched {link.targetName}
              </div>
              <div className="text-[11px] text-cyan-400/90 truncate font-mono">
                {link.url}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 shrink-0">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center space-x-1 shadow-sm transition-colors"
            >
              <span>Open</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={() => onDismissLink(link.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Dismiss link"
              aria-label="Dismiss link"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
