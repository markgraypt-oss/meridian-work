import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import type { PathContentItem } from "@shared/schema";

interface PathSelectionDialogProps {
  enrolledPaths: any[];
  onSelectPath: (pathId: number) => void;
}

function PathOption({ assignment, onSelect }: { assignment: any; onSelect: (pathId: number) => void }) {
  const { isAuthenticated } = useAuth();

  const { data: contentItems = [] } = useQuery<PathContentItem[]>({
    queryKey: [`/api/learning-paths/${assignment.pathId}/content`],
    enabled: isAuthenticated && !!assignment.pathId,
  });

  const nextVideo = contentItems.find(
    (item: any) => item.contentType === 'video' && !item.completed
  ) || contentItems.find((item: any) => item.contentType === 'video');

  const videoTitle = nextVideo?.title || "View path";

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div>
        <p className="font-medium text-foreground">{assignment.path?.title}</p>
        <p className="text-sm text-muted-foreground">Next: {videoTitle}</p>
      </div>
      <Button
        onClick={() => onSelect(assignment.pathId)}
        className="w-full bg-primary hover:bg-primary/90"
      >
        Continue this path
      </Button>
    </div>
  );
}

export default function PathSelectionDialog({ enrolledPaths, onSelectPath }: PathSelectionDialogProps) {
  return (
    <div className="space-y-3">
      {enrolledPaths.map((assignment: any) => (
        <PathOption
          key={assignment.pathId}
          assignment={assignment}
          onSelect={onSelectPath}
        />
      ))}
    </div>
  );
}
