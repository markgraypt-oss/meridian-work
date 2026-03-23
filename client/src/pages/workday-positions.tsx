import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, CheckCircle2, Armchair } from "lucide-react";
import type { WorkdayPosition } from "@shared/schema";

function PositionCard({ position }: { position: WorkdayPosition }) {
  return (
    <Card 
      className="bg-card border-border overflow-hidden"
      data-testid={`card-position-${position.id}`}
    >
      {position.imageUrl && (
        <div className="h-40 overflow-hidden">
          <img
            src={position.imageUrl}
            alt={position.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-foreground text-lg">{position.name}</h3>
          <div className="flex items-center gap-1 text-muted-foreground text-sm">
            <Clock className="h-4 w-4" />
            <span>{position.minDuration}-{position.maxDuration} min</span>
          </div>
        </div>
        
        <p className="text-muted-foreground text-sm mb-4">{position.description}</p>
        
        {position.setupCues && position.setupCues.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Setup Tips
            </h4>
            <div className="space-y-1.5">
              {position.setupCues.map((cue, index) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#0cc9a9] mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground/80">{cue}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PositionSkeleton() {
  return (
    <Card className="bg-card border-border overflow-hidden">
      <Skeleton className="h-40 w-full bg-gray-700" />
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-6 w-32 bg-gray-700" />
        <Skeleton className="h-4 w-full bg-gray-700" />
        <Skeleton className="h-4 w-3/4 bg-gray-700" />
      </CardContent>
    </Card>
  );
}

export default function WorkdayPositions() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const { data: positions = [], isLoading } = useQuery<WorkdayPosition[]>({
    queryKey: ["/api/workday/positions"],
    enabled: isAuthenticated,
  });

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

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0cc9a9]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopHeader title="Working Positions" onBack={() => navigate("/recovery/desk-health")} />
      
      <div className="px-4 pt-14 pb-4">
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Armchair className="h-6 w-6 text-[#0cc9a9]" />
            <h1 className="text-xl font-bold text-foreground">Position Options</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Explore different working positions to find what works best for your body and tasks
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <PositionSkeleton />
            <PositionSkeleton />
            <PositionSkeleton />
          </div>
        ) : positions.length === 0 ? (
          <div className="text-center py-12">
            <Armchair className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-muted-foreground">No positions available yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {positions.map((position) => (
              <PositionCard key={position.id} position={position} />
            ))}
          </div>
        )}

        <div className="mt-8 p-4 bg-card rounded-xl border border-border">
          <Badge variant="outline" className="mb-2 text-[#0cc9a9] border-[#0cc9a9]">
            Pro Tip
          </Badge>
          <p className="text-sm text-foreground/80">
            The best position is your next position. Try to change positions every 30-90 minutes 
            to keep your body comfortable and your mind fresh.
          </p>
        </div>
      </div>
    </div>
  );
}
