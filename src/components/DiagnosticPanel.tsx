import React from 'react';
import { User } from '../lib/firebase';
import { Activity, ShieldCheck, Database, Cpu, Mic, Volume2, Radio, X, AlertTriangle } from 'lucide-react';

export interface DiagnosticData {
  firebaseAuthConnected: boolean;
  firestoreConnected: boolean;
  geminiConfigLoaded: boolean;
  configVersion: number;
  geminiModel: string;
  liveSessionStatus: string;
  microphoneActive: boolean;
  chunksSent: number;
  chunksReceived: number;
  playbackActive: boolean;
  lastError?: string | null;
}

interface DiagnosticPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  data: DiagnosticData;
}

export const DiagnosticPanel: React.FC<DiagnosticPanelProps> = ({
  isOpen,
  onClose,
  currentUser,
  data,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed bottom-16 right-4 z-50 w-full max-w-sm rounded-2xl bg-slate-950/95 border border-slate-800 shadow-2xl p-4 text-xs font-mono text-slate-200 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2 text-violet-400 font-bold tracking-wider uppercase font-['Space_Grotesk'] text-xs">
          <Activity className="w-4 h-4 text-violet-400 animate-pulse" />
          <span>DEBUG // SYSTEM DIAGNOSTICS</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2 text-[11px]">
        {/* Firebase Auth */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <span className="flex items-center space-x-2 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Firebase Auth:</span>
          </span>
          <span className={`font-bold ${data.firebaseAuthConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
            {data.firebaseAuthConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>

        {/* Firestore */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <span className="flex items-center space-x-2 text-slate-400">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Firestore DB:</span>
          </span>
          <span className={`font-bold ${data.firestoreConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
            {data.firestoreConnected ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>

        {/* Gemini Config & Version */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <span className="flex items-center space-x-2 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-violet-400" />
            <span>Gemini Config:</span>
          </span>
          <span className="text-violet-300 font-semibold">
            v{data.configVersion || 1} &middot; {data.geminiConfigLoaded ? 'LOADED' : 'LOADING'}
          </span>
        </div>

        {/* Model */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <span className="text-slate-400">Active Model:</span>
          <span className="text-cyan-300 font-bold truncate max-w-[170px]" title={data.geminiModel}>
            {data.geminiModel || 'gemini-3.1-flash-live-preview'}
          </span>
        </div>

        {/* Live Session */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <span className="flex items-center space-x-2 text-slate-400">
            <Radio className="w-3.5 h-3.5 text-pink-400" />
            <span>Live Session:</span>
          </span>
          <span className={`font-bold ${data.liveSessionStatus !== 'disconnected' ? 'text-emerald-400' : 'text-slate-500'}`}>
            {data.liveSessionStatus.toUpperCase()}
          </span>
        </div>

        {/* Microphone */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <span className="flex items-center space-x-2 text-slate-400">
            <Mic className="w-3.5 h-3.5 text-emerald-400" />
            <span>Microphone:</span>
          </span>
          <span className={`font-bold ${data.microphoneActive ? 'text-emerald-400' : 'text-slate-500'}`}>
            {data.microphoneActive ? 'ACTIVE (PCM16 16kHz)' : 'INACTIVE'}
          </span>
        </div>

        {/* Audio Upload */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <span className="text-slate-400">Audio Upload:</span>
          <span className={`font-bold ${data.chunksSent > 0 ? 'text-cyan-300' : 'text-slate-500'}`}>
            {data.chunksSent > 0 ? `ACTIVE (${data.chunksSent} chunks)` : 'INACTIVE'}
          </span>
        </div>

        {/* Gemini Response */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <span className="text-slate-400">Gemini Response:</span>
          <span className={`font-bold ${data.chunksReceived > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {data.chunksReceived > 0 ? `RECEIVED (${data.chunksReceived} chunks)` : 'WAITING'}
          </span>
        </div>

        {/* Audio Playback */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <span className="flex items-center space-x-2 text-slate-400">
            <Volume2 className="w-3.5 h-3.5 text-pink-400" />
            <span>Audio Playback:</span>
          </span>
          <span className={`font-bold ${data.playbackActive ? 'text-pink-400' : 'text-slate-500'}`}>
            {data.playbackActive ? 'ACTIVE (24kHz WebAudio)' : 'IDLE'}
          </span>
        </div>
      </div>

      {data.lastError && (
        <div className="mt-3 p-2.5 rounded-xl bg-rose-950/70 border border-rose-800 text-[10px] text-rose-200 flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span className="leading-tight break-all">{data.lastError}</span>
        </div>
      )}
    </div>
  );
};
