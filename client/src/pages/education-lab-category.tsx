import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, BookOpen, Clock, CheckCircle2, Filter, Heart } from "lucide-react";
import type { LearningPath } from "@shared/schema";

export default function EducationLabCategory() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/education-lab/:category");
  const category = params?.category || "nutrition";

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

  const { data: learningPaths = [], isLoading: pathsLoading } = useQuery<LearningPath[]>({
    queryKey: ["/api/learning-paths", { category }],
    enabled: isAuthenticated,
  });

  const { data: favorites = [] } = useQuery<any[]>({
    queryKey: ["/api/favorites"],
    enabled: isAuthenticated,
  });

  const toggleFavouriteMutation = useMutation({
    mutationFn: async ({ contentId, isFavourited }: { contentId: number; isFavourited: boolean }) => {
      if (isFavourited) {
        return apiRequest("DELETE", "/api/favorites", { contentType: "learning_path", contentId });
      } else {
        return apiRequest("POST", "/api/favorites", { contentType: "learning_path", contentId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
  });

  const isFavourited = (pathId: number) => {
    return favorites.some(
      (fav: any) => fav.contentType === "learning_path" && fav.learningPathId === pathId
    );
  };

  const handleFavouriteClick = (e: React.MouseEvent, pathId: number) => {
    e.stopPropagation();
    toggleFavouriteMutation.mutate({ contentId: pathId, isFavourited: isFavourited(pathId) });
  };

  const categoryTitles: Record<string, string> = {
    nutrition: "Nutrition Learning Paths",
    mindset: "Mindset Learning Paths",
    exercise: "Exercise Learning Paths",
    stress: "Stress Management Paths",
    recovery: "Recovery Learning Paths",
    lifestyle: "Lifestyle Learning Paths"
  };

  if (isLoading || pathsLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader title={categoryTitles[category] || "Learning Paths"} />
      
      <div className="p-6 pt-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/education-lab")}
          className="mb-4 -ml-3 p-1"
          data-testid="button-back-to-education"
        >
          <ChevronLeft className="h-7 w-7" />
        </Button>

        <div className="max-w-4xl mx-auto">
          {/* Filter Button */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              {learningPaths.length} Path{learningPaths.length !== 1 ? 's' : ''} Available
            </h2>
            <Button variant="outline" size="sm" data-testid="button-filter">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>

          {/* Learning Paths List */}
          <div className="space-y-4">
            {learningPaths.length === 0 ? (
              <Card className="bg-card">
                <CardContent className="p-8 text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No learning paths yet
                  </h3>
                  <p className="text-muted-foreground">
                    Learning paths for this category are coming soon
                  </p>
                </CardContent>
              </Card>
            ) : (
              learningPaths.map((path) => (
                <Card
                  key={path.id}
                  onClick={() => navigate(`/education-lab/path/${path.id}`)}
                  className="bg-card cursor-pointer hover:shadow-lg transition-shadow"
                  data-testid={`path-card-${path.id}`}
                >
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      {path.imageUrl && (
                        <img
                          src={path.imageUrl}
                          alt={path.title}
                          className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-foreground">
                            {path.title}
                          </h3>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {path.isRecommended && (
                              <Badge className="bg-primary/20 text-primary">
                                Recommended
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => handleFavouriteClick(e, path.id)}
                              data-testid={`button-favorite-path-${path.id}`}
                            >
                              <Heart
                                className={`h-5 w-5 ${
                                  isFavourited(path.id)
                                    ? "fill-primary text-primary"
                                    : "text-muted-foreground"
                                }`}
                              />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {path.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {path.estimatedDuration && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {path.estimatedDuration} min
                            </div>
                          )}
                          {path.difficulty && (
                            <Badge variant="outline" className="text-xs">
                              {path.difficulty}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
