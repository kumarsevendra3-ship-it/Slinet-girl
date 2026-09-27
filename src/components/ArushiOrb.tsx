import React from 'react';
import { AssistantState } from '../types/assistant';

interface ArushiOrbProps {
  state: AssistantState;
  micVolume: number;
  voiceVolume: number;
}

export const ArushiOrb: React.FC<ArushiOrbProps> = ({
  state,
  micVolume,
  voiceVolume,
}) => {
  // Compute dynamic scale and aura intensities based on audio volume
  const isSpeaking = state === 'SPEAKING';
  const isListening = state === 'LISTENING';
  const isProcessing = state === 'PROCESSING';
  const isConnecting = state === 'CONNECTING';
  const isError = state === 'ERROR';

  // Volume factor between 1.0 and 1.35
  const voiceScale = isSpeaking ? 1 + voiceVolume * 0.4 : 1;
  const micScale = isListening ? 1 + micVolume * 0.35 : 1;
  const currentScale = Math.max(voiceScale, micScale);

  // Gradient configurations per state
  const getGlowStyles = () => {
    switch (state) {
      case 'SPEAKING':
        return {
          core: 'from-amber-300 via-rose-500 to-indigo-600',
          halo: 'rgba(244, 63, 94, 0.45)',
          outer: 'rgba(251, 191, 36, 0.35)',
        };
      case 'LISTENING':
        return {
          core: 'from-cyan-300 via-teal-400 to-indigo-600',
          halo: 'rgba(20, 184, 166, 0.45)',
          outer: 'rgba(6, 182, 212, 0.3)',
        };
      case 'PROCESSING':
        return {
          core: 'from-amber-400 via-orange-500 to-purple-600',
          halo: 'rgba(245, 158, 11, 0.5)',
          outer: 'rgba(249, 115, 22, 0.3)',
        };
      case 'CONNECTING':
        return {
          core: 'from-violet-400 via-fuchsia-500 to-indigo-700',
          halo: 'rgba(168, 85, 247, 0.4)',
          outer: 'rgba(139, 92, 246, 0.25)',
        };
      case 'ERROR':
        return {
          core: 'from-rose-500 via-red-600 to-neutral-900',
          halo: 'rgba(239, 68, 68, 0.4)',
          outer: 'rgba(185, 28, 28, 0.2)',
        };
      case 'IDLE':
      default:
        return {
          core: 'from-indigo-400 via-purple-500 to-slate-800',
          halo: 'rgba(99, 102, 241, 0.25)',
          outer: 'rgba(168, 85, 247, 0.15)',
        };
    }
  };

  const glow = getGlowStyles();

  return (
    <div className="relative flex items-center justify-center w-72 h-72 sm:w-80 sm:h-80 select-none">
      {/* Outer ambient soft pulse */}
      <div
        className="absolute rounded-full transition-all duration-300 ease-out filter blur-3xl opacity-70"
        style={{
          width: `${260 * currentScale}px`,
          height: `${260 * currentScale}px`,
          backgroundColor: glow.outer,
        }}
      />

      {/* Secondary resonant halo */}
      <div
        className="absolute rounded-full transition-all duration-200 ease-out filter blur-xl opacity-80"
        style={{
          width: `${200 * currentScale}px`,
          height: `${200 * currentScale}px`,
          backgroundColor: glow.halo,
        }}
      />

      {/* Orbiting cosmic ring in connecting / processing state */}
      {(isConnecting || isProcessing) && (
        <div className="absolute w-56 h-56 rounded-full border border-dashed border-white/30 animate-spin" style={{ animationDuration: '6s' }} />
      )}

      {/* Audio Reactive Waves for Listening */}
      {isListening && (
        <div
          className="absolute rounded-full border border-cyan-400/40 transition-transform duration-100"
          style={{
            width: `${170 + micVolume * 90}px`,
            height: `${170 + micVolume * 90}px`,
            opacity: 0.3 + micVolume * 0.7,
          }}
        />
      )}

      {/* Audio Reactive Waves for Speaking */}
      {isSpeaking && (
        <div
          className="absolute rounded-full border border-rose-400/50 transition-transform duration-100"
          style={{
            width: `${180 + voiceVolume * 100}px`,
            height: `${180 + voiceVolume * 100}px`,
            opacity: 0.4 + voiceVolume * 0.6,
          }}
        />
      )}

      {/* Core Glowing Orb */}
      <div
        className={`relative z-10 w-40 h-40 sm:w-44 sm:h-44 rounded-full bg-gradient-to-tr ${glow.core} shadow-2xl flex items-center justify-center transition-transform duration-150 ease-out overflow-hidden`}
        style={{
          transform: `scale(${currentScale})`,
          boxShadow: `0 0 50px 10px ${glow.halo}`,
        }}
      >
        {/* Inner light reflection / glass highlight */}
        <div className="absolute top-2 left-4 w-16 h-8 rounded-full bg-white/30 filter blur-sm transform -rotate-25" />
        <div className="absolute bottom-2 right-4 w-20 h-10 rounded-full bg-black/20 filter blur-sm" />

        {/* Dynamic center icon or state animation */}
        <div className="relative z-20 flex flex-col items-center justify-center text-white text-center px-2">
          {isSpeaking && (
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-1.5 bg-white rounded-full transition-all duration-75"
                  style={{
                    height: `${12 + Math.sin(Date.now() / 150 + i) * 8 + voiceVolume * 24}px`,
                  }}
                />
              ))}
            </div>
          )}

          {isListening && (
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-1.5 bg-cyan-100 rounded-full transition-all duration-75"
                  style={{
                    height: `${10 + Math.abs(Math.sin(Date.now() / 200 + i)) * 6 + micVolume * 26}px`,
                  }}
                />
              ))}
            </div>
          )}

          {isConnecting && (
            <div className="w-8 h-8 border-2 border-white/60 border-t-white rounded-full animate-spin" />
          )}

          {isProcessing && (
            <div className="text-xs font-semibold tracking-wider uppercase text-amber-100 animate-pulse">
              Action
            </div>
          )}

          {state === 'IDLE' && (
            <div className="w-4 h-4 rounded-full bg-white/70 animate-ping opacity-50" />
          )}

          {isError && (
            <div className="text-xs font-bold tracking-wide uppercase text-white">
              Retry
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
