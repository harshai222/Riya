import React, { useEffect, useRef } from 'react';
import { LiveSessionStatus, VibeConfig } from '../utils/sessionTypes';
import { Mic, MicOff, Power, Sparkles, Volume2 } from 'lucide-react';

interface RiyaCoreOrbProps {
  status: LiveSessionStatus;
  userVolume: number;
  riyaVolume: number;
  isMuted: boolean;
  vibe: VibeConfig;
  onToggleConnect: () => void;
  onToggleMute: () => void;
}

export const RiyaCoreOrb: React.FC<RiyaCoreOrbProps> = ({
  status,
  userVolume,
  riyaVolume,
  isMuted,
  vibe,
  onToggleConnect,
  onToggleMute,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);

  // Canvas visualizer loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = 440);
    let height = (canvas.height = 440);

    const render = () => {
      timeRef.current += 0.035;
      const t = timeRef.current;
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Determine active dynamic volume
      let activeVolume = 0;
      if (status === 'speaking') {
        activeVolume = Math.max(0.15, riyaVolume);
      } else if (status === 'listening') {
        activeVolume = Math.max(0.08, userVolume);
      } else if (status === 'connecting' || status === 'executing_tool') {
        activeVolume = 0.35 + Math.sin(t * 3) * 0.15;
      } else {
        // Disconnected gentle breathing
        activeVolume = 0.05 + Math.sin(t * 1.2) * 0.03;
      }

      // Base radius
      const baseRadius = 110 + activeVolume * 38;

      // 1. Draw outer energetic aura rings
      const ringCount = 3;
      for (let r = 0; r < ringCount; r++) {
        const ringOffset = (r + 1) * (26 + activeVolume * 22);
        const radius = baseRadius + ringOffset + Math.sin(t * 2 + r) * 6;
        const alpha = Math.max(0.04, (0.35 - r * 0.1) * (status === 'disconnected' ? 0.3 : 1));

        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.max(10, radius), 0, Math.PI * 2);
        ctx.strokeStyle = r % 2 === 0 ? vibe.primaryGlow : vibe.secondaryGlow;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1.5 + (ringCount - r);
        ctx.stroke();
      }

      // 2. Animated waveform / wave particle spikes
      const wavePoints = 64;
      ctx.beginPath();
      for (let i = 0; i <= wavePoints; i++) {
        const angle = (i / wavePoints) * Math.PI * 2;
        const waveSpeed = status === 'speaking' ? 4 : status === 'listening' ? 2.5 : 1;
        const noise =
          Math.sin(angle * 6 + t * waveSpeed) * (8 + activeVolume * 28) +
          Math.cos(angle * 4 - t * 2) * (5 + activeVolume * 15);
        const r = baseRadius + noise;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();

      // Outer wave gradient fill
      const waveGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.6,
        centerX,
        centerY,
        baseRadius + 40
      );
      waveGrad.addColorStop(0, `${vibe.orbGradient[0]}33`);
      waveGrad.addColorStop(0.7, `${vibe.orbGradient[1]}55`);
      waveGrad.addColorStop(1, `${vibe.orbGradient[2]}00`);

      ctx.fillStyle = waveGrad;
      ctx.globalAlpha = status === 'disconnected' ? 0.25 : 0.85;
      ctx.fill();

      ctx.strokeStyle = vibe.accentColor;
      ctx.globalAlpha = status === 'disconnected' ? 0.3 : 0.9;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 3. Inner high-glow core
      const coreGrad = ctx.createRadialGradient(
        centerX - baseRadius * 0.2,
        centerY - baseRadius * 0.2,
        baseRadius * 0.1,
        centerX,
        centerY,
        baseRadius
      );
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.2, vibe.orbGradient[0]);
      coreGrad.addColorStop(0.6, vibe.orbGradient[1]);
      coreGrad.addColorStop(1, '#05070e');

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.globalAlpha = status === 'disconnected' ? 0.5 : 0.95;
      ctx.fill();

      // 4. Subtle cyber orbit dots
      if (status !== 'disconnected') {
        const dotCount = 8;
        for (let d = 0; d < dotCount; d++) {
          const orbitAngle = t * 1.5 + (d * (Math.PI * 2)) / dotCount;
          const orbitDist = baseRadius * 1.15 + Math.sin(t * 3 + d) * 12;
          const dx = centerX + Math.cos(orbitAngle) * orbitDist;
          const dy = centerY + Math.sin(orbitAngle) * orbitDist;

          ctx.beginPath();
          ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.7;
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [status, userVolume, riyaVolume, vibe]);

  return (
    <div className="relative flex flex-col items-center justify-center select-none py-4">
      {/* Ambient background glow behind orb */}
      <div
        className="absolute w-[360px] h-[360px] rounded-full blur-[80px] opacity-45 pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(circle, ${vibe.primaryGlow} 0%, ${vibe.secondaryGlow} 50%, transparent 75%)`,
          transform: `scale(${
            status === 'speaking'
              ? 1.2 + riyaVolume * 0.5
              : status === 'listening'
              ? 1.1 + userVolume * 0.3
              : 0.95
          })`,
        }}
      />

      {/* Canvas Layer for Fluid Organic Soundwave */}
      <div className="relative w-[340px] h-[340px] sm:w-[420px] sm:h-[420px] flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Central Tactical Trigger / Mic Button */}
        <div className="relative z-10 flex flex-col items-center justify-center">
          <button
            onClick={onToggleConnect}
            type="button"
            aria-label={
              status === 'disconnected'
                ? 'Wake Riya Assistant'
                : 'Disconnect Riya Assistant'
            }
            className={`group relative flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 rounded-full cursor-pointer transition-all duration-300 shadow-2xl backdrop-blur-md active:scale-95 focus:outline-none focus:ring-4 ${
              status === 'disconnected'
                ? 'bg-slate-900/80 border-2 border-slate-700/80 hover:border-violet-500/80 hover:shadow-violet-600/30'
                : status === 'connecting'
                ? 'bg-slate-900/90 border-2 border-cyan-400 animate-pulse shadow-cyan-500/50'
                : status === 'speaking'
                ? 'bg-slate-950/90 border-2 border-pink-500 shadow-pink-500/60 shadow-[0_0_40px_rgba(236,72,153,0.5)]'
                : status === 'executing_tool'
                ? 'bg-slate-950/90 border-2 border-amber-400 shadow-amber-400/50 shadow-[0_0_35px_rgba(251,191,36,0.5)]'
                : 'bg-slate-950/90 border-2 border-violet-400 shadow-violet-500/50 shadow-[0_0_35px_rgba(139,92,246,0.4)]'
            }`}
          >
            {/* Inner dynamic ring animation */}
            <div
              className={`absolute inset-1.5 rounded-full border border-dashed transition-opacity duration-300 pointer-events-none ${
                status === 'disconnected'
                  ? 'border-slate-600/40 opacity-40'
                  : 'border-white/40 animate-spin opacity-80'
              }`}
              style={{ animationDuration: status === 'speaking' ? '6s' : '12s' }}
            />

            {/* Central Icon */}
            {status === 'disconnected' ? (
              <div className="flex flex-col items-center text-slate-300 group-hover:text-white transition-colors">
                <Power className="w-9 h-9 mb-1 text-violet-400 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold tracking-wider uppercase">
                  Wake
                </span>
              </div>
            ) : status === 'connecting' ? (
              <div className="flex flex-col items-center text-cyan-300">
                <div className="w-8 h-8 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin mb-1" />
                <span className="text-[10px] font-semibold tracking-widest uppercase">
                  Syncing
                </span>
              </div>
            ) : status === 'speaking' ? (
              <div className="flex flex-col items-center text-pink-300">
                <Volume2 className="w-9 h-9 animate-bounce text-pink-400 mb-1" />
                <span className="text-[10px] font-bold tracking-wider uppercase">
                  Riya
                </span>
              </div>
            ) : status === 'executing_tool' ? (
              <div className="flex flex-col items-center text-amber-300">
                <Sparkles className="w-9 h-9 animate-spin text-amber-400 mb-1" />
                <span className="text-[10px] font-bold tracking-wider uppercase">
                  Action
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center text-violet-300">
                <Mic className="w-9 h-9 text-violet-400 mb-1 animate-pulse" />
                <span className="text-[10px] font-bold tracking-wider uppercase">
                  Listening
                </span>
              </div>
            )}
          </button>

          {/* Quick mic mute toggle button when active */}
          {status !== 'disconnected' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMute();
              }}
              type="button"
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              className={`mt-4 px-3 py-1.5 rounded-full flex items-center space-x-1.5 text-xs font-semibold backdrop-blur-md border transition-all ${
                isMuted
                  ? 'bg-rose-950/80 text-rose-300 border-rose-500/60 shadow-lg shadow-rose-900/40'
                  : 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:text-white hover:border-slate-500'
              }`}
            >
              {isMuted ? (
                <>
                  <MicOff className="w-3.5 h-3.5 text-rose-400" />
                  <span>Mic Muted</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Mic Active</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Status Tagline */}
      <div className="mt-3 text-center px-4">
        <p className="text-sm font-medium text-slate-300">
          {status === 'disconnected' && (
            <span className="text-slate-400">
              Tap the orb to start live voice talk with <strong className="text-violet-400">Riya</strong>
            </span>
          )}
          {status === 'connecting' && (
            <span className="text-cyan-300 animate-pulse">
              Connecting real-time 16kHz audio session...
            </span>
          )}
          {status === 'listening' && (
            <span className="text-violet-300">
              {isMuted ? 'Microphone muted — unmute to speak' : 'Go ahead, talk to me... I’m all ears.'}
            </span>
          )}
          {status === 'speaking' && (
            <span className="text-pink-300 font-medium">
              Riya is speaking (tap orb to interrupt or stop)
            </span>
          )}
          {status === 'executing_tool' && (
            <span className="text-amber-300 font-medium">
              Executing browser action...
            </span>
          )}
        </p>
      </div>
    </div>
  );
};
