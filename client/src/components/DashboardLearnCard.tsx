import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Circle, ChevronRight, CheckCircle2 } from "lucide-react";
import { startOfDay, isToday, isBefore } from "date-fns";
import type { PathContentItem } from "@shared/schema";

interface CompletedItem {
  libraryItemId: number;
  completedDate: string | null;
}

interface DashboardLearnCardProps {
  enrolledPaths: any[];
  onTileClick: (tileId: string) => void;
  onShowPathSelection?: () => void;
  selectedDate: Date;
}

function SinglePathCard({ 
  assignment, 
  completedItems,
  selectedDate
}: { 
  assignment: any; 
  completedItems: CompletedItem[];
  selectedDate: Date;
}) {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const { data: contentItems = [] } = useQuery<PathContentItem[]>({
    queryKey: [`/api/learning-paths/${assignment.pathId}/content`],
    enabled: isAuthenticated && !!assignment.pathId,
  });

  const completedMap = new Map(completedItems.map(c => [c.libraryItemId, c.completedDate]));
  const sortedItems = [...contentItems].sort((a, b) => a.orderIndex - b.orderIndex);
  
  const isItemComplete = (item: PathContentItem) => item.libraryItemId && completedMap.has(item.libraryItemId);
  const nextIncompleteItem = sortedItems.find(item => !isItemComplete(item));
  const isPathComplete = sortedItems.length > 0 && !nextIncompleteItem;
  
  if (isPathComplete && sortedItems.length > 0) {
    const pathLibraryIds = sortedItems.map(item => item.libraryItemId).filter(Boolean);
    const pathCompletionDates = pathLibraryIds
      .map(id => completedMap.get(id!))
      .filter(Boolean)
      .map(d => new Date(d!));
    
    if (pathCompletionDates.length > 0) {
      const latestCompletionDate = new Date(Math.max(...pathCompletionDates.map(d => d.getTime())));
      const viewingDay = startOfDay(selectedDate);
      const completionDay = startOfDay(latestCompletionDate);
      
      if (isBefore(completionDay, viewingDay)) {
        return null;
      }
    }
  }
  
  const displayItem = nextIncompleteItem || sortedItems[0];
  const topicTitle = displayItem?.title || assignment.path?.title || "Learning Path";
  const pathName = assignment.path?.title || "Learning Path";
  
  const nextItemAfterCurrent = isPathComplete 
    ? null 
    : sortedItems.find((item, idx) => {
        if (!nextIncompleteItem) return false;
        const currentIdx = sortedItems.findIndex(i => i.id === nextIncompleteItem.id);
        return idx > currentIdx && !isItemComplete(item);
      });

  const handleClick = () => {
    navigate(`/education-lab/path/${assignment.pathId}`);
  };

  return (
    <Card 
      className={`p-4 flex items-start justify-between hover:bg-foreground/5 active:bg-foreground/10 transition-colors cursor-pointer ${isPathComplete ? 'border-green-500/30' : ''}`}
      onClick={handleClick}
      data-testid={`card-learn-${assignment.pathId}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          {isPathComplete ? (
            <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
          ) : (
            <Circle className="h-6 w-6 text-indigo-500 flex-shrink-0" />
          )}
          <p className="text-lg font-medium text-foreground truncate">{topicTitle}</p>
        </div>
        <p className="text-sm text-muted-foreground truncate mt-1">
          {isPathComplete 
            ? `${pathName} - All lessons complete` 
            : nextItemAfterCurrent 
              ? `Next: ${nextItemAfterCurrent.title}`
              : `Next: ${pathName}`
          }
        </p>
        <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${isPathComplete ? 'bg-green-500' : 'bg-indigo-500'} text-white`}>
          {isPathComplete ? 'Completed' : 'Education'}
        </span>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground ml-4 flex-shrink-0 mt-0.5" />
    </Card>
  );
}

export default function DashboardLearnCard({ enrolledPaths, onTileClick, onShowPathSelection, selectedDate }: DashboardLearnCardProps) {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  const { data: completedItems = [] } = useQuery<CompletedItem[]>({
    queryKey: ["/api/content-progress/completed-with-dates"],
    enabled: isAuthenticated,
  });

  if (enrolledPaths.length === 0) {
    return (
      <Card 
        className="p-4 flex items-start justify-between hover:bg-foreground/5 active:bg-foreground/10 transition-colors cursor-pointer" 
        onClick={() => navigate("/education-lab")} 
        data-testid="card-learn"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <Circle className="h-6 w-6 text-indigo-500 flex-shrink-0" />
            <p className="text-lg font-medium text-foreground truncate">The Lab</p>
          </div>
          <p className="text-sm text-muted-foreground truncate mt-1">Enrol in a learning path</p>
          <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium bg-indigo-500 text-white">
            Education
          </span>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground ml-4 flex-shrink-0 mt-0.5" />
      </Card>
    );
  }

  return (
    <>
      {enrolledPaths.map((assignment: any) => (
        <SinglePathCard 
          key={assignment.pathId} 
          assignment={assignment} 
          completedItems={completedItems}
          selectedDate={selectedDate}
        />
      ))}
    </>
  );
}
