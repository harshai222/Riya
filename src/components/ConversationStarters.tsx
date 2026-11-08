import React from 'react';
import { Flame, Music, Heart, HelpCircle, Sparkles, Timer } from 'lucide-react';

interface ConversationStartersProps {
  onSelectPrompt: (prompt: string) => void;
  status: string;
}

const STARTERS = [
  {
    icon: Flame,
    color: 'text-amber-400',
    borderColor: 'border-amber-500/30 hover:border-amber-500/70',
    bg: 'bg-amber-950/20',
    title: 'Roast me',
    phrase: 'Riya, roast my productivity today!',
  },
  {
    icon: Music,
    color: 'text-cyan-400',
    borderColor: 'border-cyan-500/30 hover:border-cyan-500/70',
    bg: 'bg-cyan-950/20',
    title: 'Play music',
    phrase: 'Open YouTube and play something chill',
  },
  {
    icon: Heart,
    color: 'text-rose-400',
    borderColor: 'border-rose-500/30 hover:border-rose-500/70',
    bg: 'bg-rose-950/20',
    title: 'Romantic vibe',
    phrase: 'Change the vibe to Romantic and tell me something sweet',
  },
  {
    icon: HelpCircle,
    color: 'text-purple-400',
    borderColor: 'border-purple-500/30 hover:border-purple-500/70',
    bg: 'bg-purple-950/20',
    title: 'Flip coin',
    phrase: 'Flip a coin: should I order dessert or hit the gym?',
  },
  {
    icon: Timer,
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/30 hover:border-emerald-500/70',
    bg: 'bg-emerald-950/20',
    title: 'Set timer',
    phrase: 'Set a 3-minute timer for my coffee break',
  },
  {
    icon: Sparkles,
    color: 'text-pink-400',
    borderColor: 'border-pink-500/30 hover:border-pink-500/70',
    bg: 'bg-pink-950/20',
    title: 'Hype talk',
    phrase: 'Give me your most savage motivational speech!',
  },
];

export const ConversationStarters: React.FC<ConversationStartersProps> = ({
  onSelectPrompt,
  status,
}) => {
  return (
    <div className="w-full max-w-xl mx-auto px-4 z-20">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Try saying to Riya
        </span>
        <span className="text-[10px] text-slate-500">
          Voice only · Instant replies
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {STARTERS.map((s, idx) => {
          const Icon = s.icon;
          return (
            <button
              key={idx}
              onClick={() => onSelectPrompt(s.phrase)}
              type="button"
              className={`flex items-start space-x-3 p-3.5 rounded-2xl border backdrop-blur-md transition-all duration-300 text-left cursor-pointer group active:scale-[0.98] shadow-lg hover:shadow-violet-500/10 ${s.bg} ${s.borderColor}`}
            >
              <div className={`p-2 rounded-xl bg-slate-950/40 border border-white/5 transition-transform group-hover:scale-110 group-hover:bg-slate-950/60 ${s.color}`}>
                <Icon className="w-4 h-4 shrink-0" />
              </div>
              <div className="overflow-hidden pt-0.5">
                <div className="text-xs font-bold text-slate-100 group-hover:text-white transition-colors truncate">
                  {s.title}
                </div>
                <div className="text-[10px] text-slate-400 font-medium line-clamp-1 group-hover:text-slate-300 transition-colors mt-0.5">
                  "{s.phrase}"
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
