export type LiveSessionStatus =
  | 'disconnected'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'executing_tool';

export type VibeType = 'cyberpunk' | 'romantic' | 'midnight' | 'neon_sunset' | 'emerald_matrix';

export interface VibeConfig {
  id: VibeType;
  name: string;
  tagline: string;
  primaryGlow: string; // Tailwind / Hex
  secondaryGlow: string;
  orbGradient: [string, string, string];
  accentColor: string;
}

export const VIBE_CONFIGS: Record<VibeType, VibeConfig> = {
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    tagline: 'Electric violet & neon cyan attitude',
    primaryGlow: '#8b5cf6',
    secondaryGlow: '#06b6d4',
    orbGradient: ['#a855f7', '#ec4899', '#06b6d4'],
    accentColor: '#ec4899',
  },
  romantic: {
    id: 'romantic',
    name: 'Rose Romance',
    tagline: 'Soft rose gold, blush pink & warm passion',
    primaryGlow: '#f43f5e',
    secondaryGlow: '#fb7185',
    orbGradient: ['#f43f5e', '#fb7185', '#fda4af'],
    accentColor: '#f43f5e',
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Velvet',
    tagline: 'Deep indigo & mystic sapphire elegance',
    primaryGlow: '#3b82f6',
    secondaryGlow: '#6366f1',
    orbGradient: ['#1e1b4b', '#4f46e5', '#38bdf8'],
    accentColor: '#818cf8',
  },
  neon_sunset: {
    id: 'neon_sunset',
    name: 'Neon Sunset',
    tagline: 'Hot magenta, amber flame & dusk coral',
    primaryGlow: '#f97316',
    secondaryGlow: '#f43f5e',
    orbGradient: ['#fb923c', '#e11d48', '#8b5cf6'],
    accentColor: '#f97316',
  },
  emerald_matrix: {
    id: 'emerald_matrix',
    name: 'Emerald Matrix',
    tagline: 'Bioluminescent cyber green & mint brilliance',
    primaryGlow: '#10b981',
    secondaryGlow: '#06b6d4',
    orbGradient: ['#059669', '#10b981', '#2dd4bf'],
    accentColor: '#10b981',
  },
};

export interface ToolCallExecution {
  id: string;
  toolName: string;
  args: Record<string, any>;
  timestamp: number;
  result?: any;
}

export interface ActiveTimer {
  id: string;
  label: string;
  durationSeconds: number;
  remainingSeconds: number;
  createdAt: number;
}

export interface OpenedLinkAction {
  id: string;
  url: string;
  targetName: string;
  timestamp: number;
}

export interface LiveTranscriptItem {
  id: string;
  speaker: 'user' | 'riya';
  text: string;
  isInterim?: boolean;
  timestamp: number;
}
