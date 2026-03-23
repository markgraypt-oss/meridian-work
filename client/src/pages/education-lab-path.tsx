import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Heart, PlaySquare } from "lucide-react";
import type { LearningPath, LearnContentLibraryItem } from "@shared/schema";

type PathLibraryContent = LearnContentLibraryItem & { orderIndex: number; isRequired: boolean | null; pathContentId: number };

export default function EducationLabPath() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/education-lab/path/:id");
  const pathId = params?.id;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: learningPath, isLoading: pathLoading } = useQuery<LearningPath>({
    queryKey: [`/api/learning-paths/${pathId}`],
    enabled: isAuthenticated && !!pathId,
  });

  const { data: contentItems = [], isLoading: contentLoading } = useQuery<PathLibraryContent[]>({
    queryKey: [`/api/learning-paths/${pathId}/library-content`],
    enabled: isAuthenticated && !!pathId,
  });

  const { data: favorites = [] } = useQuery<any[]>({
    queryKey: ["/api/favorites"],
    enabled: isAuthenticated,
  });

  const { data: enrolledPaths = [] } = useQuery({
    queryKey: ["/api/user-path-assignments"],
    enabled: isAuthenticated,
  });

  const { data: completedIds = [] } = useQuery<number[]>({
    queryKey: ["/api/content-progress/completed-ids"],
    enabled: isAuthenticated,
  });

  const { data: watchProgressMap = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/content-progress/watch-progress"],
    enabled: isAuthenticated,
  });

  const isEnrolled = enrolledPaths.some((assignment: any) => assignment.pathId === parseInt(pathId || "0"));
  const completedCount = contentItems.filter(item => completedIds.includes(item.id)).length;
  const progressPercent = contentItems.length > 0 ? Math.round((completedCount / contentItems.length) * 100) : 0;

  const enrollPathMutation = useMutation({
    mutationFn: async (pathId: number) => {
      return apiRequest("POST", "/api/user-path-assignments", { pathId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-path-assignments"] });
      toast({
        title: "Success!",
        description: "You've enrolled in this learning path",
        duration: 2000,
      });
      setTimeout(() => {
        navigate("/education-lab");
      }, 2000);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || "Failed to enrol in learning path";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const leavePathMutation = useMutation({
    mutationFn: async (pathId: number) => {
      return apiRequest("DELETE", "/api/user-path-assignments", { pathId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-path-assignments"] });
      toast({
        title: "Success!",
        description: "You've left this learning path",
        duration: 2000,
      });
      setTimeout(() => {
        navigate("/education-lab");
      }, 2000);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || "Failed to leave learning path";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const toggleFavouriteMutation = useMutation({
    mutationFn: async ({ contentType, contentId, isFavourited }: { contentType: 'learning_path' | 'content_item'; contentId: number; isFavourited: boolean }) => {
      if (isFavourited) {
        return apiRequest("DELETE", "/api/favorites", { contentType, contentId });
      } else {
        return apiRequest("POST", "/api/favorites", { contentType, contentId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
  });

  const isPathFavourited = (pathId: number) => {
    return favorites.some(
      (fav: any) => fav.contentType === "learning_path" && fav.learningPathId === pathId
    );
  };

  const handleFavouriteClick = (e: React.MouseEvent, contentType: 'learning_path' | 'content_item', contentId: number) => {
    e.stopPropagation();
    const isFavourited = contentType === 'learning_path' ? isPathFavourited(contentId) : false;
    toggleFavouriteMutation.mutate({ contentType, contentId, isFavourited });
  };

  const formatDuration = (durationSeconds: number | null) => {
    if (!durationSeconds) return '';
    const mins = Math.floor(durationSeconds / 60);
    const secs = durationSeconds % 60;
    return secs > 0 ? `${mins}min ${secs}s` : `${mins}min`;
  };

  if (isLoading || pathLoading || contentLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!learningPath) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <TopHeader title="Learn" onBack={() => window.history.back()} />
        <div className="p-6">
          <p className="text-center text-muted-foreground">Learning path not found</p>
        </div>
      </div>
    );
  }

  const sortedItems = [...contentItems].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader title={learningPath.title} onBack={() => window.history.back()} />
      
      <div className="p-6 pt-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              {learningPath.description}
            </p>

            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {learningPath.estimatedDuration && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{learningPath.estimatedDuration} min</span>
                </div>
              )}
              {learningPath.difficulty && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {learningPath.difficulty}
                </Badge>
              )}
              <span>{contentItems.length} video{contentItems.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden border border-black/10">
                <div 
                  className={`h-full rounded-full transition-all ${
                    progressPercent >= 100 
                      ? 'bg-green-500' 
                      : 'bg-gradient-to-r from-primary to-primary/70'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                {completedCount}/{contentItems.length} complete
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {sortedItems.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Content for this path is being prepared</p>
              </div>
            ) : (
              sortedItems.map((item) => {
                const isCompleted = completedIds.includes(item.id);
                const watchPct = (watchProgressMap as Record<string, number>)[String(item.id)] ?? 0;
                const showProgress = isCompleted || watchPct > 0;
                const displayPct = isCompleted ? 100 : watchPct;

                return (
                  <Card
                    key={item.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => {
                      if (item.contentType === 'video') {
                        navigate(`/learn/path/${pathId}/video/${item.id}`);
                      } else if (item.contentUrl) {
                        window.open(item.contentUrl, '_blank');
                      }
                    }}
                    data-testid={`content-item-${item.id}`}
                  >
                    <CardContent className="p-4">
                      <h3 className="font-medium text-foreground text-sm">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5">
                        <PlaySquare className="h-3.5 w-3.5" />
                        <span>{formatDuration(item.duration)}</span>
                      </div>
                      {showProgress && (
                        <div className="mt-2.5 h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${displayPct}%` }}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          <div className="mt-6">
            {isEnrolled ? (
              <Button 
                className="w-full" 
                size="lg" 
                variant="destructive"
                onClick={() => leavePathMutation.mutate(parseInt(pathId!))}
                disabled={leavePathMutation.isPending}
                data-testid="button-leave-path"
              >
                {leavePathMutation.isPending ? "Leaving..." : "Leave this path"}
              </Button>
            ) : (
              <Button 
                className="w-full btn-primary" 
                size="lg" 
                onClick={() => enrollPathMutation.mutate(parseInt(pathId!))}
                disabled={enrollPathMutation.isPending}
                data-testid="button-start-path"
              >
                {enrollPathMutation.isPending ? "Enrolling..." : "Start Learning Path"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
