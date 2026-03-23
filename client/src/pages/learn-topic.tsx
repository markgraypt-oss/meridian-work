import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Heart, ChevronUp, PlaySquare, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { LearnTopic, LearningPath, LearnContentLibraryItem, UserContentProgress } from "@shared/schema";

export default function LearnTopicPage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/learn/:slug");
  const slug = params?.slug || "";
  const [pathContentMap, setPathContentMap] = useState<Record<number, any[]>>({});
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const { data: topic, isLoading: topicLoading } = useQuery<LearnTopic>({
    queryKey: [`/api/learn-topics/${slug}`],
    enabled: isAuthenticated && !!slug,
  });

  const { data: paths = [], isLoading: pathsLoading } = useQuery<LearningPath[]>({
    queryKey: [`/api/learn-topics/${topic?.id}/paths`],
    enabled: isAuthenticated && !!topic?.id,
  });

  const { data: allContent = [] } = useQuery<LearnContentLibraryItem[]>({
    queryKey: [`/api/content-library/topic/${topic?.id}`],
    enabled: isAuthenticated && !!topic?.id,
  });

  const { data: userProgress = [] } = useQuery<UserContentProgress[]>({
    queryKey: ["/api/content-progress"],
    enabled: isAuthenticated,
  });

  const completedIds = userProgress.filter(p => p.completed).map(p => p.libraryItemId);

  const { data: watchProgressMap = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/content-progress/watch-progress"],
    enabled: isAuthenticated,
  });

  const { data: favorites = [] } = useQuery<any[]>({
    queryKey: ["/api/favorites"],
    enabled: isAuthenticated,
  });

  // Fetch content for each path using TanStack Query for proper auth
  useEffect(() => {
    const fetchPathContent = async () => {
      if (!isAuthenticated || paths.length === 0) return;
      
      const contentMap: Record<number, any[]> = {};
      
      for (const path of paths) {
        try {
          const response = await fetch(`/api/learning-paths/${path.id}/library-content`, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          if (response.ok) {
            const data = await response.json();
            contentMap[path.id] = Array.isArray(data) ? data : [];
          } else {
            contentMap[path.id] = [];
          }
        } catch (error) {
          console.error(`Failed to fetch content for path ${path.id}:`, error);
          contentMap[path.id] = [];
        }
      }
      
      setPathContentMap(contentMap);
    };
    
    fetchPathContent();
  }, [paths, isAuthenticated]);

  const calculatePathStats = (pathId: number) => {
    const pathContentData = pathContentMap[pathId] || [];
    const totalVideos = pathContentData.length;
    
    const watchedCount = pathContentData.filter(
      (item: any) => completedIds.includes(item.id)
    ).length;

    const percentage = totalVideos > 0 ? Math.round((watchedCount / totalVideos) * 100) : 0;
    return { totalVideos, watchedCount, percentage };
  };

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

  const isFavourited = (contentType: 'learning_path' | 'content_item', contentId: number) => {
    if (contentType === 'learning_path') {
      return favorites.some(
        (fav: any) => fav.contentType === 'learning_path' && fav.learningPathId === contentId
      );
    } else {
      return favorites.some(
        (fav: any) => fav.contentType === 'content_item' && fav.contentItemId === contentId
      );
    }
  };

  const handleToggleFavourite = (e: React.MouseEvent, contentType: 'learning_path' | 'content_item', contentId: number) => {
    e.stopPropagation();
    toggleFavouriteMutation.mutate({
      contentType,
      contentId,
      isFavourited: isFavourited(contentType, contentId),
    });
  };


  if (isLoading || topicLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <TopHeader title="Learn" />
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Topic not found</p>
          <Button onClick={() => navigate("/learn")} className="mt-4">
            Back to Topics
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader title={topic.title} onBack={() => navigate("/learn")} />
      
      <div className="p-6 pt-4">
        <div className="max-w-4xl mx-auto">
          {/* Topic Description and Overall Progress */}
          <div className="mb-6">
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              {topic.description}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden border border-black/10">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all" 
                  style={{ width: `${allContent.length > 0 ? Math.round((completedIds.filter(id => allContent.some(c => c.id === id)).length / allContent.length) * 100) : 0}%` }}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                {completedIds.filter(id => allContent.some(c => c.id === id)).length}/{allContent.length} complete
              </span>
            </div>
          </div>

          {/* Curated Paths Section */}
          {paths.length > 0 && (
            <div className="mb-10">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Curated Learning Paths
              </h2>
              <div className="space-y-3">
                {paths.map((path) => {
                  const stats = calculatePathStats(path.id);
                  return (
                    <Card
                      key={path.id}
                      onClick={() => navigate(`/education-lab/path/${path.id}`)}
                      className="cursor-pointer hover:shadow-md transition-shadow group"
                      data-testid={`path-card-${path.id}`}
                    >
                      <CardContent className="p-4 flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {path.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {path.description}
                          </p>
                          <div className="flex gap-2 mt-3 flex-wrap">
                            {path.estimatedDuration && (
                              <Badge variant="outline" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {path.estimatedDuration} min
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {stats.watchedCount}/{stats.totalVideos} ({stats.percentage}%)
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleToggleFavourite(e, 'learning_path', path.id)}
                          data-testid={`button-favorite-path-${path.id}`}
                        >
                          <Heart
                            className={`h-5 w-5 ${
                              isFavourited('learning_path', path.id)
                                ? 'fill-red-500 text-red-500'
                                : 'text-muted-foreground'
                            }`}
                          />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* All Videos Section */}
          <div className="mt-6 space-y-3">
            {(() => {
              const filteredContent = allContent.filter((item: any) =>
                item.title.toLowerCase().includes(searchQuery.toLowerCase())
              );
              
              if (filteredContent.length === 0) {
                return (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      {searchQuery ? 'No videos match your search' : 'No videos available for this topic'}
                    </p>
                  </div>
                );
              }
              
              return filteredContent.map((item: any) => {
                const isCompleted = completedIds.includes(item.id);
                const watchPct = (watchProgressMap as Record<string, number>)[String(item.id)] ?? 0;
                const showProgress = isCompleted || watchPct > 0;
                const displayPct = isCompleted ? 100 : watchPct;
                const formatDuration = (durationSeconds: number | null) => {
                  if (!durationSeconds) return '';
                  const mins = Math.floor(durationSeconds / 60);
                  const secs = durationSeconds % 60;
                  return secs > 0 ? `${mins}min ${secs}s` : `${mins}min`;
                };
                return (
                  <Card
                    key={item.id}
                    onClick={() => navigate(`/learn/${slug}/video/${item.id}`)}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    data-testid={`content-card-${item.id}`}
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
              });
            })()}
          </div>
        </div>

        {/* Back to Top Button */}
        {showBackToTop && (
          <Button
            onClick={scrollToTop}
            className="fixed bottom-28 right-5 rounded-full shadow-lg hover:shadow-xl transition-shadow"
            size="icon"
            data-testid="button-back-to-top"
          >
            <ChevronUp className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
