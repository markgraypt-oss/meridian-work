import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Wind, Heart, Zap, Focus, Clock, Star, Play, 
  Flame, Moon, ChevronDown, ChevronUp, Info
} from "lucide-react";
import type { BreathTechnique } from "@shared/schema";

const categoryIcons: Record<string, typeof Wind> = {
  relaxation: Moon,
  energy: Zap,
  focus: Focus,
  recovery: Heart,
  performance: Flame,
};

const categoryColors: Record<string, string> = {
  relaxation: "from-indigo-500 to-purple-600",
  energy: "from-orange-500 to-red-500",
  focus: "from-blue-500 to-cyan-500",
  recovery: "from-green-500 to-emerald-500",
  performance: "from-[#0cc9a9] to-orange-500",
};

export default function BreathTechniqueDetail() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const [showInstructions, setShowInstructions] = useState(false);
  const [rounds, setRounds] = useState(4);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: technique, isLoading } = useQuery<BreathTechnique>({
    queryKey: ['/api/breathwork/techniques', slug],
    queryFn: async () => {
      const res = await fetch(`/api/breathwork/techniques/${slug}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch technique');
      return res.json();
    },
    enabled: isAuthenticated && !!slug,
  });

  const { data: favouriteCheck } = useQuery<{ isFavourite: boolean }>({
    queryKey: ['/api/breathwork/favourites', technique?.id, 'check'],
    queryFn: async () => {
      const res = await fetch(`/api/breathwork/favourites/${technique?.id}/check`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to check favourite');
      return res.json();
    },
    enabled: isAuthenticated && !!technique?.id,
  });

  const toggleFavouriteMutation = useMutation({
    mutationFn: async () => {
      if (!technique) return;
      if (favouriteCheck?.isFavourite) {
        await apiRequest('DELETE', `/api/breathwork/favourites/${technique.id}`);
      } else {
        await apiRequest('POST', '/api/breathwork/favourites', { techniqueId: technique.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/breathwork/favourites'] });
      toast({
        title: favouriteCheck?.isFavourite ? "Removed from favourites" : "Added to favourites",
      });
    },
  });

  useEffect(() => {
    if (technique?.defaultRounds) {
      setRounds(technique.defaultRounds);
    }
  }, [technique]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!technique) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <TopHeader title="Technique" onBack={() => navigate("/recovery/breath-work")} />
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Technique not found</p>
        </div>
      </div>
    );
  }

  const Icon = categoryIcons[technique.category] || Wind;
  const gradient = categoryColors[technique.category] || "from-gray-500 to-gray-600";
  const cycleTime = technique.inhaleSeconds + technique.holdAfterInhaleSeconds + technique.exhaleSeconds + technique.holdAfterExhaleSeconds;
  const totalTime = Math.round((cycleTime * rounds) / 60);

  const handleStartSession = () => {
    navigate(`/recovery/breath-work/session/${technique.slug}?rounds=${rounds}`);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader 
        title={technique.name} 
        onBack={() => navigate("/recovery/breath-work")}
        rightActionIcon={
          <Star className={`w-5 h-5 ${favouriteCheck?.isFavourite ? 'fill-[#0cc9a9] text-[#0cc9a9]' : 'text-muted-foreground'}`} />
        }
        onRightAction={() => toggleFavouriteMutation.mutate()}
      />
      
      <div className="px-4 pt-14 pb-4 space-y-6">
        {/* Hero Section */}
        <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-8 text-center`}>
          <Icon className="w-20 h-20 text-white mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">{technique.name}</h1>
          <div className="flex items-center justify-center gap-4 text-white/80 text-sm">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {technique.defaultDurationMinutes} min
            </span>
            <span className="capitalize">{technique.difficulty}</span>
            <span className="capitalize">{technique.category}</span>
          </div>
        </div>

        {/* Description */}
        <Card className="bg-card">
          <CardContent className="p-4">
            <p className="text-foreground">{technique.description}</p>
          </CardContent>
        </Card>

        {/* Benefits */}
        {technique.benefits && technique.benefits.length > 0 && (
          <Card className="bg-card">
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground mb-3">Benefits</h3>
              <ul className="space-y-2">
                {technique.benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Breathing Pattern */}
        <Card className="bg-card">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-4">Breathing Pattern</h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-green-500/20 rounded-lg p-3">
                <p className="text-2xl font-bold text-green-500">{technique.inhaleSeconds}</p>
                <p className="text-xs text-muted-foreground">Inhale</p>
              </div>
              <div className="bg-blue-500/20 rounded-lg p-3">
                <p className="text-2xl font-bold text-blue-500">{technique.holdAfterInhaleSeconds}</p>
                <p className="text-xs text-muted-foreground">Hold</p>
              </div>
              <div className="bg-orange-500/20 rounded-lg p-3">
                <p className="text-2xl font-bold text-orange-500">{technique.exhaleSeconds}</p>
                <p className="text-xs text-muted-foreground">Exhale</p>
              </div>
              <div className="bg-purple-500/20 rounded-lg p-3">
                <p className="text-2xl font-bold text-purple-500">{technique.holdAfterExhaleSeconds}</p>
                <p className="text-xs text-muted-foreground">Hold</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rounds Selector */}
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Rounds</h3>
                <p className="text-sm text-muted-foreground">~{totalTime} min total</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setRounds(Math.max(1, rounds - 1))}
                  data-testid="btn-decrease-rounds"
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <span className="text-2xl font-bold text-foreground w-8 text-center">{rounds}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setRounds(Math.min(20, rounds + 1))}
                  data-testid="btn-increase-rounds"
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        {technique.instructions && technique.instructions.length > 0 && (
          <Card className="bg-card">
            <CardContent className="p-4">
              <button
                className="w-full flex items-center justify-between"
                onClick={() => setShowInstructions(!showInstructions)}
                data-testid="btn-toggle-instructions"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">How to Practice</h3>
                </div>
                {showInstructions ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
              {showInstructions && (
                <ol className="mt-4 space-y-3">
                  {technique.instructions.map((instruction, i) => (
                    <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                      <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                        {i + 1}
                      </span>
                      {instruction}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        )}

        {/* Start Button */}
        <Button 
          className="w-full h-14 text-lg"
          onClick={handleStartSession}
          data-testid="btn-start-session"
        >
          <Play className="w-5 h-5 mr-2" />
          Start Session
        </Button>
      </div>
    </div>
  );
}
