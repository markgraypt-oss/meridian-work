import { useParams, useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  MoreVertical,
  Pencil,
  Trash2,
  Bookmark,
  Loader2,
  Trophy,
  Sparkles,
  MessageSquare,
  Dumbbell,
  Heart,
  Activity,
  Flame,
  ChevronRight,
  Star,
} from "lucide-react";
import { WorkoutCompletionView } from "@/components/training/WorkoutCompletionView";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface SetLog {
  id: number;
  setNumber: number;
  targetReps?: string;
  actualReps?: number;
  targetWeight?: number;
  actualWeight?: number;
  targetDuration?: string;
  actualDuration?: string;
  actualDurationMinutes?: number;
  actualDurationSeconds?: number;
  isCompleted: boolean;
  setDifficultyRating?: string;
  painFlag?: boolean;
  failureFlag?: boolean;
}

interface ExerciseLog {
  id: number;
  exerciseName: string;
  exerciseLibraryId?: number;
  blockType?: string;
  blockGroupId?: string;
  section?: string;
  position: number;
  restPeriod?: string;
  durationType?: string;
  exerciseType?: string;
  targetDuration?: string;
  targetReps?: string;
  sets: SetLog[];
}

interface WorkoutLogData {
  id: number;
  workoutName: string;
  workoutType: string;
  startedAt: string;
  completedAt: string;
  duration?: number;
  workoutRating?: number;
  autoCalculatedVolume?: number;
  autoCalculatedTime?: number;
  notes?: string;
  exercises: ExerciseLog[];
  coverImageUrl?: string | null;
  category?: string | null;
  aiReviewText?: string | null;
  aiReviewedAt?: string | null;
}

interface PrItem {
  type: 'weight' | 'reps' | 'volume' | 'first';
  exerciseName: string;
  value?: number;
  previous?: number;
  reps?: number;
  weight?: number;
}

interface SessionCompletionData {
  summary: {
    totalVolume?: number;
    totalTimeSeconds?: number;
    durationSeconds?: number;
    exerciseCount?: number;
    workoutRating?: number;
  } | null;
  prs: PrItem[];
}

function effortColours(rating: number): { bg: string; text: string; label: string } {
  if (rating <= 3) return { bg: '#16a34a', text: '#ffffff', label: 'Easy' };
  if (rating <= 6) return { bg: '#0cc9a9', text: '#0e1114', label: 'Solid' };
  return { bg: '#dc2626', text: '#ffffff', label: 'Hard' };
}

function formatVolume(kg: number): string {
  if (!kg || kg <= 0) return '0 kg';
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  return `${Math.round(kg)} kg`;
}

function formatLength(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 min';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  }
  if (mins > 0) return `${mins} min`;
  return `${secs} sec`;
}

function categoryFallbackGradient(category?: string | null): string {
  switch ((category || '').toLowerCase()) {
    case 'strength':
      return 'linear-gradient(135deg, #1a1f24 0%, #0cc9a9 120%)';
    case 'cardio':
      return 'linear-gradient(135deg, #1a1f24 0%, #f97316 120%)';
    case 'hiit':
      return 'linear-gradient(135deg, #1a1f24 0%, #dc2626 120%)';
    case 'mobility':
    case 'recovery':
      return 'linear-gradient(135deg, #1a1f24 0%, #6366f1 120%)';
    default:
      return 'linear-gradient(135deg, #1a1f24 0%, #0cc9a9 120%)';
  }
}

function categoryIcon(category?: string | null) {
  const c = (category || '').toLowerCase();
  if (c === 'cardio') return Activity;
  if (c === 'hiit') return Flame;
  if (c === 'mobility' || c === 'recovery') return Heart;
  return Dumbbell;
}

