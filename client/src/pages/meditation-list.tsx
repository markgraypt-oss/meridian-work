import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import TopHeader from "@/components/TopHeader";
import { Clock, ChevronRight } from "lucide-react";
import { placeholderMeditations, meditationCategories, getCategoryIcon } from "@/lib/meditation-data";

export default function MeditationList() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ category: string }>();
  const initialCategory = params.category ? decodeURIComponent(params.category) : "All";
  const [activeCategory, setActiveCategory] = useState(initialCategory);

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

  const filtered = activeCategory === "All"
    ? placeholderMeditations
    : placeholderMeditations.filter((m) => m.category === activeCategory);

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
      <TopHeader title="All Meditations" onBack={() => navigate("/recovery/mindfulness")} />

      <div className="px-4 pt-20 pb-6">
        <div className="max-w-4xl mx-auto space-y-4">
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

          <p className="text-xs text-muted-foreground">{filtered.length} meditation{filtered.length !== 1 ? "s" : ""}</p>

          <div className="space-y-2">
            {filtered.map((med) => {
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
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{med.category}</span>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span className="text-[11px]">{med.durationMin} min</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
