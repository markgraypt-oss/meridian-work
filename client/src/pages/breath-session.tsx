import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useBreathAudio, type AudioCueType } from "@/hooks/useBreathAudio";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { X, Pause, Play, SkipForward, Volume2, VolumeX, Settings } from "lucide-react";
import type { BreathTechnique } from "@shared/schema";

type Phase = 'inhale' | 'holdIn' | 'exhale' | 'holdOut' | 'ready' | 'complete';

const phaseLabels: Record<Phase, string> = {
  ready: 'Get Ready',
  inhale: 'Inhale',
  holdIn: 'Hold',
  exhale: 'Exhale',
  holdOut: 'Hold',
  complete: 'Complete',
};

const phaseColors: Record<Phase, { bg: string; text: string }> = {
  ready: { bg: 'from-gray-600 to-gray-700', text: 'text-white' },
  inhale: { bg: 'from-emerald-400 to-teal-500', text: 'text-white' },
  holdIn: { bg: 'from-blue-400 to-indigo-500', text: 'text-white' },
  exhale: { bg: 'from-orange-400 to-red-500', text: 'text-white' },
  holdOut: { bg: 'from-purple-400 to-violet-500', text: 'text-white' },
  complete: { bg: 'from-green-500 to-emerald-600', text: 'text-white' },
};

