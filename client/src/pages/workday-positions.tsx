import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Armchair, Plus, Check } from "lucide-react";
import type { WorkdayPosition, WorkdayUserProfile } from "@shared/schema";

type FilterType = "all" | "seated" | "standing" | "alternative";

const TYPE_LABEL: Record<string, string> = {
  seated: "Seated",
  standing: "Standing",
  alternative: "Alternative",
};

function getType(p: WorkdayPosition): "seated" | "standing" | "alternative" {
  if (p.positionType === "standing" || p.positionType === "alternative") return p.positionType;
  return "seated";
}

function TypeBadge({ type }: { type: "seated" | "standing" | "alternative" }) {
  const colors: Record<string, string> = {
    seated: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    standing: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    alternative: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${colors[type]}`}>
      {TYPE_LABEL[type]}
    </Badge>
  );
}

function RotationToggleButton({
  inRotation,
  onToggle,
  pending,
  size = "sm",
  testId,
}: {
  inRotation: boolean;
  onToggle: () => void;
  pending: boolean;
  size?: "sm" | "lg";
  testId?: string;
}) {
  const big = size === "lg";
  return (
    <Button
      type="button"
      variant={inRotation ? "secondary" : "default"}
      size={big ? "default" : "sm"}
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={
        inRotation
          ? "border border-[#0cc9a9]/40 bg-[#0cc9a9]/10 text-[#0cc9a9] hover:bg-[#0cc9a9]/20"
          : "bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-white"
      }
      data-testid={testId}
    >
      {inRotation ? (
        <>
          <Check className={big ? "h-4 w-4 mr-2" : "h-3.5 w-3.5 mr-1"} />
          In rotation
        </>
      ) : (
        <>
          <Plus className={big ? "h-4 w-4 mr-2" : "h-3.5 w-3.5 mr-1"} />
          Add to rotation
        </>
      )}
    </Button>
  );
}

function PositionCard({
  position,
  inRotation,
  onToggle,
  pending,
  onOpen,
}: {
  position: WorkdayPosition;
  inRotation: boolean;
  onToggle: () => void;
  pending: boolean;
  onOpen: () => void;
}) {
  const type = getType(position);
  return (
    <Card
      className="bg-card border-border overflow-hidden cursor-pointer hover:border-[#0cc9a9]/40 transition-colors"
      onClick={onOpen}
      data-testid={`card-position-${position.id}`}
    >
      <CardContent className="p-3">
        <div className="flex gap-3">
          {position.imageUrl ? (
            <img
              src={position.imageUrl}
              alt={position.name}
              className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
              <Armchair className="h-7 w-7 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground text-sm truncate">{position.name}</h3>
              <TypeBadge type={type} />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{position.description}</p>
            <div className="mt-auto">
              <RotationToggleButton
                inRotation={inRotation}
                onToggle={onToggle}
                pending={pending}
                testId={`button-toggle-rotation-${position.id}`}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PositionSkeleton() {
  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardContent className="p-3 flex gap-3">
        <Skeleton className="h-20 w-20 rounded-lg bg-gray-700" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32 bg-gray-700" />
          <Skeleton className="h-3 w-full bg-gray-700" />
          <Skeleton className="h-3 w-3/4 bg-gray-700" />
        </div>
      </CardContent>
    </Card>
  );
}

const FILTERS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "seated", label: "Seated" },
  { value: "standing", label: "Standing" },
  { value: "alternative", label: "Alternative" },
];

export default function WorkdayPositions() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<FilterType>("all");
  const [openId, setOpenId] = useState<number | null>(null);

  const { data: positions = [], isLoading } = useQuery<WorkdayPosition[]>({
    queryKey: ["/api/workday/positions"],
    enabled: isAuthenticated,
  });

  const { data: profile } = useQuery<WorkdayUserProfile | null>({
    queryKey: ["/api/workday/profile"],
    enabled: isAuthenticated,
  });

  const preferred = useMemo(() => profile?.preferredPositions ?? [], [profile]);

  const toggleMutation = useMutation({
    mutationFn: (positionId: number) => {
      const idStr = String(positionId);
      const wasIn = preferred.includes(idStr);
      const nextPreferred = wasIn
        ? preferred.filter((p) => p !== idStr)
        : [...preferred, idStr];
      return apiRequest("POST", "/api/workday/profile", {
        preferredPositions: nextPreferred,
      });
    },
    onSuccess: (_data, positionId) => {
      const idStr = String(positionId);
      const wasIn = preferred.includes(idStr);
      queryClient.invalidateQueries({ queryKey: ["/api/workday/profile"] });
      toast({
        title: wasIn ? "Removed from rotation" : "Added to rotation",
      });
    },
    onError: () => {
      toast({ title: "Failed to update rotation", variant: "destructive" });
    },
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

  const filtered = useMemo(() => {
    if (filter === "all") return positions;
    return positions.filter((p) => getType(p) === filter);
  }, [positions, filter]);

  const openPosition = openId != null ? positions.find((p) => p.id === openId) ?? null : null;

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0cc9a9]"></div>
      </div>
    );
  }

  if (openPosition) {
    const inRotation = preferred.includes(String(openPosition.id));
    return (
      <div className="min-h-screen bg-background pb-24">
        <TopHeader title={openPosition.name} onBack={() => setOpenId(null)} />
        <div className="px-4 pt-14 pb-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-xl font-bold text-foreground" data-testid="text-detail-name">
              {openPosition.name}
            </h1>
            <TypeBadge type={getType(openPosition)} />
          </div>
          <p className="text-sm text-muted-foreground mb-4">{openPosition.description}</p>

          {openPosition.imageUrl && (
            <div className="mb-4 rounded-xl overflow-hidden bg-black/20 max-w-[280px] mx-auto">
              <img
                src={openPosition.imageUrl}
                alt={openPosition.name}
                className="w-full h-auto object-contain"
              />
            </div>
          )}

          {openPosition.setupCues && openPosition.setupCues.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Setup Tips
              </h4>
              <div className="space-y-1.5">
                {openPosition.setupCues.map((cue, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#0cc9a9] mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground/80">{cue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <RotationToggleButton
              inRotation={inRotation}
              onToggle={() => {
                const wasIn = inRotation;
                toggleMutation.mutate(openPosition.id, {
                  onSuccess: () => {
                    if (!wasIn) setOpenId(null);
                  },
                });
              }}
              pending={toggleMutation.isPending && toggleMutation.variables === openPosition.id}
              size="lg"
              testId={`button-detail-toggle-${openPosition.id}`}
            />
          </div>
        </div>
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

        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                  active
                    ? "bg-[#0cc9a9] border-[#0cc9a9] text-white"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`filter-${f.value}`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <PositionSkeleton />
            <PositionSkeleton />
            <PositionSkeleton />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Armchair className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-muted-foreground">
              {positions.length === 0
                ? "No positions available yet"
                : "No positions match this filter"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((position) => (
              <PositionCard
                key={position.id}
                position={position}
                inRotation={preferred.includes(String(position.id))}
                onToggle={() => toggleMutation.mutate(position.id)}
                pending={toggleMutation.isPending && toggleMutation.variables === position.id}
                onOpen={() => setOpenId(position.id)}
              />
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
