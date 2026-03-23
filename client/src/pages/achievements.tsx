import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trophy, Star, Flame, Lock, Award, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { Badge as UIBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TopHeader from "@/components/TopHeader";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface Badge {
  id: number;
  name: string;
  description: string;
  category: string;
  tier: string;
  icon: string;
  requirement: string;
  sortOrder: number;
}

interface BadgeProgress {
  badge: Badge;
  earned: boolean;
  earnedAt?: string;
}

interface BadgeProgressResponse {
  earned: number;
  total: number;
  badgesByCategory: Record<string, BadgeProgress[]>;
}

const TIER_COLORS: Record<string, { bg: string; border: string; glow: string }> = {
  bronze: { bg: "from-[#0cc9a9] to-[#0cc9a9]", border: "border-[#0cc9a9]", glow: "shadow-[#0cc9a9]/30" },
  silver: { bg: "from-slate-300 to-slate-500", border: "border-slate-400", glow: "shadow-slate-400/30" },
  gold: { bg: "from-[#0cc9a9] to-[#0cc9a9]", border: "border-[#0cc9a9]", glow: "shadow-[#0cc9a9]/50" },
  platinum: { bg: "from-cyan-300 to-blue-500", border: "border-cyan-400", glow: "shadow-cyan-400/50" },
};

const CATEGORY_LABELS: Record<string, { label: string; icon: any }> = {
  workout: { label: "Workouts", icon: Trophy },
  video_workout: { label: "Video Workouts", icon: Star },
  stretching: { label: "Stretching & Mobility", icon: Sparkles },
  breathwork: { label: "Breathwork", icon: Flame },
  programme: { label: "Programmes", icon: Award },
  learning: { label: "Learning", icon: Star },
  goals: { label: "Goals", icon: Trophy },
  desk_health: { label: "Desk Health", icon: Sparkles },
  body_map: { label: "Body Map", icon: Award },
  streak: { label: "Streaks", icon: Flame },
  supplement: { label: "Supplements", icon: Star },
};

const triggerHaptic = (pattern: "light" | "medium" | "heavy" | "success") => {
  if (!navigator.vibrate) return;
  
  switch (pattern) {
    case "light":
      navigator.vibrate(10);
      break;
    case "medium":
      navigator.vibrate(25);
      break;
    case "heavy":
      navigator.vibrate([50, 30, 50]);
      break;
    case "success":
      navigator.vibrate([30, 50, 30, 50, 100]);
      break;
  }
};

function HexagonBadge({ badge, earned, earnedAt, onSelect }: { 
  badge: Badge; 
  earned: boolean; 
  earnedAt?: string;
  onSelect: () => void;
}) {
  const tierStyle = TIER_COLORS[badge.tier] || TIER_COLORS.bronze;
  
  return (
    <button
      onClick={() => {
        triggerHaptic(earned ? "medium" : "light");
        onSelect();
      }}
      className={cn(
        "relative flex flex-col items-center transition-all duration-300",
        earned ? "scale-100 opacity-100" : "scale-95 opacity-60 grayscale"
      )}
    >
      <div 
        className={cn(
          "relative w-20 h-20 flex items-center justify-center",
          earned && "animate-pulse-slow"
        )}
      >
        <svg viewBox="0 0 100 100" className="absolute w-full h-full">
          <defs>
            <linearGradient id={`grad-${badge.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={earned ? (badge.tier === 'platinum' ? '#67e8f9' : badge.tier === 'gold' ? '#0cc9a9' : badge.tier === 'silver' ? '#cbd5e1' : '#0cc9a9') : '#374151'} />
              <stop offset="100%" stopColor={earned ? (badge.tier === 'platinum' ? '#3b82f6' : badge.tier === 'gold' ? '#0cc9a9' : badge.tier === 'silver' ? '#64748b' : '#0cc9a9') : '#1f2937'} />
            </linearGradient>
          </defs>
          <polygon 
            points="50,3 93,25 93,75 50,97 7,75 7,25" 
            fill={`url(#grad-${badge.id})`}
            stroke={earned ? (badge.tier === 'platinum' ? '#67e8f9' : badge.tier === 'gold' ? '#0cc9a9' : badge.tier === 'silver' ? '#94a3b8' : '#0cc9a9') : '#4b5563'}
            strokeWidth="2"
            className={cn(
              earned && "drop-shadow-lg",
              earned && badge.tier === 'platinum' && "drop-shadow-[0_0_8px_rgba(103,232,249,0.5)]",
              earned && badge.tier === 'gold' && "drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
            )}
          />
        </svg>
        <div className="relative z-10 flex flex-col items-center">
          {earned ? (
            <span className="text-2xl">{badge.icon}</span>
          ) : (
            <Lock className="w-5 h-5 text-gray-500" />
          )}
        </div>
      </div>
      <span className={cn(
        "text-xs mt-1 text-center max-w-[80px] truncate",
        earned ? "text-foreground" : "text-muted-foreground"
      )}>
        {badge.name}
      </span>
    </button>
  );
}

function BadgeDetailModal({ badge, earned, earnedAt, onClose }: {
  badge: Badge;
  earned: boolean;
  earnedAt?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (earned) {
      triggerHaptic("success");
    }
  }, [earned]);

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className={cn(
          "bg-card rounded-2xl p-6 max-w-sm w-full text-center",
          earned && "animate-in zoom-in-95 duration-300"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-32 h-32 mx-auto mb-4">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <linearGradient id="modal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={earned ? (badge.tier === 'platinum' ? '#67e8f9' : badge.tier === 'gold' ? '#0cc9a9' : badge.tier === 'silver' ? '#cbd5e1' : '#0cc9a9') : '#374151'} />
                <stop offset="100%" stopColor={earned ? (badge.tier === 'platinum' ? '#3b82f6' : badge.tier === 'gold' ? '#0cc9a9' : badge.tier === 'silver' ? '#64748b' : '#0cc9a9') : '#1f2937'} />
              </linearGradient>
            </defs>
            <polygon 
              points="50,3 93,25 93,75 50,97 7,75 7,25" 
              fill="url(#modal-grad)"
              stroke={earned ? (badge.tier === 'platinum' ? '#67e8f9' : badge.tier === 'gold' ? '#0cc9a9' : badge.tier === 'silver' ? '#94a3b8' : '#0cc9a9') : '#4b5563'}
              strokeWidth="2"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {earned ? (
              <span className="text-5xl">{badge.icon}</span>
            ) : (
              <Lock className="w-10 h-10 text-gray-500" />
            )}
          </div>
        </div>
        
        <h3 className="text-xl font-bold text-foreground mb-2">{badge.name}</h3>
        <p className="text-muted-foreground mb-4">{badge.description}</p>
        
        <UIBadge 
          variant={earned ? "default" : "secondary"}
          className={cn(
            "capitalize",
            earned && badge.tier === 'gold' && "bg-[#0cc9a9] hover:bg-teal-600",
            earned && badge.tier === 'platinum' && "bg-cyan-500 hover:bg-cyan-600",
            earned && badge.tier === 'silver' && "bg-slate-400 hover:bg-slate-500",
            earned && badge.tier === 'bronze' && "bg-[#0cc9a9] hover:bg-[#0cc9a9]"
          )}
        >
          {badge.tier}
        </UIBadge>
        
        {earned && earnedAt && (
          <p className="text-sm text-muted-foreground mt-4">
            Earned on {new Date(earnedAt).toLocaleDateString()}
          </p>
        )}
        
        {!earned && (
          <p className="text-sm text-muted-foreground mt-4">
            Keep going to unlock this badge!
          </p>
        )}
        
        <Button onClick={onClose} className="mt-6 w-full">
          Close
        </Button>
      </div>
    </div>
  );
}

export default function Achievements() {
  const [selectedBadge, setSelectedBadge] = useState<{ badge: Badge; earned: boolean; earnedAt?: string } | null>(null);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data: progress, isLoading } = useQuery<BadgeProgressResponse>({
    queryKey: ['/api/user/badges/progress'],
  });

  const checkBadgesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/user/badges/check', { 
        method: 'POST',
        credentials: 'include',
      });
      return response.json();
    },
    onSuccess: (data: { newBadges: Badge[] }) => {
      if (data.newBadges && data.newBadges.length > 0) {
        triggerHaptic("success");
        queryClient.invalidateQueries({ queryKey: ['/api/user/badges/progress'] });
      }
    },
  });

  useEffect(() => {
    checkBadgesMutation.mutate();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0cc9a9]"></div>
      </div>
    );
  }

  const earnedPercentage = progress ? (progress.earned / progress.total) * 100 : 0;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <TopHeader 
        title="Achievements" 
        onBack={() => navigate("/profile")}
      />

      <main className="pt-16 px-4 space-y-6">
        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground">{progress?.earned || 0}</h2>
              <p className="text-sm text-muted-foreground">Badges Earned</p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-muted-foreground">{progress?.total || 0}</h2>
              <p className="text-sm text-muted-foreground">Total Available</p>
            </div>
          </div>
          <Progress value={earnedPercentage} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {Math.round(earnedPercentage)}% Complete
          </p>
        </div>

        {progress?.badgesByCategory && Object.entries(progress.badgesByCategory).map(([category, badges]) => {
          const categoryInfo = CATEGORY_LABELS[category] || { label: category, icon: Trophy };
          const CategoryIcon = categoryInfo.icon;
          const earnedCount = badges.filter(b => b.earned).length;
          
          return (
            <div key={category} className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 mb-4">
                <CategoryIcon className="w-5 h-5 text-[#0cc9a9]" />
                <h3 className="font-semibold text-foreground">{categoryInfo.label}</h3>
                <span className="text-sm text-muted-foreground ml-auto">
                  {earnedCount}/{badges.length}
                </span>
              </div>
              
              <div className="flex flex-wrap gap-4 justify-start">
                {badges.map((badgeProgress) => (
                  <HexagonBadge
                    key={badgeProgress.badge.id}
                    badge={badgeProgress.badge}
                    earned={badgeProgress.earned}
                    earnedAt={badgeProgress.earnedAt}
                    onSelect={() => setSelectedBadge(badgeProgress)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </main>

      {selectedBadge && (
        <BadgeDetailModal
          badge={selectedBadge.badge}
          earned={selectedBadge.earned}
          earnedAt={selectedBadge.earnedAt}
          onClose={() => setSelectedBadge(null)}
        />
      )}

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
