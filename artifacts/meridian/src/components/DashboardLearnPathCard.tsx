import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PathContentItem } from "@shared/schema";

interface DashboardLearnPathCardProps {
  assignment: any;
  onTileClick: (tileId: string) => void;
}

export default function DashboardLearnPathCard({ assignment, onTileClick }: DashboardLearnPathCardProps) {
  const { isAuthenticated } = useAuth();

  const { data: contentItems = [] } = useQuery<PathContentItem[]>({
    queryKey: [`/api/learning-paths/${assignment.pathId}/content`],
    enabled: isAuthenticated && !!assignment.pathId,
  });

  // Find next unwatched video
  const nextVideo = contentItems.find(
    (item: any) => item.contentType === 'video' && !item.completed
  ) || contentItems.find((item: any) => item.contentType === 'video');

  const videoTitle = nextVideo?.title || "View path";
  const displayTitle = `${assignment.path?.title || 'Learning Path'} • ${nextVideo ? 'Next: ' + videoTitle : 'No videos'}`;

  return (
    <Card 
      className="p-4 flex items-center justify-between hover:bg-foreground/5 active:bg-foreground/10 transition-colors cursor-pointer" 
      onClick={() => onTileClick('learn')}
      data-testid={`card-learn-path-${assignment.pathId}`}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">🎬 The Lab</p>
        <p className="text-sm text-muted-foreground truncate">{displayTitle}</p>
      </div>
      <Button size="sm" className="bg-primary ml-4 pointer-events-none" data-testid={`button-learn-path-${assignment.pathId}`}>Continue</Button>
    </Card>
  );
}