export default function WorkoutLogView() {
  const { logId } = useParams<{ logId: string }>();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const { formatDate } = useFormattedDate();
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditMode, setShowEditMode] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [workoutName, setWorkoutName] = useState("");

  const urlParams = new URLSearchParams(searchString);
  const sourceParam = urlParams.get('source');
  const enrollmentIdParam = urlParams.get('enrollmentId');
  const justCompleted = urlParams.get('justCompleted') === '1';

  // Pull session-only completion data (PRs + summary) once on mount, then clear it
  const [sessionData, setSessionData] = useState<SessionCompletionData | null>(null);
  useEffect(() => {
    if (!logId) return;
    if (!justCompleted) return;
    try {
      const raw = sessionStorage.getItem(`workout-completion-${logId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as SessionCompletionData;
        setSessionData(parsed);
        // Don't clear immediately — let it survive a single refresh in case the user re-renders
      }
    } catch {
      // ignore
    }
  }, [logId, justCompleted]);

  const handleBack = () => {
    if (justCompleted) {
      navigate('/');
      return;
    }
    if (sourceParam === 'home') {
      navigate('/');
    } else if (sourceParam === 'programme-history' && enrollmentIdParam) {
      navigate(`/programme-history/${enrollmentIdParam}`);
    } else {
      navigate('/progress/workouts');
    }
  };

  const { data: workoutLog, isLoading, refetch } = useQuery<WorkoutLogData>({
    queryKey: [`/api/workout-logs/${logId}`],
    enabled: !!logId,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/workout-logs/${logId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress/workouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Workout deleted" });
      handleBack();
    },
    onError: () => {
      toast({ title: "Failed to delete workout", variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest('POST', `/api/workout-logs/${logId}/save`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/mine"] });
      toast({ title: "Workout saved to your library" });
      setShowSaveDialog(false);
      setWorkoutName("");
    },
    onError: () => {
      toast({ title: "Failed to save workout", variant: "destructive" });
    },
  });

  // AI review state — local (not query) so we can show the spinner inline
  const [aiReview, setAiReview] = useState<string | null>(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [aiReviewError, setAiReviewError] = useState<string | null>(null);

  // Hydrate from server-cached review on first load
  useEffect(() => {
    if (workoutLog?.aiReviewText && !aiReview) {
      setAiReview(workoutLog.aiReviewText);
    }
  }, [workoutLog?.aiReviewText]);

  const requestAiReview = async () => {
    if (!logId) return;
    setAiReviewLoading(true);
    setAiReviewError(null);
    try {
      const res = await apiRequest('POST', `/api/workout-logs/${logId}/ai-review`, {});
      const data = await res.json();
      setAiReview(data?.text || '');
    } catch (err: any) {
      setAiReviewError(err?.message || 'Could not generate the review. Try again in a moment.');
    } finally {
      setAiReviewLoading(false);
    }
  };

  const openCoachWithContext = () => {
    if (!workoutLog) return;
    try {
      const lengthMin = Math.round((lengthSeconds || 0) / 60);
      const exerciseLines = (workoutLog.exercises || [])
        .slice(0, 12)
        .map((ex: ExerciseLog) => {
          const sets = (ex.sets || []).length;
          const completed = (ex.sets || []).filter((s: any) => s?.completed).length;
          return `- ${ex.exerciseName}: ${completed}/${sets} sets`;
        })
        .join('\n');
      const prLines = realPRs
        .map((pr: PrItem) => `- ${pr.exerciseName}: new ${pr.type} PR (${pr.value})`)
        .join('\n');
      const reviewBlock = aiReview ? `\n\nAuto-generated review:\n${aiReview}` : '';
      const notesBlock = workoutLog.notes ? `\n\nUser notes:\n${workoutLog.notes}` : '';
      const summaryText =
        `Workout: ${workoutLog.workoutName}\n` +
        `Duration: ${lengthMin} min\n` +
        `Volume: ${Math.round(volumeKg)} kg\n` +
        `Effort rating: ${rating}/10\n` +
        `Exercises (${exerciseCount}):\n${exerciseLines || '- none recorded'}` +
        (prLines ? `\n\nPersonal records hit:\n${prLines}` : '') +
        notesBlock +
        reviewBlock;

      const openingMessage = `Nice work finishing ${workoutLog.workoutName}. I've got the full session in front of me. What would you like to dig into - pacing, load progression, recovery, or something else?`;

      sessionStorage.setItem(
        'coach-seed-context',
        JSON.stringify({
          kind: 'post_workout',
          workoutLogId: workoutLog.id,
          summaryText,
          openingMessage,
          ts: Date.now(),
        })
      );
    } catch {
      // ignore
    }
    // Fire a window event so the App-level CoachChat can open itself
    window.dispatchEvent(new CustomEvent('open-coach', { detail: { workoutLogId: workoutLog.id } }));
  };

  const handleDeleteConfirm = () => {
    setShowDeleteDialog(false);
    deleteMutation.mutate();
  };

  const handleEditLog = () => {
    setShowActionSheet(false);
    setShowEditMode(true);
  };

  const handleEditComplete = () => {
    setShowEditMode(false);
    refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/workout-logs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/progress/workouts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
  };

  const handleSaveWorkout = () => {
    if (workoutName.trim().length === 0) return;
    saveMutation.mutate(workoutName.trim());
  };

  const isCustomWorkout = workoutLog?.workoutType === 'custom';

  // Derived values for the summary header
  const realPRs: PrItem[] = useMemo(() => {
    return (sessionData?.prs || []).filter(pr => pr.type !== 'first');
  }, [sessionData]);

  const lengthSeconds = sessionData?.summary?.durationSeconds ?? workoutLog?.duration ?? 0;
  const volumeKg = sessionData?.summary?.totalVolume ?? workoutLog?.autoCalculatedVolume ?? 0;
  const rating = sessionData?.summary?.workoutRating ?? workoutLog?.workoutRating ?? 0;
  const exerciseCount = sessionData?.summary?.exerciseCount ?? workoutLog?.exercises?.length ?? 0;
  const effort = effortColours(rating || 0);
  const HeroIcon = categoryIcon(workoutLog?.category);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Skeleton className="h-6 w-24" />
              <div className="w-10" />
            </div>
          </div>
        </div>
        <div className="px-4 py-6 space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!workoutLog) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Workout log not found</p>
          <Button variant="ghost" onClick={handleBack} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const completedDate = workoutLog.completedAt
    ? formatDate(new Date(workoutLog.completedAt), 'short')
    : '';

  // Volume gauge: scale 0..100% against a soft target so the arc has meaning even at low loads
  const volumeTarget = 10000; // kg, just a reference for visual fill
  const volumePct = Math.min(1, (volumeKg || 0) / volumeTarget);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero (image first, no top app bar) */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          height: '280px',
          background: workoutLog.coverImageUrl ? '#0e1114' : categoryFallbackGradient(workoutLog.category),
        }}
        data-testid="hero-summary"
      >
        {workoutLog.coverImageUrl ? (
          <img
            src={workoutLog.coverImageUrl}
            alt={workoutLog.workoutName}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <HeroIcon className="w-32 h-32 text-white" />
          </div>
        )}

        {/* Floating actions over the hero */}
        <div className="absolute top-3 left-3 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur"
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
        <div className="absolute top-3 right-3 z-10">
          <Drawer open={showActionSheet} onOpenChange={setShowActionSheet}>
            <DrawerTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <div className="p-4 space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-base font-normal h-12"
                  onClick={handleEditLog}
                >
                  <Pencil className="h-5 w-5 mr-3" />
                  Edit Log
                </Button>
                {isCustomWorkout && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-base font-normal h-12"
                    onClick={() => {
                      setShowActionSheet(false);
                      setShowSaveDialog(true);
                    }}
                  >
                    <Bookmark className="h-5 w-5 mr-3" />
                    Save Workout
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="w-full justify-start text-base font-normal h-12 text-destructive hover:text-destructive"
                  onClick={() => {
                    setShowActionSheet(false);
                    setShowDeleteDialog(true);
                  }}
                >
                  <Trash2 className="h-5 w-5 mr-3" />
                  Delete
                </Button>
              </div>
            </DrawerContent>
          </Drawer>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {justCompleted && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0cc9a9] text-black text-xs font-semibold">
                <Sparkles className="w-3 h-3" />
                Workout review
              </span>
            )}
            {completedDate && (
              <span className="inline-flex items-center px-3 py-1 rounded-full border border-white/30 bg-black/30 text-white text-xs font-medium backdrop-blur">
                {completedDate}
              </span>
            )}
          </div>
          <h2
            className="text-4xl font-bold text-white leading-tight tracking-tight"
            data-testid="text-workout-name"
          >
            {workoutLog.workoutName}
          </h2>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Stat row: Length / Volume / Effort - header on top, larger, no icons */}
        <div className="grid grid-cols-3 gap-3" data-testid="stats-row">
          {/* Length */}
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col items-center text-center min-h-[120px] justify-between">
            <span className="text-sm text-muted-foreground font-medium">Length</span>
            <span className="text-2xl font-bold text-foreground tabular-nums" data-testid="stat-length">
              {formatLength(lengthSeconds)}
            </span>
            <span className="text-[11px] text-muted-foreground/70 invisible">.</span>
          </div>

          {/* Volume - with semicircle gauge */}
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col items-center text-center min-h-[120px] justify-between">
            <span className="text-sm text-muted-foreground font-medium">Volume</span>
            <div className="relative w-full flex items-center justify-center">
              <svg viewBox="0 0 100 56" className="w-20 h-12" aria-hidden="true">
                {/* track */}
                <path
                  d="M 8 50 A 42 42 0 0 1 92 50"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.15"
                  strokeWidth="8"
                  strokeLinecap="round"
                  className="text-muted-foreground"
                />
                {/* fill */}
                <path
                  d="M 8 50 A 42 42 0 0 1 92 50"
                  fill="none"
                  stroke="#0cc9a9"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="132"
                  strokeDashoffset={132 * (1 - volumePct)}
                />
              </svg>
              <span className="absolute inset-x-0 bottom-0 text-lg font-bold text-foreground tabular-nums" data-testid="stat-volume">
                {formatVolume(volumeKg)}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground/70 invisible">.</span>
          </div>

          {/* Effort */}
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col items-center text-center min-h-[120px] justify-between">
            <span className="text-sm text-muted-foreground font-medium">Effort</span>
            <div
              className="px-4 py-1.5 rounded-full text-xl font-bold"
              style={{ backgroundColor: effort.bg, color: effort.text }}
              data-testid="stat-effort"
            >
              {rating > 0 ? `${rating}/10` : '-'}
            </div>
            <span className="text-[11px] text-muted-foreground mt-1">
              {rating > 0 ? effort.label : ''}
            </span>
          </div>
        </div>

        {/* AI review section */}
        <div className="rounded-lg border border-border bg-card p-4" data-testid="section-ai-review">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#0cc9a9]/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#0cc9a9]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-foreground">Coach review</h3>
              {!aiReview && !aiReviewLoading && !aiReviewError && (
                <p className="text-sm text-muted-foreground mt-1">
                  Want a quick read on how this session went?
                </p>
              )}
              {aiReviewError && (
                <p className="text-sm text-destructive mt-1">{aiReviewError}</p>
              )}
              {aiReview && (
                <p
                  className="text-sm text-foreground/90 mt-2 leading-relaxed whitespace-pre-wrap"
                  data-testid="text-ai-review"
                >
                  {aiReview}
                </p>
              )}
            </div>
          </div>

          {!aiReview && (
            <Button
              onClick={requestAiReview}
              disabled={aiReviewLoading}
              className="w-full mt-3 bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black font-medium"
              data-testid="button-get-ai-review"
            >
              {aiReviewLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Reviewing your session...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {aiReviewError ? 'Try again' : 'Get review'}
                </>
              )}
            </Button>
          )}

          {aiReview && (
            <Button
              onClick={openCoachWithContext}
              variant="outline"
              className="w-full mt-3"
              data-testid="button-continue-coach"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Continue in coach chat
            </Button>
          )}
        </div>

        {/* Logged Workout (existing exercise/set view) - header & warmup are hidden because they're shown above */}
        <div>
          <h3 className="text-sm font-semibold text-foreground/80 mb-2 px-1">Logged workout</h3>
          <WorkoutCompletionView
            workoutLog={workoutLog}
            onDelete={() => setShowDeleteDialog(true)}
            isEditing={showEditMode}
            onEditModeChange={(editing) => {
              setShowEditMode(editing);
              if (!editing) {
                handleEditComplete();
              }
            }}
            hideHeader
            hideWarmup
          />
        </div>

        {/* Personal bests detail (only when we have session PR data) */}
        {realPRs.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4" data-testid="section-prs-detail">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#0cc9a9]" />
                Personal bests
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => navigate('/achievements')}
                data-testid="link-all-time-records"
              >
                All-time
                <ChevronRight className="w-3 h-3 ml-0.5" />
              </Button>
            </div>
            <ul className="space-y-2">
              {realPRs.map((pr, i) => (
                <li
                  key={`${pr.exerciseName}-${pr.type}-${i}`}
                  className="flex items-center justify-between p-2 rounded-md bg-[#0cc9a9]/5 border border-[#0cc9a9]/20"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Star className="w-4 h-4 text-[#0cc9a9] flex-shrink-0" />
                    <span className="text-sm text-foreground truncate">{pr.exerciseName}</span>
                  </div>
                  <div className="text-sm font-medium text-[#0cc9a9] whitespace-nowrap pl-2">
                    {pr.type === 'weight' && `${pr.value}kg`}
                    {pr.type === 'reps' && `${pr.value} reps`}
                    {pr.type === 'volume' && `${Math.round(pr.value || 0)}kg vol`}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Bottom CTAs (only on the just-completed flow) */}
        {justCompleted && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => navigate('/progress/workouts')}
              data-testid="button-workout-records"
            >
              Workout records
            </Button>
            <Button
              onClick={() => navigate('/')}
              className="bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black font-medium"
              data-testid="button-home"
            >
              Back to dashboard
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workout Log</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this workout log? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Workout</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Give this workout a name so you can easily find and reuse it.
            </p>
            <Input
              placeholder="e.g. Monday Push Day"
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              maxLength={100}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && workoutName.trim().length > 0) {
                  handleSaveWorkout();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveWorkout}
              disabled={workoutName.trim().length === 0 || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
