import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import TopHeader from "@/components/TopHeader";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Check } from "lucide-react";
import { getCategoryStyle, type MeditationItem } from "@/lib/meditation-data";

export default function MeditationPlayer() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const meditationId = parseInt(params.id || "1");
  const { data: meditations = [] } = useQuery<MeditationItem[]>({
    queryKey: ["/api/meditations"],
  });
  const meditation = meditations.find((m) => m.id === meditationId) || meditations[0] || {
    id: meditationId,
    title: "Meditation",
    durationMin: 5,
    category: "Focus",
    description: "",
    audioUrl: null,
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAudio = !!meditation.audioUrl;

  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Total length: prefer the real audio duration once known, otherwise fall
  // back to the configured minutes (also used for the silent-timer mode).
  const totalSeconds = hasAudio && audioDuration > 0
    ? Math.round(audioDuration)
    : meditation.durationMin * 60;

  const catStyle = getCategoryStyle(meditation.category);

  const completeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/meditation/sessions", {
        meditationTitle: meditation.title,
        category: meditation.category,
        durationSeconds: Math.max(elapsed, 1),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meditation/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meditation/sessions"] });
      setCompleted(true);
      toast({
        title: "Meditation complete",
        description: `Well done! You completed ${meditation.title}.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save meditation session.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  // Silent-timer mode: only run the interval when there is no audio to drive
  // progress. When audio is present, the <audio> element's timeupdate events
  // update `elapsed` instead.
  useEffect(() => {
    if (hasAudio) return;
    if (isPlaying && elapsed < totalSeconds) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev + 1 >= totalSeconds) {
            setIsPlaying(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return totalSeconds;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, elapsed, totalSeconds, hasAudio]);

  // Keep the audio element in sync when the meditation changes.
  useEffect(() => {
    setIsPlaying(false);
    setElapsed(0);
    setCompleted(false);
    setAudioDuration(0);
  }, [meditationId]);

  const togglePlay = useCallback(() => {
    if (elapsed >= totalSeconds && totalSeconds > 0) return;
    if (hasAudio && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => {
          toast({ title: "Playback error", description: "Could not play this audio.", variant: "destructive" });
        });
      } else {
        audioRef.current.pause();
      }
      return;
    }
    setIsPlaying((prev) => !prev);
  }, [elapsed, totalSeconds, hasAudio, toast]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setElapsed(0);
    setCompleted(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (hasAudio && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [hasAudio]);

  const progress = totalSeconds > 0 ? Math.min(elapsed / totalSeconds, 1) : 0;
  const remaining = Math.max(totalSeconds - elapsed, 0);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference * (1 - progress);

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader title={meditation.title} onBack={() => navigate("/recovery/mindfulness")} />

      {hasAudio && (
        <audio
          ref={audioRef}
          src={meditation.audioUrl || undefined}
          preload="metadata"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setAudioDuration(d);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={(e) => setElapsed(Math.floor(e.currentTarget.currentTime))}
          onEnded={() => {
            setIsPlaying(false);
            setElapsed(totalSeconds);
          }}
        />
      )}

      <div className="px-5 pt-20 pb-6">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <span
              className="inline-block text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full mb-3"
              style={{ color: catStyle.color, backgroundColor: catStyle.bg }}
            >
              {meditation.category}
            </span>
            <h1 className="text-2xl font-bold text-foreground mb-2">{meditation.title}</h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              {meditation.description}
            </p>
          </div>

          <div className="flex justify-center mb-10">
            <div className="relative w-[280px] h-[280px] flex items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 280 280">
                <circle
                  cx="140" cy="140" r="120"
                  fill="none"
                  stroke="currentColor"
                  className="text-border/30"
                  strokeWidth="6"
                />
                <circle
                  cx="140" cy="140" r="120"
                  fill="none"
                  stroke={catStyle.color}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>

              <div className="text-center z-10">
                {completed ? (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: catStyle.bg }}>
                      <Check className="h-8 w-8" style={{ color: catStyle.color }} />
                    </div>
                    <p className="text-lg font-bold text-foreground">Complete</p>
                  </div>
                ) : (
                  <>
                    <p className="text-5xl font-bold text-foreground tabular-nums tracking-tight">
                      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 uppercase tracking-wider">
                      {elapsed === 0 ? "ready" : isPlaying ? "in progress" : "paused"}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {!completed && (
            <div className="flex items-center justify-center gap-4 mb-8">
              <button
                onClick={reset}
                className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
              >
                <RotateCcw className="h-5 w-5" />
              </button>

              <button
                onClick={togglePlay}
                className="w-16 h-16 rounded-full flex items-center justify-center text-white transition-all active:scale-95"
                style={{ backgroundColor: catStyle.color }}
              >
                {isPlaying ? (
                  <Pause className="h-7 w-7" />
                ) : (
                  <Play className="h-7 w-7 ml-1" />
                )}
              </button>

              <div className="w-12 h-12" />
            </div>
          )}

          {elapsed > 0 && !completed && (
            <Button
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              className="w-full h-12 text-base font-semibold"
              style={{ backgroundColor: catStyle.color }}
            >
              {completeMutation.isPending ? "Saving..." : "Complete Meditation"}
            </Button>
          )}

          {completed && (
            <Button
              onClick={() => navigate("/recovery/mindfulness")}
              className="w-full h-12 text-base font-semibold bg-[#0cc9a9] hover:bg-[#0cc9a9]/90"
            >
              Back to Mindfulness Tools
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
