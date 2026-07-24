import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import MuxPlayer from "@mux/mux-player-react";
import type { Video } from "@shared/schema";

export default function LearnVideoStandalone() {
  const [, params] = useRoute("/learn/video/:contentId");
  const contentId = parseInt(params?.contentId || "0");
  const [, navigate] = useLocation();

  const { data: video, isLoading } = useQuery<Video>({
    queryKey: [`/api/videos/${contentId}`],
    enabled: contentId > 0,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="ghost" onClick={() => navigate("/learn")} data-testid="button-back">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Learn
        </Button>
        <p className="mt-6 text-muted-foreground">This video is no longer available.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-4">
      <Button variant="ghost" onClick={() => navigate("/learn")} data-testid="button-back">
        <ChevronLeft className="h-4 w-4 mr-1" /> Back to Learn
      </Button>
      <Card>
        <CardContent className="p-0 overflow-hidden rounded-lg">
          {video.muxPlaybackId ? (
            <MuxPlayer
              playbackId={video.muxPlaybackId}
              metadata={{ video_id: String(video.id), video_title: video.title }}
              streamType="on-demand"
              accentColor="#000"
            />
          ) : (
            <div className="aspect-video bg-muted flex items-center justify-center text-muted-foreground">
              Video not yet uploaded
            </div>
          )}
        </CardContent>
      </Card>
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" data-testid="badge-category">{video.category}</Badge>
          <span className="text-sm text-muted-foreground">{video.instructor}</span>
        </div>
        <h1 className="text-2xl font-bold" data-testid="text-title">{video.title}</h1>
        <p className="text-muted-foreground" data-testid="text-description">{video.description}</p>
      </div>
    </div>
  );
}
