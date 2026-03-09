'use client';

/**
 * VoiceInput
 * Progressive enhancement voice input using the Web Speech API.
 * Returns null silently when SpeechRecognition is not available.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useYellowBrickStore } from './yellow-brick-store';

// ─── Web Speech API types (not in lib.dom.d.ts by default) ─────────────────

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

// ─── Feature detect ─────────────────────────────────────────────────────────

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (
    (w['SpeechRecognition'] as SpeechRecognitionConstructor | undefined) ??
    (w['webkitSpeechRecognition'] as SpeechRecognitionConstructor | undefined) ??
    null
  );
}

// ─── Waveform bars ───────────────────────────────────────────────────────────

function WaveformBars() {
  return (
    <span className="ml-1 inline-flex items-end gap-[2px]" aria-hidden="true">
      {([0, 1, 2] as const).map((i) => (
        <span
          key={i}
          className="block h-3 w-[3px] rounded-sm bg-brick-gold"
          style={{
            animation: `ybWave 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
          }}
        />
      ))}
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface VoiceInputProps {
  onTranscript: (text: string, isFinal: boolean) => void;
}

export function VoiceInput({ onTranscript }: VoiceInputProps) {
  const SpeechRecognition = getSpeechRecognition();
  const { isVoiceActive, setVoiceActive } = useYellowBrickStore();
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [isSupported] = useState(() => SpeechRecognition !== null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result !== undefined) {
          const alt = result[0];
          if (alt !== undefined) {
            if (result.isFinal) {
              finalTranscript += alt.transcript;
            } else {
              interimTranscript += alt.transcript;
            }
          }
        }
      }

      if (finalTranscript) {
        onTranscript(finalTranscript, true);
      } else if (interimTranscript) {
        onTranscript(interimTranscript, false);
      }
    };

    recognition.onerror = () => {
      setVoiceActive(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setVoiceActive(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setVoiceActive(true);
  }, [SpeechRecognition, onTranscript, setVoiceActive]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setVoiceActive(false);
  }, [setVoiceActive]);

  const handleToggle = useCallback(() => {
    if (isVoiceActive) {
      stopListening();
    } else {
      startListening();
    }
  }, [isVoiceActive, startListening, stopListening]);

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isVoiceActive ? 'Stop voice input' : 'Start voice input'}
      aria-pressed={isVoiceActive}
      className={cn(
        'flex items-center justify-center rounded-sm p-1 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick-gold focus-visible:ring-offset-1 focus-visible:ring-offset-deep-gray',
        isVoiceActive
          ? 'text-brick-gold'
          : 'text-soft-gray hover:text-light-gray',
      )}
      style={
        isVoiceActive
          ? { animation: 'ybMicPulse 1.5s ease-in-out infinite' }
          : undefined
      }
    >
      <Mic className="h-4 w-4" aria-hidden="true" />
      {isVoiceActive && <WaveformBars />}
    </button>
  );
}
