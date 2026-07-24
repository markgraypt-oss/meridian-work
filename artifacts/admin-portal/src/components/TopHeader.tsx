import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TopHeaderProps {
  title?: string;
  onBack?: () => void;
  useCloseIcon?: boolean;
  showProfile?: boolean;
  showCalendarIcon?: boolean;
  onTodayClick?: () => void;
  selectedDate?: Date;
  [key: string]: unknown;
}

export default function TopHeader({ title, onBack, useCloseIcon }: TopHeaderProps) {
  if (!title && !onBack) return null;

  return (
    <header className="sticky top-0 z-40 bg-background border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex justify-between items-center h-14">
          {onBack ? (
            <Button
              onClick={onBack}
              variant="ghost"
              className="p-0 text-foreground hover:bg-muted flex items-center justify-center z-10"
              style={{ width: "50px", height: "50px", minWidth: "50px", minHeight: "50px" }}
              data-testid={useCloseIcon ? "button-close" : "button-back-to-topics"}
            >
              {useCloseIcon ? (
                <X className="w-6 h-6" style={{ width: "24px", height: "24px" }} />
              ) : (
                <ChevronLeft className="w-6 h-6" style={{ width: "28px", height: "28px" }} />
              )}
            </Button>
          ) : (
            <div className="w-8" />
          )}

          {title && (
            <h1
              className="absolute left-1/2 transform -translate-x-1/2 text-foreground text-base font-semibold max-w-[55%] truncate text-center pointer-events-none"
              data-testid="header-title"
            >
              {title}
            </h1>
          )}

          <div className="w-8" />
        </div>
      </div>
    </header>
  );
}
