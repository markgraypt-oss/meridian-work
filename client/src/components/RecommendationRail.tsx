import { useMemo, type ComponentType } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Headphones, ChefHat, PlayCircle, Sparkles, X, Loader2, type LucideProps } from "lucide-react";
import type { Meditation, Recipe, Video } from "@shared/schema";

type ContentType = "meditation" | "recipe" | "video";

type RecommendationItem =
  | (RecommendationBase & { contentType: "meditation"; content: Meditation })
  | (RecommendationBase & { contentType: "recipe"; content: Recipe })
  | (RecommendationBase & { contentType: "video"; content: Video });

interface RecommendationBase {
  id: number;
  contentId: number;
  rationale: string;
  score: number;
  rank: number;
  source: string;
  generatedAt: string;
}

interface RecommendationsResponse {
  recommendations: RecommendationItem[];
  generatedAt: string | null;
  stale: boolean;
}

interface Props {
  variant?: "rail" | "section";
  filterType?: ContentType;
  title?: string;
  limitPerType?: number;
}

const TYPE_ICON: Record<ContentType, ComponentType<LucideProps>> = {
  meditation: Headphones,
  recipe: ChefHat,
  video: PlayCircle,
};

const TYPE_LABEL: Record<ContentType, string> = {
  meditation: "Meditation",
  recipe: "Recipe",
  video: "Video",
};

function linkFor(item: RecommendationItem): string {
  if (item.contentType === "meditation") return `/recovery/mindfulness/meditation/${item.contentId}`;
  if (item.contentType === "recipe") return `/recipe/${item.contentId}`;
  return `/learn/video/${item.contentId}`;
}

function titleFor(item: RecommendationItem): string {
  return item.content?.title || `${TYPE_LABEL[item.contentType]} #${item.contentId}`;
}

function metaFor(item: RecommendationItem): string {
  if (item.contentType === "meditation") {
    return `${item.content.durationMin} min · ${item.content.category}`;
  }
  if (item.contentType === "recipe") {
    return `${item.content.totalTime} min · ${item.content.calories} cal`;
  }
  const min = item.content.duration ? Math.max(1, Math.round(item.content.duration / 60)) : null;
  return `${min ?? "—"} min · ${item.content.category}`;
}

export function RecommendationRail({ variant = "rail", filterType, title, limitPerType }: Props) {
  const { data, isLoading } = useQuery<RecommendationsResponse>({
    queryKey: ["/api/recommendations"],
    staleTime: 5 * 60 * 1000,
  });

  const dismissMutation = useMutation({
    mutationFn: async (item: RecommendationItem) => {
      return await apiRequest("POST", "/api/recommendations/dismiss", {
        contentType: item.contentType,
        contentId: item.contentId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
    },
  });

  const items = useMemo(() => {
    let list = data?.recommendations ?? [];
    if (filterType) list = list.filter(r => r.contentType === filterType);
    if (variant === "rail") {
      // One per type, sorted by rank
      const seen = new Set<ContentType>();
      const picked: RecommendationItem[] = [];
      for (const r of [...list].sort((a, b) => a.rank - b.rank)) {
        if (!seen.has(r.contentType)) {
          seen.add(r.contentType);
          picked.push(r);
        }
      }
      return picked;
    }
    if (limitPerType) list = list.slice(0, limitPerType);
    return list;
  }, [data, filterType, variant, limitPerType]);

  if (isLoading) {
    return (
      <div className="mb-8" data-testid="recommendations-loading">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-[#0cc9a9]" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {title ?? "For you right now"}
          </h3>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Personalising…
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  const heading = title ?? (variant === "rail" ? "For you right now" : "Recommended for you");

  return (
    <div className="mb-8" data-testid={`recommendations-${variant}${filterType ? `-${filterType}` : ""}`}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-[#0cc9a9]" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {heading}
        </h3>
      </div>

      <div className={variant === "rail"
        ? "grid grid-cols-1 md:grid-cols-3 gap-3"
        : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"}>
        {items.map((item) => {
          const Icon = TYPE_ICON[item.contentType];
          return (
            <Card
              key={`${item.contentType}-${item.contentId}`}
              className="p-4 hover:bg-foreground/5 transition-colors relative group"
              data-testid={`rec-card-${item.contentType}-${item.contentId}`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dismissMutation.mutate(item);
                }}
                disabled={dismissMutation.isPending}
                className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-foreground/10 transition-opacity"
                aria-label="Dismiss recommendation"
                data-testid={`rec-dismiss-${item.contentType}-${item.contentId}`}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              <Link href={linkFor(item)}>
                <div className="cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-[#0cc9a9]" />
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABEL[item.contentType]}
                    </Badge>
                  </div>
                  <p className="font-semibold text-foreground line-clamp-2 mb-1">
                    {titleFor(item)}
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {metaFor(item)}
                  </p>
                  <p className="text-xs text-foreground/80 italic line-clamp-2">
                    {item.rationale}
                  </p>
                </div>
              </Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default RecommendationRail;
