import React, { useState, useEffect } from 'react';
import { DiagnosticLog } from '../types/assistant';
import { logger } from '../services/logger';
import { deviceActionBridge } from '../services/deviceActionBridge';
import { Volume2, Terminal, Shield, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';

interface DiagnosticPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onTestSpeaker: () => Promise<boolean>;
  audioContextState: string;
}

export const DiagnosticPanel: React.FC<DiagnosticPanelProps> = ({
  isOpen,
  onClose,
  onTestSpeaker,
  audioContextState,
}) => {
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [isTestingTone, setIsTestingTone] = useState(false);
  const [tonePlayed, setTonePlayed] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  useEffect(() => {
    const unsubscribe = logger.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const handleSpeakerTest = async () => {
    setIsTestingTone(true);
    setTonePlayed(false);
    const success = await onTestSpeaker();
    setIsTestingTone(false);
    if (success) {
      setTonePlayed(true);
      setTimeout(() => setTonePlayed(false), 3000);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (selectedFilter === 'ALL') return true;
    return log.category === selectedFilter;
  });

  const platformMode = deviceActionBridge.getPlatformMode();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl max-h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-base text-white">Audio & Pipeline Diagnostics</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Controls & Status Bar */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <span className="text-slate-400">AudioContext: </span>
              <span
                className={`font-semibold ${
                  audioContextState === 'running'
                    ? 'text-emerald-400'
                    : audioContextState === 'suspended'
                    ? 'text-amber-400'
                    : 'text-slate-400'
                }`}
              >
                {audioContextState.toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Environment: </span>
              <span className="font-semibold text-indigo-300">
                {platformMode === 'native' ? 'Android Native Bridge' : 'Standard Web Browser'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Speaker diagnostic test button */}
            <button
              onClick={handleSpeakerTest}
              disabled={isTestingTone}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Volume2 className="w-4 h-4" />
              {isTestingTone ? 'Playing Tone...' : 'Test Speaker (440Hz)'}
            </button>
            {tonePlayed && (
              <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Tone Sent
              </span>
            )}
          </div>
        </div>

        {/* Filter tags & Clear button */}
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1 text-xs">
            {['ALL', 'LIVE', 'AUDIO_OUT', 'MIC', 'TOOL', 'ERROR'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedFilter(cat)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  selectedFilter === cat
                    ? 'bg-slate-700 text-white font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <button
            onClick={() => logger.clear()}
            className="text-xs text-slate-400 hover:text-rose-300 inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        </div>

        {/* Logs Feed */}
        <div className="flex-1 p-4 overflow-y-auto space-y-2 font-mono text-xs max-h-96 bg-slate-950/80">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No diagnostic logs recorded yet. Tap the microphone to begin.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const categoryColor: Record<string, string> = {
                LIVE: 'text-purple-400 border-purple-500/30',
                MIC: 'text-cyan-400 border-cyan-500/30',
                AUDIO_OUT: 'text-emerald-400 border-emerald-500/30',
                TOOL: 'text-amber-400 border-amber-500/30',
                ERROR: 'text-rose-400 border-rose-500/30',
              };

              return (
                <div
                  key={log.id}
                  className="p-2 rounded bg-slate-900/60 border border-slate-800/80 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={`font-bold px-1.5 py-0.5 rounded border ${categoryColor[log.category] || 'text-slate-400 border-slate-700'}`}>
                      {log.category}
                    </span>
                    <span className="text-slate-500">{log.timestamp}</span>
                  </div>
                  <div className="text-slate-200 mt-0.5">{log.message}</div>
                  {log.data !== undefined && (
                    <pre className="text-[10px] text-slate-400 bg-slate-950 p-1.5 rounded overflow-x-auto">
                      {typeof log.data === 'object' ? JSON.stringify(log.data, null, 2) : String(log.data)}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Gemini Model: gemini-3.1-flash-live-preview (24kHz PCM Native Audio)</span>
          <span className="text-slate-500">Total logs: {logs.length}</span>
        </div>
      </div>
    </div>
  );
};
