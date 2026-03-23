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
  HeartPulse, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2,
  AlertTriangle,
  Lightbulb
} from "lucide-react";
import type { WorkdayAchesFix } from "@shared/schema";

const ISSUE_TYPES = [
  { key: "all", label: "All Issues" },
  { key: "neck_pain", label: "Neck" },
  { key: "upper_back_pain", label: "Upper Back" },
  { key: "lower_back_pain", label: "Lower Back" },
  { key: "wrist_strain", label: "Wrists" },
  { key: "hip_tightness", label: "Hips" },
  { key: "eye_strain", label: "Eyes" },
];

function AchesFixCard({ fix }: { fix: WorkdayAchesFix }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card 
      className="bg-card border-border"
      data-testid={`card-ache-${fix.id}`}
    >
      <CardContent className="p-4">
        <div 
          className="flex items-start justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex-1">
            <Badge 
              variant="outline" 
              className="mb-2 text-xs capitalize border-rose-400/50 text-rose-400"
            >
              {fix.issueType.replace(/_/g, " ")}
            </Badge>
            <h3 className="font-semibold text-foreground">{fix.title}</h3>
            <p className="text-muted-foreground text-sm mt-1">{fix.description}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0 text-muted-foreground"
            data-testid={`button-toggle-${fix.id}`}
          >
            {isExpanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </Button>
        </div>

        {isExpanded && (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            {fix.contributors && fix.contributors.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-[#0cc9a9]" />
                  <h4 className="text-sm font-medium text-foreground/80">Contributing Factors</h4>
                </div>
                <ul className="space-y-1.5 pl-6">
                  {fix.contributors.map((cause: string, index: number) => (
                    <li key={index} className="text-sm text-muted-foreground list-disc">
                      {cause}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {fix.setupFactors && fix.setupFactors.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <h4 className="text-sm font-medium text-foreground/80">Setup Adjustments</h4>
                </div>
                <ul className="space-y-1.5 pl-6">
                  {fix.setupFactors.map((factor: string, index: number) => (
                    <li key={index} className="text-sm text-muted-foreground list-disc">
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {fix.positionChanges && fix.positionChanges.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-[#0cc9a9]" />
                  <h4 className="text-sm font-medium text-foreground/80">Position Changes</h4>
                </div>
                <ul className="space-y-1.5 pl-6">
                  {fix.positionChanges.map((change: string, index: number) => (
                    <li key={index} className="text-sm text-muted-foreground list-disc">
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {fix.movementOptions && fix.movementOptions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-purple-400" />
                  <h4 className="text-sm font-medium text-foreground/80">Movement Options</h4>
                </div>
                <ul className="space-y-1.5 pl-6">
                  {fix.movementOptions.map((option: string, index: number) => (
                    <li key={index} className="text-sm text-muted-foreground list-disc">
                      {option}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FixSkeleton() {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-5 w-24 bg-muted" />
        <Skeleton className="h-5 w-48 bg-muted" />
        <Skeleton className="h-4 w-full bg-muted" />
      </CardContent>
    </Card>
  );
}

export default function WorkdayAchesFixes() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedType, setSelectedType] = useState("all");

  const { data: fixes = [], isLoading } = useQuery<WorkdayAchesFix[]>({
    queryKey: selectedType === "all" 
      ? ["/api/workday/aches-fixes"]
      : ["/api/workday/aches-fixes", selectedType],
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
      <TopHeader title="Aches & Fixes" onBack={() => navigate("/recovery/desk-health")} />
      
      <div className="px-4 pt-14 pb-4">
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <HeartPulse className="h-6 w-6 text-[#0cc9a9]" />
            <h1 className="text-xl font-bold text-foreground">Common Desk Discomforts</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Understand what's causing discomfort and what you can do about it
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
          {ISSUE_TYPES.map((type) => (
            <Button
              key={type.key}
              variant={selectedType === type.key ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType(type.key)}
              className={selectedType === type.key 
                ? "bg-[#0cc9a9] text-black flex-shrink-0"
                : "border-border text-muted-foreground flex-shrink-0"
              }
              data-testid={`filter-${type.key}`}
            >
              {type.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <FixSkeleton />
            <FixSkeleton />
            <FixSkeleton />
          </div>
        ) : fixes.length === 0 ? (
          <div className="text-center py-12">
            <HeartPulse className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-muted-foreground">No entries available yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {fixes.map((fix) => (
              <AchesFixCard key={fix.id} fix={fix} />
            ))}
          </div>
        )}

        <div className="mt-8 p-4 bg-[#0cc9a9]/10 rounded-xl border border-[#0cc9a9]/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-[#0cc9a9] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-[#0cc9a9] mb-1">When to Seek Help</h4>
              <p className="text-sm text-foreground/80">
                If discomfort persists for more than a few days, becomes severe, or is 
                accompanied by numbness or tingling, consult a healthcare professional.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
