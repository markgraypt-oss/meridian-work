import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { placeholderMeditations, meditationCategories, getCategoryIcon } from "@/lib/meditation-data";
import TopHeader from "@/components/TopHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Headphones,
  BookHeart,
  Waves,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Flame,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";

const MAX_VISIBLE = 5;

const gratitudePrompts = [
  "What made you smile today?",
  "Who is someone you're grateful for and why?",
  "What small comfort did you enjoy recently?",
  "What challenge helped you grow this week?",
  "What about your health are you thankful for?",
];

const placeholderSoundscapes = [
  { id: 1, title: "Gentle Rain", icon: "🌧️" },
  { id: 2, title: "Ocean Waves", icon: "🌊" },
  { id: 3, title: "Forest Morning", icon: "🌲" },
  { id: 4, title: "Crackling Fire", icon: "🔥" },
  { id: 5, title: "Night Crickets", icon: "🦗" },
  { id: 6, title: "White Noise", icon: "📡" },
];

function GuidedMeditations() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [, navigate] = useLocation();

  const { data: stats } = useQuery<{ totalSessions: number; totalMinutes: number; currentStreak: number }>({
    queryKey: ["/api/meditation/stats"],
  });

  const streak = stats?.currentStreak || 0;
  const totalSessions = stats?.totalSessions || 0;
  const totalMinutes = stats?.totalMinutes || 0;

  const allFiltered = activeCategory === "All"
    ? placeholderMeditations
    : placeholderMeditations.filter((m) => m.category === activeCategory);

  const visible = allFiltered.slice(0, MAX_VISIBLE);
  const hasMore = allFiltered.length > MAX_VISIBLE;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#0cc9a9]/10 flex items-center justify-center flex-shrink-0">
          <Headphones className="h-5 w-5 text-[#0cc9a9]" />
        </div>
        <h2 className="text-base font-bold text-foreground">Guided Meditations</h2>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">{totalSessions}</p>
          <p className="text-xs text-muted-foreground">Sessions</p>
        </div>
        <div className="bg-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">{totalMinutes}</p>
          <p className="text-xs text-muted-foreground">Minutes</p>
        </div>
        <div className="bg-card rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <Flame className="h-4 w-4 text-orange-500" />
            <p className="text-2xl font-bold text-primary">{streak}</p>
          </div>
          <p className="text-xs text-muted-foreground">Day Streak</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {meditationCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeCategory === cat
                ? "bg-[#0cc9a9] text-black"
                : "bg-card border border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {visible.map((med) => {
          const Icon = getCategoryIcon(med.category);
          return (
            <button
              key={med.id}
              onClick={() => navigate(`/recovery/mindfulness/meditation/${med.id}`)}
              className="w-full rounded-xl border border-border/60 bg-card p-4 text-left transition-all active:scale-[0.98] flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-[#0cc9a9]/10 flex items-center justify-center flex-shrink-0">
                <Icon className="h-5 w-5 text-[#0cc9a9]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{med.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{med.description}</p>
                <div className="flex items-center gap-1 text-muted-foreground mt-1.5">
                  <Clock className="h-3 w-3" />
                  <span className="text-[11px]">{med.durationMin} min</span>
                </div>
              </div>
              <ChevronRightIcon className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
            </button>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => navigate(`/recovery/mindfulness/meditations/${encodeURIComponent(activeCategory)}`)}
          className="w-full rounded-xl border border-border/60 bg-card p-3 text-center text-sm font-medium text-[#0cc9a9] transition-all active:scale-[0.98]"
        >
          View all {allFiltered.length} meditations
        </button>
      )}
    </div>
  );
}

