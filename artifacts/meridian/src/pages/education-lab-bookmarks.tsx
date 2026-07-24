import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, BookOpen, Heart, PlayCircle, FileText, File, Clock } from "lucide-react";
import type { LearningPath, PathContentItem } from "@shared/schema";

export default function EducationLabBookmarks() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

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

  const { data: favorites = [], isLoading: favoritesLoading } = useQuery<any[]>({
    queryKey: ["/api/favorites"],
    enabled: isAuthenticated,
  });

  const { data: learningPaths = [] } = useQuery<LearningPath[]>({
    queryKey: ["/api/learning-paths"],
    enabled: isAuthenticated,
  });

  const toggleFavouriteMutation = useMutation({
    mutationFn: async ({ contentType, contentId }: { contentType: 'learning_path' | 'content_item'; contentId: number }) => {
      return apiRequest("DELETE", "/api/favorites", { contentType, contentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
  });

  const handleUnfavorite = (e: React.MouseEvent, contentType: 'learning_path' | 'content_item', contentId: number) => {
    e.stopPropagation();
    toggleFavouriteMutation.mutate({ contentType, contentId });
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <PlayCircle className="h-5 w-5" />;
      case 'pdf':
        return <FileText className="h-5 w-5" />;
      case 'swipe_file':
        return <File className="h-5 w-5" />;
      default:
        return <File className="h-5 w-5" />;
    }
  };

  const favoritedPaths = favorites.filter(fav => fav.contentType === 'learning_path');
  const favoritedContent = favorites.filter(fav => fav.contentType === 'content_item');

  if (isLoading || favoritesLoading) {
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
      <TopHeader title="Bookmarked Content" onBack={() => navigate("/education-lab")} />
      
      <div className="p-6">

        <div className="max-w-4xl mx-auto space-y-8">
          {/* Favourited Learning Paths */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Learning Paths ({favoritedPaths.length})
            </h2>
            {favoritedPaths.length === 0 ? (
              <Card className="bg-card">
                <CardContent className="p-8 text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No bookmarked learning paths yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {favoritedPaths.map((favorite) => {
                  const path = learningPaths.find(p => p.id === favorite.learningPathId);
                  if (!path) return null;
                  
                  return (
                    <Card
                      key={favorite.id}
                      onClick={() => navigate(`/education-lab/path/${path.id}`)}
                      className="bg-card cursor-pointer hover:shadow-lg transition-shadow"
                      data-testid={`bookmarked-path-${path.id}`}
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
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => handleUnfavorite(e, 'learning_path', path.id)}
                                data-testid={`button-unfavorite-path-${path.id}`}
                              >
                                <Heart className="h-5 w-5 fill-primary text-primary" />
                              </Button>
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
                              {path.category && (
                                <Badge variant="outline" className="text-xs capitalize">
                                  {path.category}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Favourited Content Items */}
          {favoritedContent.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Individual Content ({favoritedContent.length})
              </h2>
              <div className="space-y-3">
                {favoritedContent.map((favorite) => (
                  <Card
                    key={favorite.id}
                    className="bg-card"
                    data-testid={`bookmarked-content-${favorite.contentItemId}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 text-primary">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-foreground">
                              Content Item #{favorite.contentItemId}
                            </h3>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Bookmarked content item
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => handleUnfavorite(e, 'content_item', favorite.contentItemId)}
                          data-testid={`button-unfavorite-content-${favorite.contentItemId}`}
                        >
                          <Heart className="h-4 w-4 fill-primary text-primary" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
