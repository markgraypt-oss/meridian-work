import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, Check, Heart, Play, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import MuxPlayer from "@mux/mux-player-react";
import type { LearnTopic, UserFavourite, LearnContentLibraryItem } from "@shared/schema";

export default function LearnTopicVideoDetail() {
  const [, params] = useRoute("/learn/:slug/video/:contentId");
  const slug = params?.slug || "";
  const contentId = parseInt(params?.contentId || "0");
  const [, navigate] = useLocation();

  const { data: topic } = useQuery<LearnTopic>({
    queryKey: [`/api/learn-topics/${slug}`],
    enabled: !!slug,
  });

  const { data: contentItems = [] } = useQuery<LearnContentLibraryItem[]>({
    queryKey: [`/api/content-library/topic/${topic?.id}`],
    enabled: !!topic?.id,
  });

  const { data: completedIds = [] } = useQuery<number[]>({
    queryKey: ["/api/content-progress/completed-ids"],
  });

  const { data: favourites = [] } = useQuery<UserFavourite[]>({
    queryKey: ["/api/favorites"],
  });

  const currentItem = contentItems.find(item => item.id === contentId);
  const sortedItems = [...contentItems].sort((a, b) => a.id - b.id);
  const currentIndex = sortedItems.findIndex(item => item.id === contentId);
  const nextItem = currentIndex >= 0 && currentIndex < sortedItems.length - 1 
    ? sortedItems[currentIndex + 1] 
    : null;

  const isCompleted = completedIds.includes(contentId);
  const isFavourited = favourites.some(f => f.contentItemId === contentId);

  const lastSavedProgress = useRef(0);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveWatchProgress = useCallback((progress: number) => {
    const rounded = Math.round(progress);
    if (Math.abs(rounded - lastSavedProgress.current) < 3) return;
    lastSavedProgress.current = rounded;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      apiRequest("PATCH", `/api/content-library/${contentId}/watch-progress`, { progress: rounded })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/content-progress/watch-progress"] });
          if (rounded >= 95) {
            queryClient.invalidateQueries({ queryKey: ["/api/content-progress/completed-ids"] });
          }
        })
        .catch(() => {});
    }, 2000);
  }, [contentId]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleTimeUpdate = useCallback((e: Event) => {
    const target = e.target as HTMLVideoElement;
    if (target.duration > 0) {
      const pct = (target.currentTime / target.duration) * 100;
      saveWatchProgress(pct);
    }
  }, [saveWatchProgress]);

  const toggleCompleteMutation = useMutation({
    mutationFn: async (currentlyCompleted: boolean) => {
      if (currentlyCompleted) {
        return apiRequest("DELETE", `/api/content-library/${contentId}/complete`);
      } else {
        return apiRequest("POST", `/api/content-library/${contentId}/complete`);
      }
    },
    onMutate: async (currentlyCompleted: boolean) => {
      await queryClient.cancelQueries({ queryKey: ["/api/content-progress/completed-ids"] });
      const previousIds = queryClient.getQueryData<number[]>(["/api/content-progress/completed-ids"]);
      if (currentlyCompleted) {
        queryClient.setQueryData<number[]>(["/api/content-progress/completed-ids"], (old) => 
          (old || []).filter(id => id !== contentId)
        );
      } else {
        queryClient.setQueryData<number[]>(["/api/content-progress/completed-ids"], (old) => 
          [...(old || []), contentId]
        );
      }
      return { previousIds };
    },
    onError: (err, variables, context) => {
      if (context?.previousIds) {
        queryClient.setQueryData(["/api/content-progress/completed-ids"], context.previousIds);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-progress/completed-ids"] });
    },
  });

  const toggleFavouriteMutation = useMutation({
    mutationFn: async (currentlyFavourited: boolean) => {
      if (currentlyFavourited) {
        return apiRequest("DELETE", "/api/favorites", { contentType: "content_item", contentId: contentId });
      } else {
        return apiRequest("POST", "/api/favorites", { contentType: "content_item", contentId: contentId });
      }
    },
    onMutate: async (currentlyFavourited: boolean) => {
      await queryClient.cancelQueries({ queryKey: ["/api/favorites"] });
      const previousFavourites = queryClient.getQueryData<UserFavourite[]>(["/api/favorites"]);
      if (currentlyFavourited) {
        queryClient.setQueryData<UserFavourite[]>(["/api/favorites"], (old) => 
          (old || []).filter(f => f.contentItemId !== contentId)
        );
      } else {
        queryClient.setQueryData<UserFavourite[]>(["/api/favorites"], (old) => 
          [...(old || []), { id: Date.now(), contentItemId: contentId, contentType: "content_item" } as UserFavourite]
        );
      }
      return { previousFavourites };
    },
    onError: (err, variables, context) => {
      if (context?.previousFavourites) {
        queryClient.setQueryData(["/api/favorites"], context.previousFavourites);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
  });

  if (!currentItem) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const formatDuration = (durationSeconds: number | null) => {
    if (!durationSeconds) return "";
    const mins = Math.floor(durationSeconds / 60);
    const secs = durationSeconds % 60;
    return secs > 0 ? `${mins} min ${secs}s` : `${mins} min`;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-background h-12 flex items-center px-4 sticky top-0 z-10">
        <button 
          onClick={() => navigate(`/learn/${slug}`)}
          className="text-foreground"
          data-testid="button-back"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="flex-1 text-center text-foreground font-medium text-base truncate px-4">
          {currentItem.title}
        </h1>
        <div className="w-6" />
      </div>

      {/* Video Player Area */}
      <div className="relative aspect-video bg-black">
        {currentItem.muxPlaybackId ? (
          <MuxPlayer
            playbackId={currentItem.muxPlaybackId}
            metadata={{
              video_title: currentItem.title,
            }}
            streamType="on-demand"
            className="w-full h-full"
            data-testid="mux-video-player"
            onTimeUpdate={handleTimeUpdate as any}
          />
        ) : currentItem.contentUrl ? (
          <>
            {currentItem.thumbnailUrl ? (
              <img 
                src={currentItem.thumbnailUrl} 
                alt={currentItem.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                <Play className="h-16 w-16 text-gray-500" />
              </div>
            )}
            
            {/* Play Button Overlay for non-Mux videos */}
            <div className="absolute inset-0 flex items-center justify-center">
              <button 
                className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
                onClick={() => window.open(currentItem.contentUrl!, '_blank')}
                data-testid="button-play-video"
              >
                <Play className="h-8 w-8 text-white fill-white" />
              </button>
            </div>
          </>
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <Play className="h-16 w-16 text-gray-500" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        {/* Title and Video Number */}
        <h2 className="text-xl font-bold text-foreground mb-1" data-testid="text-video-title">{currentItem.title}</h2>
        <p className="text-sm text-muted-foreground mb-3" data-testid="text-lesson-progress">
          Video {currentIndex + 1} of {sortedItems.length}
        </p>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-6">
          <Button
            variant="outline"
            size="icon"
            className={`h-10 w-10 rounded-full ${isCompleted ? 'text-green-500 border-green-500 bg-green-500/10' : ''}`}
            onClick={() => toggleCompleteMutation.mutate(isCompleted)}
            disabled={toggleCompleteMutation.isPending}
            data-testid="button-complete"
          >
            <Check className={`h-5 w-5 ${isCompleted ? 'stroke-[3]' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={`h-10 w-10 rounded-full ${isFavourited ? 'text-red-500 border-red-500' : ''}`}
            onClick={() => toggleFavouriteMutation.mutate(isFavourited)}
            disabled={toggleFavouriteMutation.isPending}
            data-testid="button-favourite"
          >
            <Heart className={`h-5 w-5 ${isFavourited ? 'fill-red-500' : ''}`} />
          </Button>
        </div>

        {/* Key Topics Covered */}
        {currentItem.description && (
          <div className="mb-6">
            <h3 className="text-base font-semibold text-foreground mb-3">Key Topics Covered:</h3>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
              {currentItem.description}
            </div>
          </div>
        )}

        {/* Tags */}
        {currentItem.tags && currentItem.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {currentItem.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Duration */}
        {currentItem.duration && (
          <div className="mb-6 text-sm text-muted-foreground">
            Duration: {formatDuration(currentItem.duration)}
          </div>
        )}

        {/* Attached Documents */}
        {currentItem.contentUrl && (currentItem.contentType === 'pdf' || currentItem.contentType === 'swipe_file' || currentItem.contentType === 'document') && (
          <div className="mb-6">
            <h3 className="text-base font-semibold text-foreground mb-3">Resources</h3>
            <Card 
              className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => window.open(currentItem.contentUrl!, '_blank')}
              data-testid="card-attached-document"
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm">
                      {currentItem.contentType === 'pdf' ? 'PDF Document' : 'Download Resource'}
                    </p>
                    <p className="text-xs text-muted-foreground">Tap to open</p>
                  </div>
                  <Download className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Up Next */}
        {nextItem && (
          <div className="mb-6">
            <div className="border-t border-border my-4" />
            <h3 className="text-base font-semibold text-foreground mb-3">Up next</h3>
            <Card 
              className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/learn/${slug}/video/${nextItem.id}`)}
              data-testid={`card-next-video-${nextItem.id}`}
            >
              <div className="flex">
                {nextItem.thumbnailUrl ? (
                  <div className="w-24 h-16 flex-shrink-0">
                    <img 
                      src={nextItem.thumbnailUrl} 
                      alt={nextItem.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-24 h-16 flex-shrink-0 bg-gray-800 flex items-center justify-center">
                    <Play className="h-6 w-6 text-gray-500" />
                  </div>
                )}
                <CardContent className="p-3 flex-1">
                  <h4 className="font-medium text-foreground text-sm line-clamp-2">
                    {nextItem.title}
                  </h4>
                  {nextItem.duration && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDuration(nextItem.duration)}
                    </p>
                  )}
                </CardContent>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
