import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, RotateCcw, Home, Flame, Zap } from "lucide-react";
import type { BreathTechnique } from "@shared/schema";

export default function BreathSessionComplete() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const searchParams = new URLSearchParams(window.location.search);
  const techniqueSlug = searchParams.get('technique');
  const rounds = parseInt(searchParams.get('rounds') || '0');
  const duration = parseInt(searchParams.get('duration') || '0');

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

  const { data: technique } = useQuery<BreathTechnique>({
    queryKey: ['/api/breathwork/techniques', techniqueSlug],
    queryFn: async () => {
      const res = await fetch(`/api/breathwork/techniques/${techniqueSlug}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch technique');
      return res.json();
    },
    enabled: isAuthenticated && !!techniqueSlug,
  });

  const { data: stats } = useQuery<{ totalSessions: number; totalMinutes: number; currentStreak: number }>({
    queryKey: ['/api/breathwork/stats'],
    enabled: isAuthenticated,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0f0f23]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0f23] to-[#1a1a2e] flex flex-col items-center justify-center p-6">
      {/* Success Icon */}
      <div className="relative mb-8">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center animate-pulse">
          <CheckCircle2 className="w-16 h-16 text-white" />
        </div>
        <div className="absolute -right-2 -top-2 w-12 h-12 rounded-full bg-gradient-to-br from-[#0cc9a9] to-teal-600 flex items-center justify-center">
          <Zap className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold text-white mb-2">Session Complete!</h1>
      <p className="text-gray-400 mb-8">{technique?.name || 'Breathing Exercise'}</p>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-8">
        <Card className="bg-white/10 border-white/20">
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">
              {minutes}:{String(seconds).padStart(2, '0')}
            </p>
            <p className="text-xs text-gray-400">Duration</p>
          </CardContent>
        </Card>
        <Card className="bg-white/10 border-white/20">
          <CardContent className="p-4 text-center">
            <RotateCcw className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{rounds}</p>
            <p className="text-xs text-gray-400">Rounds</p>
          </CardContent>
        </Card>
      </div>

      {/* Overall Stats */}
      {stats && (
        <Card className="bg-white/5 border-white/10 w-full max-w-sm mb-8">
          <CardContent className="p-4">
            <h3 className="text-white font-semibold mb-3 text-center">Your Progress</h3>
            <div className="flex justify-around">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{stats.totalSessions}</p>
                <p className="text-xs text-gray-400">Total Sessions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{stats.totalMinutes}</p>
                <p className="text-xs text-gray-400">Total Minutes</p>
              </div>
              <div className="text-center flex flex-col items-center">
                <div className="flex items-center gap-1">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <p className="text-2xl font-bold text-orange-500">{stats.currentStreak}</p>
                </div>
                <p className="text-xs text-gray-400">Day Streak</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="w-full max-w-sm space-y-3">
        <Button
          className="w-full h-12"
          onClick={() => navigate(`/recovery/breath-work/session/${techniqueSlug}?rounds=${rounds}`)}
          data-testid="btn-repeat-session"
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Do It Again
        </Button>
        <Button
          variant="outline"
          className="w-full h-12 border-white/30 text-white hover:bg-white/10"
          onClick={() => navigate("/recovery/breath-work")}
          data-testid="btn-go-home"
        >
          <Home className="w-5 h-5 mr-2" />
          Back to Breath Work
        </Button>
      </div>
    </div>
  );
}