export default function BreathSession() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { slug } = useParams<{ slug: string }>();
  
  const searchParams = new URLSearchParams(window.location.search);
  const targetRounds = parseInt(searchParams.get('rounds') || '4');
  
  const [phase, setPhase] = useState<Phase>('ready');
  const [phaseTimeLeft, setPhaseTimeLeft] = useState(3);
  const [phaseDuration, setPhaseDuration] = useState(3);
  const [currentRound, setCurrentRound] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [circleScale, setCircleScale] = useState(0.6);
  const [showSettings, setShowSettings] = useState(false);
  
  const [audioEnabled, setAudioEnabled] = useState(() => {
    const saved = localStorage.getItem('breathwork_audio_enabled');
    return saved !== null ? saved === 'true' : true;
  });
  const [audioVolume, setAudioVolume] = useState(() => {
    const saved = localStorage.getItem('breathwork_audio_volume');
    return saved !== null ? parseInt(saved) : 70;
  });
  
  const animationRef = useRef<number>();
  const lastTickRef = useRef<number>(Date.now());
  const startTimeRef = useRef<number>(Date.now());
  const prevPhaseRef = useRef<Phase | null>(null);
  
  const { playCue, stopAudio } = useBreathAudio({ enabled: audioEnabled, volume: audioVolume });
  
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 1.0;

  const { data: technique, isLoading } = useQuery<BreathTechnique>({
    queryKey: ['/api/breathwork/techniques', slug],
    queryFn: async () => {
      const res = await fetch(`/api/breathwork/techniques/${slug}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch technique');
      return res.json();
    },
    enabled: isAuthenticated && !!slug,
  });

  const saveSessionMutation = useMutation({
    mutationFn: async (data: { durationSeconds: number; roundsCompleted: number }) => {
      return apiRequest('POST', '/api/breathwork/sessions', {
        techniqueId: technique?.id,
        durationSeconds: data.durationSeconds,
        roundsCompleted: data.roundsCompleted,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/breathwork/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/breathwork/stats'] });
    },
  });

  useEffect(() => {
    localStorage.setItem('breathwork_audio_enabled', String(audioEnabled));
  }, [audioEnabled]);

  useEffect(() => {
    localStorage.setItem('breathwork_audio_volume', String(audioVolume));
  }, [audioVolume]);

  const getAudioCueForPhase = useCallback((phaseType: Phase, techniqueSlug?: string): AudioCueType | null => {
    if (phaseType === 'complete') return null;
    if (phaseType === 'ready') return 'ready';
    
    const isHyperventilation = techniqueSlug?.includes('hyperventilation') || techniqueSlug?.includes('cyclic');
    
    if (phaseType === 'inhale') {
      if (isHyperventilation) return 'inhale_sharp';
      return 'inhale';
    }
    if (phaseType === 'exhale') {
      if (isHyperventilation) return 'exhale_passive';
      return 'exhale';
    }
    if (phaseType === 'holdIn') {
      if (isHyperventilation) return 'prepare_hold';
      return 'hold';
    }
    if (phaseType === 'holdOut') {
      if (isHyperventilation) return 'release';
      return 'hold';
    }
    return null;
  }, []);

  useEffect(() => {
    if (phase !== prevPhaseRef.current) {
      const cue = getAudioCueForPhase(phase, slug);
      if (cue) {
        playCue(cue);
      }
      prevPhaseRef.current = phase;
    }
  }, [phase, slug, playCue, getAudioCueForPhase]);

  const getPhaseSequence = useCallback(() => {
    if (!technique) return [];
    const seq: { phase: Phase; duration: number }[] = [];
    
    if (technique.inhaleSeconds > 0) seq.push({ phase: 'inhale', duration: technique.inhaleSeconds });
    if (technique.holdAfterInhaleSeconds > 0) seq.push({ phase: 'holdIn', duration: technique.holdAfterInhaleSeconds });
    if (technique.exhaleSeconds > 0) seq.push({ phase: 'exhale', duration: technique.exhaleSeconds });
    if (technique.holdAfterExhaleSeconds > 0) seq.push({ phase: 'holdOut', duration: technique.holdAfterExhaleSeconds });
    
    return seq;
  }, [technique]);

  const handleComplete = useCallback(() => {
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    saveSessionMutation.mutate({ 
      durationSeconds: duration, 
      roundsCompleted: currentRound 
    });
    navigate(`/recovery/breath-work/complete?technique=${slug}&rounds=${currentRound}&duration=${duration}`);
  }, [currentRound, navigate, saveSessionMutation, slug]);

  useEffect(() => {
    if (!technique || isPaused || phase === 'complete') return;

    const phaseSeq = getPhaseSequence();
    
    const tick = () => {
      const now = Date.now();
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      
      setTotalElapsed(prev => prev + delta);
      setPhaseTimeLeft(prev => {
        const newTime = prev - delta;
        
        if (newTime <= 0) {
          if (phase === 'ready') {
            const nextPhase = phaseSeq[0]?.phase || 'inhale';
            const nextDuration = phaseSeq[0]?.duration || 4;
            setPhase(nextPhase);
            setPhaseDuration(nextDuration);
            if (nextPhase === 'inhale') setCircleScale(MIN_SCALE);
            return nextDuration;
          }
          
          const currentIndex = phaseSeq.findIndex(p => p.phase === phase);
          const nextIndex = currentIndex + 1;
          
          if (nextIndex >= phaseSeq.length) {
            if (currentRound >= targetRounds) {
              setPhase('complete');
              handleComplete();
              return 0;
            }
            setCurrentRound(r => r + 1);
            const nextPhase = phaseSeq[0]?.phase || 'inhale';
            const nextDuration = phaseSeq[0]?.duration || 4;
            setPhase(nextPhase);
            setPhaseDuration(nextDuration);
            if (nextPhase === 'inhale') setCircleScale(MIN_SCALE);
            return nextDuration;
          } else {
            const nextPhase = phaseSeq[nextIndex].phase;
            const nextDuration = phaseSeq[nextIndex].duration;
            setPhase(nextPhase);
            setPhaseDuration(nextDuration);
            if (nextPhase === 'inhale') setCircleScale(MIN_SCALE);
            else if (nextPhase === 'exhale') setCircleScale(MAX_SCALE);
            return nextDuration;
          }
        }
        
        // Calculate smooth progress-based scale for current phase
        const phaseProgress = 1 - (newTime / phaseDuration);
        
        if (phase === 'inhale') {
          // Grow from MIN to MAX over the inhale duration
          const newScale = MIN_SCALE + (MAX_SCALE - MIN_SCALE) * phaseProgress;
          setCircleScale(newScale);
        } else if (phase === 'exhale') {
          // Shrink from MAX to MIN over the exhale duration
          const newScale = MAX_SCALE - (MAX_SCALE - MIN_SCALE) * phaseProgress;
          setCircleScale(newScale);
        }
        // Hold phases keep the current scale
        
        return newTime;
      });
      
      animationRef.current = requestAnimationFrame(tick);
    };

    lastTickRef.current = Date.now();
    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [technique, phase, isPaused, currentRound, targetRounds, phaseDuration, getPhaseSequence, handleComplete]);

  const handleClose = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    stopAudio();
    navigate("/recovery/breath-work");
  };

  const handleSkip = () => {
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    saveSessionMutation.mutate({ 
      durationSeconds: duration, 
      roundsCompleted: currentRound 
    });
    navigate(`/recovery/breath-work/complete?technique=${slug}&rounds=${currentRound}&duration=${duration}`);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#1a1a2e]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const colors = phaseColors[phase];
  const progressPercent = ((targetRounds - currentRound + 1) / targetRounds) * 100;

  return (
    <div className={`min-h-screen bg-gradient-to-b from-[#0f0f23] to-[#1a1a2e] flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="text-white/70 hover:text-white hover:bg-white/10"
          data-testid="btn-close-session"
        >
          <X className="w-6 h-6" />
        </Button>
        <div className="text-center">
          <p className="text-white/50 text-sm">{technique?.name}</p>
          <p className="text-white font-semibold">Round {currentRound} of {targetRounds}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSkip}
          className="text-white/70 hover:text-white hover:bg-white/10"
          data-testid="btn-skip-session"
        >
          <SkipForward className="w-6 h-6" />
        </Button>
      </div>

      {/* Progress Ring */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Outer ring progress */}
        <svg className="absolute w-72 h-72" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="2"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="2"
            strokeDasharray={`${progressPercent * 2.83} 283`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            className="transition-all duration-300"
          />
        </svg>

        {/* Breathing Circle */}
        <div 
          className={`w-56 h-56 rounded-full bg-gradient-to-br ${colors.bg} flex items-center justify-center shadow-2xl`}
          style={{ 
            transform: `scale(${circleScale})`,
            boxShadow: `0 0 60px rgba(255,255,255,0.2)`,
            transition: 'background 0.3s ease',
          }}
          data-testid="breathing-circle"
        >
          <div className="text-center">
            <p className={`text-4xl font-light ${colors.text} mb-2`}>
              {phaseLabels[phase]}
            </p>
            {phase !== 'complete' && (
              <p className={`text-6xl font-bold ${colors.text}`}>
                {Math.ceil(phaseTimeLeft)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="p-8 flex items-center justify-center gap-6">
        <Button
          variant="outline"
          size="icon"
          className="w-12 h-12 rounded-full border-white/30 bg-white/10 hover:bg-white/20"
          onClick={() => setShowSettings(true)}
          data-testid="btn-audio-settings"
        >
          {audioEnabled ? (
            <Volume2 className="w-5 h-5 text-white" />
          ) : (
            <VolumeX className="w-5 h-5 text-white/50" />
          )}
        </Button>
        
        <Button
          variant="outline"
          size="lg"
          className="w-16 h-16 rounded-full border-white/30 bg-white/10 hover:bg-white/20"
          onClick={() => setIsPaused(!isPaused)}
          data-testid="btn-pause-resume"
        >
          {isPaused ? (
            <Play className="w-8 h-8 text-white" />
          ) : (
            <Pause className="w-8 h-8 text-white" />
          )}
        </Button>
        
        <div className="w-12 h-12" />
      </div>

      {/* Total Time */}
      <div className="text-center pb-8">
        <p className="text-white/50 text-sm">
          Total time: {Math.floor(totalElapsed / 60)}:{String(Math.floor(totalElapsed % 60)).padStart(2, '0')}
        </p>
      </div>

      {/* Audio Settings Overlay */}
      {showSettings && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-50"
          onClick={() => setShowSettings(false)}
        >
          <div 
            className="bg-[#1a1a2e] border border-white/10 rounded-t-3xl w-full max-w-md p-6 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Audio Settings</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(false)}
                className="text-white/70 hover:text-white"
                data-testid="btn-close-settings"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-white/70" />
                <span className="text-white">Voice Cues</span>
              </div>
              <Switch
                checked={audioEnabled}
                onCheckedChange={setAudioEnabled}
                data-testid="switch-audio-enabled"
              />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-sm">Volume</span>
                <span className="text-white/70 text-sm">{audioVolume}%</span>
              </div>
              <Slider
                value={[audioVolume]}
                onValueChange={(value) => setAudioVolume(value[0])}
                min={0}
                max={100}
                step={5}
                disabled={!audioEnabled}
                className="w-full"
                data-testid="slider-audio-volume"
              />
            </div>
            
            <p className="text-white/50 text-xs text-center">
              Voice cues announce each breath phase to help guide your session
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
