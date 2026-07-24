import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Badge {
  id: number;
  name: string;
  description: string;
  category: string;
  tier: string;
  icon: string;
}

interface UserBadge {
  id: number;
  badgeId: number;
  earnedAt: string;
  notified: boolean;
  badge: Badge;
}

const triggerHaptic = (pattern: "light" | "medium" | "heavy" | "success" | "celebration") => {
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
    case "celebration":
      navigator.vibrate([100, 50, 100, 50, 100, 50, 200]);
      break;
  }
};

function BadgeUnlockModal({ userBadge, onClose }: { userBadge: UserBadge; onClose: () => void }) {
  const [isAnimating, setIsAnimating] = useState(true);
  const queryClient = useQueryClient();
  const badge = userBadge.badge;

  useEffect(() => {
    triggerHaptic("celebration");
    const timer = setTimeout(() => setIsAnimating(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const markNotifiedMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/user/badges/${userBadge.id}/notified`, {
        method: 'POST',
        credentials: 'include',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/badges/unnotified'] });
    },
  });

  const handleClose = () => {
    markNotifiedMutation.mutate();
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          >
            <Sparkles 
              className={cn(
                "w-4 h-4",
                badge.tier === 'platinum' ? "text-cyan-400" :
                badge.tier === 'gold' ? "text-[#0cc9a9]" :
                badge.tier === 'silver' ? "text-slate-300" : "text-[#0cc9a9]"
              )} 
            />
          </div>
        ))}
      </div>

      <div className={cn(
        "relative text-center p-8 rounded-2xl max-w-sm mx-4",
        isAnimating && "animate-in zoom-in-50 duration-500"
      )}>
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-xs uppercase tracking-widest text-[#0cc9a9] mb-4">
          Achievement Unlocked
        </div>

        <div className={cn(
          "relative w-40 h-40 mx-auto mb-6",
          isAnimating && "animate-bounce"
        )}>
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <linearGradient id="unlock-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={badge.tier === 'platinum' ? '#67e8f9' : badge.tier === 'gold' ? '#0cc9a9' : badge.tier === 'silver' ? '#cbd5e1' : '#0cc9a9'} />
                <stop offset="100%" stopColor={badge.tier === 'platinum' ? '#3b82f6' : badge.tier === 'gold' ? '#0cc9a9' : badge.tier === 'silver' ? '#64748b' : '#0cc9a9'} />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <polygon 
              points="50,3 93,25 93,75 50,97 7,75 7,25" 
              fill="url(#unlock-grad)"
              stroke={badge.tier === 'platinum' ? '#67e8f9' : badge.tier === 'gold' ? '#0cc9a9' : badge.tier === 'silver' ? '#94a3b8' : '#0cc9a9'}
              strokeWidth="3"
              filter="url(#glow)"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl">{badge.icon}</span>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">{badge.name}</h2>
        <p className="text-gray-400 mb-6">{badge.description}</p>

        <div className={cn(
          "inline-block px-4 py-1 rounded-full text-sm font-medium capitalize",
          badge.tier === 'platinum' && "bg-cyan-500/20 text-cyan-400",
          badge.tier === 'gold' && "bg-[#0cc9a9]/20 text-[#0cc9a9]",
          badge.tier === 'silver' && "bg-slate-400/20 text-slate-300",
          badge.tier === 'bronze' && "bg-[#0cc9a9]/20 text-[#0cc9a9]"
        )}>
          {badge.tier} Badge
        </div>

        <Button 
          onClick={handleClose} 
          className="mt-8 w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/80 text-black"
        >
          Awesome!
        </Button>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 1; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 0.5; }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default function BadgeNotification() {
  const [currentBadge, setCurrentBadge] = useState<UserBadge | null>(null);
  const [queue, setQueue] = useState<UserBadge[]>([]);

  const { data: unnotifiedBadges } = useQuery<UserBadge[]>({
    queryKey: ['/api/user/badges/unnotified'],
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (unnotifiedBadges && unnotifiedBadges.length > 0 && queue.length === 0 && !currentBadge) {
      setQueue(unnotifiedBadges);
      setCurrentBadge(unnotifiedBadges[0]);
    }
  }, [unnotifiedBadges]);

  const handleClose = () => {
    const remaining = queue.slice(1);
    setQueue(remaining);
    setCurrentBadge(remaining.length > 0 ? remaining[0] : null);
  };

  if (!currentBadge) return null;

  return <BadgeUnlockModal userBadge={currentBadge} onClose={handleClose} />;
}