function GratitudeJournal() {
  const [entry, setEntry] = useState("");
  const [promptIndex] = useState(() => Math.floor(Math.random() * gratitudePrompts.length));
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const { toast } = useToast();

  const { data: dates } = useQuery<string[]>({
    queryKey: ["/api/gratitude/dates"],
  });

  const { data: entries, isLoading: entriesLoading } = useQuery<Array<{ id: number; content: string; prompt: string | null; createdAt: string }>>({
    queryKey: ["/api/gratitude/entries", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/gratitude/entries?date=${selectedDate}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch entries");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/gratitude/entries", {
        content: entry.trim(),
        prompt: gratitudePrompts[promptIndex],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gratitude/entries", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/gratitude/dates"] });
      setEntry("");
      toast({ title: "Entry saved", description: "Your gratitude entry has been recorded." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save entry.", variant: "destructive" });
    },
  });

  const navigateDate = (direction: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + direction);
    const newDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setSelectedDate(newDate);
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const isToday = selectedDate === todayStr;

  const displayDate = new Date(selectedDate + "T12:00:00");
  const dateLabel = isToday
    ? "Today"
    : displayDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  const hasEntries = dates && dates.includes(selectedDate);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0cc9a9]/10 flex items-center justify-center flex-shrink-0">
            <BookHeart className="h-5 w-5 text-[#0cc9a9]" />
          </div>
          <h2 className="text-base font-bold text-foreground">Gratitude Journal</h2>
        </div>

        {isToday && (
          <div className="px-4 py-4 border-b border-border/40">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-[#0cc9a9] flex-shrink-0" />
              <span className="text-[11px] text-[#0cc9a9] font-semibold uppercase tracking-wider">Today's Prompt</span>
            </div>
            <p className="text-sm font-semibold text-foreground mb-4 leading-relaxed">
              {gratitudePrompts[promptIndex]}
            </p>

            <Textarea
              placeholder="Write your thoughts here..."
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              className="min-h-[100px] bg-background border border-[#0cc9a9]/30 resize-none text-sm"
            />

            <div className="flex items-center justify-end mt-3">
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={!entry.trim() || saveMutation.isPending}
                className="bg-[#0cc9a9] hover:bg-[#0cc9a9] text-black text-xs font-semibold px-5"
              >
                {saveMutation.isPending ? "Saving..." : "Save Entry"}
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-1">
            <button onClick={() => navigateDate(-1)} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-2 px-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{dateLabel}</span>
              {hasEntries && <div className="w-1.5 h-1.5 rounded-full bg-[#0cc9a9]" />}
            </div>
            <button
              onClick={() => navigateDate(1)}
              disabled={isToday}
              className={`p-1.5 rounded-lg transition-colors ${isToday ? "opacity-30" : "hover:bg-muted/50"}`}
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="p-4">
          {entriesLoading ? (
            <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
          ) : entries && entries.length > 0 ? (
            <div className="space-y-3">
              {entries.map((e) => (
                <div key={e.id} className="rounded-xl border border-border/60 bg-background p-4">
                  {e.prompt && (
                    <div className="flex items-center gap-2 mb-2.5">
                      <Sparkles className="h-3 w-3 text-[#0cc9a9] flex-shrink-0" />
                      <p className="text-[10px] text-[#0cc9a9] font-semibold uppercase tracking-wider">{e.prompt}</p>
                    </div>
                  )}
                  <p className="text-sm text-foreground leading-relaxed">{e.content}</p>
                  <div className="flex items-center gap-1.5 mt-3">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(e.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              {isToday ? "No entries yet today. Write one above" : "No entries on this date"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Soundscapes() {
  const [activeSound, setActiveSound] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center flex-shrink-0">
          <Waves className="h-5 w-5 text-teal-500" />
        </div>
        <h2 className="text-base font-bold text-foreground">Soundscapes</h2>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {placeholderSoundscapes.map((sound) => {
          const isActive = activeSound === sound.id;

          return (
            <button
              key={sound.id}
              onClick={() => setActiveSound(isActive ? null : sound.id)}
              className={`rounded-xl border p-3 text-center transition-all ${
                isActive
                  ? "border-[#0cc9a9]/40 bg-[#0cc9a9]/5"
                  : "border-border/60 bg-card hover:border-border"
              }`}
            >
              <span className="text-2xl block mb-1.5">{sound.icon}</span>
              <p className={`text-[11px] font-medium ${isActive ? "text-[#0cc9a9]" : "text-foreground"}`}>
                {sound.title}
              </p>
            </button>
          );
        })}
      </div>

      {activeSound && (
        <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#0cc9a9] animate-pulse" />
            <span className="text-sm text-foreground font-medium">
              {placeholderSoundscapes.find((s) => s.id === activeSound)?.title}
            </span>
          </div>
          <button
            onClick={() => setActiveSound(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Stop
          </button>
        </div>
      )}
    </div>
  );
}

export default function RecoveryMindfulness() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader title="Mindfulness Tools" onBack={() => navigate("/recovery")} />

      <div className="px-4 pt-20 pb-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <GuidedMeditations />
          <GratitudeJournal />
          <Soundscapes />
        </div>
      </div>
    </div>
  );
}
