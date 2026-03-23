import { useCallback, useRef, useEffect } from 'react';

type AudioCueType = 
  | 'inhale' 
  | 'exhale' 
  | 'hold' 
  | 'inhale_sharp' 
  | 'exhale_passive' 
  | 'double_inhale'
  | 'prepare_hold'
  | 'release'
  | 'round_complete'
  | 'final_round'
  | 'ready';

const cueTexts: Record<AudioCueType, string> = {
  inhale: 'Inhale',
  exhale: 'Exhale',
  hold: 'Hold',
  inhale_sharp: 'Inhale sharply',
  exhale_passive: 'Exhale',
  double_inhale: 'Double inhale',
  prepare_hold: 'Prepare for breath hold',
  release: 'Release',
  round_complete: 'Round complete',
  final_round: 'Final round',
  ready: 'Get ready',
};

interface UseBreathAudioOptions {
  enabled: boolean;
  volume: number;
}

export function useBreathAudio({ enabled, volume }: UseBreathAudioOptions) {
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const lastCueRef = useRef<string>('');
  const lastCueTimeRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!enabled || !synthRef.current) return;

    const now = Date.now();
    if (text === lastCueRef.current && now - lastCueTimeRef.current < 500) {
      return;
    }
    lastCueRef.current = text;
    lastCueTimeRef.current = now;

    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = volume / 100;

    const voices = synthRef.current.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Karen'))
    ) || voices.find(v => v.lang.startsWith('en'));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    synthRef.current.speak(utterance);
  }, [enabled, volume]);

  const playCue = useCallback((cue: AudioCueType) => {
    const text = cueTexts[cue];
    if (text) {
      speak(text);
    }
  }, [speak]);

  const stopAudio = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
  }, []);

  return { playCue, stopAudio };
}

export type { AudioCueType };
