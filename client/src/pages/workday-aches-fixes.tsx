import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HeartPulse,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Activity,
} from "lucide-react";
import type { WorkdayAchesFix } from "@shared/schema";

const ISSUE_TYPES: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "neck", label: "Neck" },
  { key: "shoulder", label: "Shoulder" },
  { key: "upper_back", label: "Upper Back" },
  { key: "lower_back", label: "Lower Back" },
  { key: "elbow", label: "Elbow" },
  { key: "wrist", label: "Wrist" },
  { key: "hip", label: "Hip" },
];

function prettyArea(value: string): string {
  const found = ISSUE_TYPES.find((t) => t.key === value);
  if (found) return found.label;
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function AreaBadge({ value }: { value: string }) {
  return (
    <Badge
      variant="outline"
      className="text-[10px] px-1.5 py-0 border-rose-400/40 text-rose-400 bg-rose-400/10"
    >
      {prettyArea(value)}
    </Badge>
  );
}

function AchesFixCard({
  fix,
  onOpen,
}: {
  fix: WorkdayAchesFix;
  onOpen: () => void;
}) {
  return (
    <Card
      className="bg-card border-border overflow-hidden cursor-pointer hover:border-[#0cc9a9]/40 transition-colors"
      onClick={onOpen}
      data-testid={`card-ache-${fix.id}`}
    >
      <CardContent className="p-3">
        <div className="flex gap-3">
          {fix.imageUrl ? (
            <img
              src={fix.imageUrl}
              alt={fix.title}
              className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
              <HeartPulse className="h-7 w-7 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground text-sm truncate">
                {fix.title}
              </h3>
              <AreaBadge value={fix.issueType} />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {fix.description}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FixSkeleton() {
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

function DetailList({
  icon,
  title,
  items,
  bullet = "dot",
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  bullet?: "dot" | "tick";
}) {
  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0cc9a9]/15 border border-[#0cc9a9]/30">
        <span className="text-[#0cc9a9]">{icon}</span>
        <h4 className="text-sm font-semibold text-[#0cc9a9] tracking-wide">
          {title}
        </h4>
      </div>
      <ul className="space-y-2 pl-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            {bullet === "tick" ? (
              <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
            ) : (
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#0cc9a9]/70 flex-shrink-0" />
            )}
            <span className="text-sm text-foreground/85 leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function WorkdayAchesFixes() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedType, setSelectedType] = useState<string>("all");
  const [openId, setOpenId] = useState<number | null>(null);

  const { data: fixes = [], isLoading } = useQuery<WorkdayAchesFix[]>({
    queryKey: ["/api/workday/aches-fixes"],
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

  const filtered = useMemo(() => {
    if (selectedType === "all") return fixes;
    return fixes.filter((f) => f.issueType === selectedType);
  }, [fixes, selectedType]);

  const openFix = openId != null ? fixes.find((f) => f.id === openId) ?? null : null;

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0cc9a9]"></div>
      </div>
    );
  }

  if (openFix) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <TopHeader title={openFix.title} onBack={() => setOpenId(null)} />
        <div className="px-4 pt-14 pb-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <h1
              className="text-xl font-bold text-foreground"
              data-testid="text-detail-title"
            >
              {openFix.title}
            </h1>
            <AreaBadge value={openFix.issueType} />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {openFix.description}
          </p>

          {openFix.imageUrl && (
            <div className="mb-4 rounded-xl overflow-hidden bg-black/20 max-w-[280px] mx-auto">
              <img
                src={openFix.imageUrl}
                alt={openFix.title}
                className="w-full h-auto object-contain"
              />
            </div>
          )}

          {openFix.contributors && openFix.contributors.length > 0 && (
            <DetailList
              icon={<AlertTriangle className="h-4 w-4" />}

              title="Contributing Factors"
              items={openFix.contributors}
            />
          )}

          {openFix.setupFactors && openFix.setupFactors.length > 0 && (
            <DetailList
              icon={<CheckCircle2 className="h-4 w-4" />}

              title="Setup Adjustments"
              items={openFix.setupFactors}
            />
          )}

          {openFix.positionChanges && openFix.positionChanges.length > 0 && (
            <DetailList
              icon={<Lightbulb className="h-4 w-4" />}

              title="Position Changes"
              items={openFix.positionChanges}
              bullet="tick"
            />
          )}

          {openFix.movementOptions && openFix.movementOptions.length > 0 && (
            <DetailList
              icon={<Activity className="h-4 w-4" />}

              title="Movement Options"
              items={openFix.movementOptions}
            />
          )}

          <div className="mt-8 p-4 bg-[#0cc9a9]/10 rounded-xl border border-[#0cc9a9]/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-[#0cc9a9] flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-[#0cc9a9] mb-1">
                  When to Seek Help
                </h4>
                <p className="text-sm text-foreground/80">
                  If discomfort persists for more than a few days, becomes severe,
                  or is accompanied by numbness or tingling, consult a healthcare
                  professional.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopHeader
        title="Aches & Fixes"
        onBack={() => navigate("/recovery/desk-health")}
      />

      <div className="px-4 pt-14 pb-4">
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <HeartPulse className="h-6 w-6 text-[#0cc9a9]" />
            <h1 className="text-xl font-bold text-foreground">
              Common Desk Discomforts
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Understand what's causing discomfort and what you can do about it
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
          {ISSUE_TYPES.map((type) => {
            const active = selectedType === type.key;
            return (
              <button
                key={type.key}
                onClick={() => setSelectedType(type.key)}
                className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                  active
                    ? "bg-[#0cc9a9] border-[#0cc9a9] text-white"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`filter-${type.key}`}
              >
                {type.label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <FixSkeleton />
            <FixSkeleton />
            <FixSkeleton />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <HeartPulse className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-muted-foreground">
              {fixes.length === 0
                ? "No entries available yet"
                : "No entries match this filter"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((fix) => (
              <AchesFixCard
                key={fix.id}
                fix={fix}
                onOpen={() => setOpenId(fix.id)}
              />
            ))}
          </div>
        )}

        <div className="mt-8 p-4 bg-[#0cc9a9]/10 rounded-xl border border-[#0cc9a9]/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-[#0cc9a9] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-[#0cc9a9] mb-1">
                When to Seek Help
              </h4>
              <p className="text-sm text-foreground/80">
                If discomfort persists for more than a few days, becomes severe,
                or is accompanied by numbness or tingling, consult a healthcare
                professional.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
