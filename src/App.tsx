import React, { useState, useEffect, useRef, useTransition } from 'react';
import { AssistantState, ActionLogItem } from './types/assistant';
import { LiveClient } from './services/liveClient';
import { ArushiOrb } from './components/ArushiOrb';
import { ActionCard } from './components/ActionCard';
import { DiagnosticPanel } from './components/DiagnosticPanel';
import { ContactManagerModal } from './components/ContactManagerModal';
import {
  Mic,
  MicOff,
  Volume2,
  Terminal,
  Users,
  Sparkles,
  AlertCircle,
  Radio,
  Globe,
  CheckCircle2,
} from 'lucide-react';

export default function App() {
  const [state, setState] = useState<AssistantState>('IDLE');
  const [micVolume, setMicVolume] = useState<number>(0);
  const [voiceVolume, setVoiceVolume] = useState<number>(0);
  const [currentAction, setCurrentAction] = useState<ActionLogItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [isContactsOpen, setIsContactsOpen] = useState(false);
  const [audioContextState, setAudioContextState] = useState<string>('suspended');
  const [speakerTestSuccess, setSpeakerTestSuccess] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<{ text: string; isUser: boolean } | null>(null);

  const clientRef = useRef<LiveClient | null>(null);

  useEffect(() => {
    const client = new LiveClient({
      onStateChange: (newState) => {
        setState(newState);
        if (newState !== 'ERROR') {
          setErrorMessage(null);
        }
      },
      onMicVolumeChange: (vol) => {
        setMicVolume(vol);
      },
      onVoiceVolumeChange: (vol) => {
        setVoiceVolume(vol);
      },
      onActionTriggered: (actionItem) => {
        setCurrentAction({ ...actionItem });
        if (actionItem.status === 'success') {
          setTimeout(() => {
            setCurrentAction(null);
          }, 6000);
        }
      },
      onError: (err) => {
        setErrorMessage(err);
      },
      onTranscript: (text, isUser) => {
        setLastTranscript({ text, isUser });
      },
    });

    clientRef.current = client;

    return () => {
      client.disconnect();
    };
  }, []);

  const handleTogglePower = async () => {
    if (!clientRef.current) return;

    if (state === 'IDLE' || state === 'ERROR') {
      try {
        setErrorMessage(null);
        await clientRef.current.connect();
        setAudioContextState('running');
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to start assistant');
      }
    } else {
      clientRef.current.disconnect();
      setAudioContextState('closed');
    }
  };

  const handleTestSpeaker = async (): Promise<boolean> => {
    if (!clientRef.current) return false;
    const ok = await clientRef.current.testSpeaker();
    if (ok) {
      setSpeakerTestSuccess(true);
      setTimeout(() => setSpeakerTestSuccess(false), 3000);
    }
    return ok;
  };

  const getStateDescription = () => {
    switch (state) {
      case 'CONNECTING':
        return 'Connecting to Gemini Live...';
      case 'LISTENING':
        return 'Listening to you... Speak naturally in any language!';
      case 'SPEAKING':
        return 'Arushi is speaking... (tap or speak to interrupt)';
      case 'PROCESSING':
        return 'Executing device action...';
      case 'ERROR':
        return errorMessage || 'Something went wrong. Tap to retry.';
      case 'IDLE':
      default:
        return 'Tap the microphone button to start voice conversation.';
    }
  };

  const supportedLanguages = [
    { name: 'Hindi', native: 'हिन्दी' },
    { name: 'English', native: 'English' },
    { name: 'Hinglish', native: 'Hinglish' },
    { name: 'Marathi', native: 'मराठी' },
    { name: 'Gujarati', native: 'ગુજરાતી' },
    { name: 'Bengali', native: 'বাংলা' },
    { name: 'Tamil', native: 'தமிழ்' },
    { name: 'Telugu', native: 'తెలుగు' },
    { name: 'Kannada', native: 'ಕನ್ನಡ' },
    { name: 'Malayalam', native: 'മലയാളം' },
    { name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
    { name: 'Urdu', native: 'اردو' },
  ];

  const suggestionPrompts = [
    '“Hello Arushi, kaise ho?”',
    '“WhatsApp kholo please”',
    '“Call Mom”',
    '“Rahul ko phone lagao”',
    '“Open YouTube”',
    '“Tell me a witty joke in Hinglish”',
  ];

  const isConnected = state === 'LISTENING' || state === 'SPEAKING' || state === 'PROCESSING';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500/30 font-sans antialiased overflow-hidden relative">
      {/* Background ambient light gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-indigo-900/20 via-purple-900/10 to-transparent rounded-full filter blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-gradient-to-t from-cyan-900/15 via-transparent to-transparent rounded-full filter blur-3xl pointer-events-none" />

      {/* Top Navigation Bar */}
      <header className="relative z-20 w-full max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between border-b border-slate-800/60 backdrop-blur-md">
        {/* Brand & Persona Tag */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-rose-500 to-amber-400 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            {isConnected && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-slate-950 animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">Arushi</h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-700/50 text-indigo-300">
                Live AI
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Voice-to-Voice Assistant · Multi-language · Actions
            </p>
          </div>
        </div>

        {/* Action / Tool Buttons */}
        <div className="flex items-center gap-2">
          {/* Speaker diagnostic test */}
          <button
            onClick={handleTestSpeaker}
            title="Speaker Diagnostic Test (Plays 440Hz tone)"
            className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
          >
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">
              {speakerTestSuccess ? 'Tone OK' : 'Test Speaker'}
            </span>
          </button>

          {/* Contacts Drawer Button */}
          <button
            onClick={() => setIsContactsOpen(true)}
            title="View Device Contacts"
            className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
          >
            <Users className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Contacts</span>
          </button>

          {/* Diagnostic Drawer Button */}
          <button
            onClick={() => setIsDiagnosticOpen(true)}
            title="Pipeline & Audio Diagnostics"
            className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
          >
            <Terminal className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Diagnostics</span>
          </button>
        </div>
      </header>

      {/* Main Voice Center View */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-6 max-w-xl mx-auto w-full">
        {/* Error notification banner if any */}
        {errorMessage && (
          <div className="w-full mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-200 text-xs flex items-center justify-between gap-2 shadow-lg animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => handleTogglePower()}
              className="px-2.5 py-1 rounded bg-rose-800 hover:bg-rose-700 text-white font-medium text-[11px] transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Active Action Feedback Card */}
        {currentAction && (
          <div className="w-full mb-4">
            <ActionCard action={currentAction} onDismiss={() => setCurrentAction(null)} />
          </div>
        )}

        {/* Central Arushi Holographic Orb */}
        <div className="my-auto flex flex-col items-center justify-center">
          <div
            onClick={handleTogglePower}
            className="cursor-pointer group relative focus:outline-none"
            title={isConnected ? 'Tap to pause' : 'Tap to speak with Arushi'}
          >
            <ArushiOrb state={state} micVolume={micVolume} voiceVolume={voiceVolume} />
          </div>

          {/* State Text & Feedback */}
          <div className="mt-6 text-center max-w-sm px-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-medium mb-2 shadow-inner">
              <span
                className={`w-2 h-2 rounded-full ${
                  state === 'SPEAKING'
                    ? 'bg-rose-400 animate-ping'
                    : state === 'LISTENING'
                    ? 'bg-cyan-400 animate-pulse'
                    : state === 'CONNECTING'
                    ? 'bg-amber-400 animate-spin'
                    : state === 'PROCESSING'
                    ? 'bg-purple-400 animate-bounce'
                    : 'bg-slate-500'
                }`}
              />
              <span className="text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                {state}
              </span>
            </div>

            <p className="text-sm font-medium text-slate-200 min-h-[40px] flex items-center justify-center">
              {getStateDescription()}
            </p>

            {/* Optional subtle transcript snippet */}
            {lastTranscript && isConnected && (
              <div className="mt-2 text-xs text-slate-400 bg-slate-900/60 border border-slate-800/80 rounded-lg px-3 py-1.5 max-w-xs mx-auto truncate">
                <span className="font-semibold text-slate-300">
                  {lastTranscript.isUser ? 'You: ' : 'Arushi: '}
                </span>
                {lastTranscript.text}
              </div>
            )}
          </div>
        </div>

        {/* Primary Microphone / Power Button */}
        <div className="mt-auto mb-4 flex flex-col items-center gap-3">
          <button
            onClick={handleTogglePower}
            className={`relative p-5 rounded-full transition-all duration-300 transform active:scale-95 shadow-2xl focus:outline-none ${
              isConnected
                ? 'bg-gradient-to-tr from-rose-600 to-rose-500 text-white shadow-rose-600/40 ring-4 ring-rose-500/20'
                : state === 'CONNECTING'
                ? 'bg-amber-600 text-white shadow-amber-600/30 animate-pulse'
                : 'bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-indigo-600/40 hover:from-indigo-500 hover:to-violet-400'
            }`}
            aria-label={isConnected ? 'Disconnect' : 'Connect microphone'}
          >
            {isConnected ? (
              <MicOff className="w-8 h-8" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </button>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
            {isConnected ? 'Tap to Mute / Stop' : 'Tap to Talk'}
          </span>
        </div>
      </main>

      {/* Suggestion Prompts Bar */}
      <footer className="relative z-20 w-full max-w-4xl mx-auto px-4 pb-4">
        {/* Suggestion prompts */}
        <div className="w-full mb-3">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 text-center">
            Try saying out loud:
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {suggestionPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (clientRef.current && state === 'IDLE') {
                    handleTogglePower();
                  }
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Supported Languages indicator */}
        <div className="border-t border-slate-800/80 pt-3 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1 font-semibold text-indigo-300">
            <Globe className="w-3.5 h-3.5" /> Auto-Language:
          </span>
          {supportedLanguages.map((lang, idx) => (
            <span key={lang.name} className="hover:text-slate-200 transition-colors">
              {lang.name}
              {idx < supportedLanguages.length - 1 && (
                <span className="text-slate-600 ml-2">·</span>
              )}
            </span>
          ))}
        </div>
      </footer>

      {/* Diagnostic & Logs Drawer Modal */}
      <DiagnosticPanel
        isOpen={isDiagnosticOpen}
        onClose={() => setIsDiagnosticOpen(false)}
        onTestSpeaker={handleTestSpeaker}
        audioContextState={audioContextState}
      />

      {/* Device Contacts Manager Modal */}
      <ContactManagerModal
        isOpen={isContactsOpen}
        onClose={() => setIsContactsOpen(false)}
        onSelectContactToCall={(contact) => {
          window.location.href = `tel:${contact.phone}`;
        }}
      />
    </div>
  );
}
