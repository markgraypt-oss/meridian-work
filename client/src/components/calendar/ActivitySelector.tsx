import { ChevronLeft, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ActivitySelectorProps {
  selectedDate: Date;
  onBack: () => void;
  onSelectActivity: (activity: string) => void;
}

const ACTIVITIES = [
  { name: "Running", icon: "🏃" },
  { name: "Cycling", icon: "🚴" },
  { name: "Swimming", icon: "🏊" },
  { name: "Tennis", icon: "🎾" },
  { name: "Yoga", icon: "🧘" },
  { name: "Pilates", icon: "🤸" },
  { name: "Boxing", icon: "🥊" },
  { name: "Soccer", icon: "⚽" },
  { name: "Basketball", icon: "🏀" },
  { name: "Volleyball", icon: "🏐" },
  { name: "Golf", icon: "⛳" },
  { name: "Hiking", icon: "🥾" },
  { name: "Rock Climbing", icon: "🧗" },
  { name: "Skiing", icon: "⛷️" },
  { name: "Snowboarding", icon: "🏂" },
  { name: "Surfing", icon: "🏄" },
  { name: "Rowing", icon: "🚣" },
  { name: "Dancing", icon: "💃" },
  { name: "Martial Arts", icon: "🥋" },
  { name: "CrossFit", icon: "🏋️" },
  { name: "Strength Training", icon: "💪" },
  { name: "Squash", icon: "🎯" },
  { name: "Table Tennis", icon: "🏓" },
  { name: "Badminton", icon: "🏸" },
  { name: "Skating", icon: "⛸️" },
  { name: "Walking", icon: "🚶" },
  { name: "Stretching", icon: "🤸" },
  { name: "Meditation", icon: "🧘" },
];

export default function ActivitySelector({ selectedDate, onBack, onSelectActivity }: ActivitySelectorProps) {
  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="bg-background text-foreground px-4 py-4 flex items-center justify-between border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-foreground hover:bg-muted"
          data-testid="button-back-activity"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-semibold">Activities</h1>
        <Button
          variant="ghost"
          size="sm"
          className="text-foreground"
          data-testid="button-today"
        >
          TODAY
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 bg-background text-foreground overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-2">
            {ACTIVITIES.map((activity) => (
              <button
                key={activity.name}
                onClick={() => onSelectActivity(activity.name)}
                className="w-full flex items-center gap-4 bg-green-500 hover:bg-green-600 rounded-full py-3 px-4 transition-colors"
                data-testid={`activity-${activity.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="bg-white/20 p-2 rounded-full w-10 h-10 flex items-center justify-center text-xl">
                  {activity.icon}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{activity.name}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-foreground/80"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
