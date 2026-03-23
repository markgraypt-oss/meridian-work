import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, Clock, Play } from "lucide-react";
import type { WorkdayMicroReset } from "@shared/schema";

const TARGET_AREAS = [
  { key: "all", label: "All" },
  { key: "neck", label: "Neck" },
  { key: "upper_back", label: "Upper Back" },
  { key: "lower_back", label: "Lower Back" },
  { key: "hips", label: "Hips" },
  { key: "wrists", label: "Wrists" },
];

function MicroResetCard({ reset }: { reset: WorkdayMicroReset }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card 
      className="bg-card border-border overflow-hidden"
      data-testid={`card-micro-reset-${reset.id}`}
    >
      {reset.imageUrl && (
        <div className="h-32 overflow-hidden">
          <img
            src={reset.imageUrl}
            alt={reset.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-foreground">{reset.name}</h3>
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <Clock className="h-3.5 w-3.5" />
            <span>{reset.duration}s</span>
          </div>
        </div>

        <Badge 
          variant="outline" 
          className="mb-3 text-xs capitalize border-border text-muted-foreground"
        >
          {reset.targetArea.replace(/_/g, " ")}
        </Badge>
        
        <p className="text-muted-foreground text-sm mb-3">{reset.description}</p>
        
        {reset.steps && reset.steps.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[#0cc9a9] hover:text-[#0cc9a9]/80 px-0 h-auto"
              data-testid={`button-expand-${reset.id}`}
            >
              <Play className="h-3 w-3 mr-1" />
              {isExpanded ? "Hide steps" : "View steps"}
            </Button>
            
            {isExpanded && (
              <ol className="mt-3 space-y-2 list-decimal list-inside">
                {reset.steps.map((step: string, index: number) => (
                  <li key={index} className="text-sm text-foreground/80 pl-2">
                    {step}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResetSkeleton() {
  return (
    <Card className="bg-card border-border overflow-hidden">
      <Skeleton className="h-32 w-full bg-muted" />
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-5 w-40 bg-muted" />
        <Skeleton className="h-4 w-20 bg-muted" />
        <Skeleton className="h-4 w-full bg-muted" />
      </CardContent>
    </Card>
  );
}

export default function WorkdayMicroResets() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedArea, setSelectedArea] = useState("all");

  const queryKey = selectedArea === "all" 
    ? ["/api/workday/micro-resets"]
    : ["/api/workday/micro-resets", { targetArea: selectedArea }];

  const { data: resets = [], isLoading } = useQuery<WorkdayMicroReset[]>({
    queryKey,
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
      <TopHeader title="Micro-Resets" onBack={() => navigate("/recovery/desk-health")} />
      
      <div className="px-4 pt-14 pb-4">
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="h-6 w-6 text-[#0cc9a9]" />
            <h1 className="text-xl font-bold text-foreground">Quick Resets</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            30-second movements to refresh your body without leaving your desk
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
          {TARGET_AREAS.map((area) => (
            <Button
              key={area.key}
              variant={selectedArea === area.key ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedArea(area.key)}
              className={selectedArea === area.key 
                ? "bg-[#0cc9a9] text-black flex-shrink-0"
                : "border-border text-muted-foreground flex-shrink-0"
              }
              data-testid={`filter-${area.key}`}
            >
              {area.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <ResetSkeleton />
            <ResetSkeleton />
            <ResetSkeleton />
            <ResetSkeleton />
          </div>
        ) : resets.length === 0 ? (
          <div className="text-center py-12">
            <Zap className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-muted-foreground">No micro-resets available yet</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {resets.map((reset) => (
              <MicroResetCard key={reset.id} reset={reset} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
