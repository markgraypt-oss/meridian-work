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
import { 
  Monitor, 
  Camera, 
  CheckCircle2, 
  ChevronRight,
  Lightbulb,
  Armchair,
  ArrowUpDown
} from "lucide-react";
import type { WorkdayDeskSetup } from "@shared/schema";

const DESK_TYPES = [
  { key: "all", label: "All", icon: Monitor },
  { key: "seated", label: "Seated", icon: Armchair },
  { key: "standing", label: "Standing", icon: ArrowUpDown },
];

function SetupCard({ setup }: { setup: WorkdayDeskSetup }) {
  const [showTips, setShowTips] = useState(false);

  return (
    <Card 
      className="bg-card border-border overflow-hidden"
      data-testid={`card-setup-${setup.id}`}
    >
      {setup.imageUrl && (
        <div className="h-48 overflow-hidden relative">
          <img
            src={setup.imageUrl}
            alt={setup.title}
            className="w-full h-full object-cover"
          />
          <Badge 
            className="absolute top-3 left-3 capitalize bg-black/60 text-white border-none"
          >
            {setup.deskType}
          </Badge>
        </div>
      )}
      <CardContent className="p-4">
        <h3 className="font-semibold text-foreground mb-2">{setup.title}</h3>
        <p className="text-muted-foreground text-sm mb-4">{setup.description}</p>
        
        {setup.keyAdjustments && setup.keyAdjustments.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTips(!showTips)}
              className="text-[#0cc9a9] hover:text-[#0cc9a9]/80 px-0 h-auto mb-2"
              data-testid={`button-tips-${setup.id}`}
            >
              <Lightbulb className="h-4 w-4 mr-1" />
              {showTips ? "Hide key points" : "View key points"}
            </Button>
            
            {showTips && (
              <div className="space-y-2 bg-muted rounded-lg p-3">
                {setup.keyAdjustments.map((point: string, index: number) => (
                  <div key={index} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#0cc9a9] mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground/80">{point}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SetupSkeleton() {
  return (
    <Card className="bg-card border-border overflow-hidden">
      <Skeleton className="h-48 w-full bg-gray-700" />
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-5 w-48 bg-gray-700" />
        <Skeleton className="h-4 w-full bg-gray-700" />
        <Skeleton className="h-4 w-3/4 bg-gray-700" />
      </CardContent>
    </Card>
  );
}

export default function WorkdaySetup() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedType, setSelectedType] = useState("all");

  const queryParams = selectedType !== "all" ? `?deskType=${selectedType}` : "";
  
  const { data: setups = [], isLoading } = useQuery<WorkdayDeskSetup[]>({
    queryKey: ["/api/workday/desk-setups", selectedType],
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
      <TopHeader title="Setup Analysis" onBack={() => navigate("/recovery/desk-health")} />
      
      <div className="px-4 pt-14 pb-4">
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Monitor className="h-6 w-6 text-[#0cc9a9]" />
            <h1 className="text-xl font-bold text-foreground">Desk Setup Guide</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Reference images and tips to optimize your workspace for comfort
          </p>
        </div>

        <Card className="bg-gradient-to-br from-[#0cc9a9]/20 to-[#0cc9a9]/5 border-[#0cc9a9]/30 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#0cc9a9]/20 rounded-xl">
                <Camera className="h-6 w-6 text-[#0cc9a9]" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-foreground">Quick Scan</h3>
                <p className="text-sm text-muted-foreground">
                  Compare your setup with our reference images
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-[#0cc9a9]" />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 mb-4">
          {DESK_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <Button
                key={type.key}
                variant={selectedType === type.key ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType(type.key)}
                className={selectedType === type.key 
                  ? "bg-[#0cc9a9] text-black flex-1"
                  : "border-border text-muted-foreground flex-1"
                }
                data-testid={`filter-${type.key}`}
              >
                <Icon className="h-4 w-4 mr-1" />
                {type.label}
              </Button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <SetupSkeleton />
            <SetupSkeleton />
          </div>
        ) : setups.length === 0 ? (
          <div className="text-center py-12">
            <Monitor className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-muted-foreground">No setup guides available yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {setups.map((setup) => (
              <SetupCard key={setup.id} setup={setup} />
            ))}
          </div>
        )}

        <div className="mt-8 p-4 bg-card rounded-xl border border-border">
          <Badge variant="outline" className="mb-2 text-[#0cc9a9] border-[#0cc9a9]">
            Remember
          </Badge>
          <p className="text-sm text-foreground/80">
            Your ideal setup may look slightly different based on your body and equipment. 
            Use these references as a starting point and adjust for your comfort.
          </p>
        </div>
      </div>
    </div>
  );
}
