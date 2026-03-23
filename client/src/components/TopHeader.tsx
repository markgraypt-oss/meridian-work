import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { User, ChevronLeft, Calendar, X, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isSameDay, format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

function getStreakStyle(streak: number): { color: string; showFlame: boolean; flameColor: string } {
  if (streak >= 500) {
    return { color: "text-cyan-400", showFlame: true, flameColor: "text-cyan-400" }; // Platinum
  } else if (streak >= 250) {
    return { color: "text-[#0cc9a9]", showFlame: true, flameColor: "text-[#0cc9a9]" }; // Gold
  } else if (streak >= 100) {
    return { color: "text-orange-400", showFlame: true, flameColor: "text-orange-400" }; // Bronze flame
  } else if (streak >= 30) {
    return { color: "text-[#0cc9a9]", showFlame: false, flameColor: "" };
  } else if (streak >= 7) {
    return { color: "text-green-400", showFlame: false, flameColor: "" };
  }
  return { color: "text-muted-foreground", showFlame: false, flameColor: "" };
}

interface TopHeaderProps {
  title?: string;
  onTodayClick?: () => void;
  showDateNavigator?: boolean;
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
  onOpenCalendar?: () => void;
  showProfile?: boolean;
  onBack?: () => void;
  rightActionLabel?: string;
  rightActionIcon?: React.ReactNode;
  onRightAction?: () => void;
  rightMenuButton?: React.ReactNode;
  showCalendarIcon?: boolean;
  useCloseIcon?: boolean;
}

export default function TopHeader({ 
  title, 
  onTodayClick, 
  showDateNavigator = false,
  selectedDate = new Date(),
  onDateChange,
  onOpenCalendar,
  showProfile = false,
  onBack,
  rightActionLabel,
  rightActionIcon,
  onRightAction,
  rightMenuButton,
  showCalendarIcon = false,
  useCloseIcon = false
}: TopHeaderProps = {}) {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const isToday = isSameDay(selectedDate, new Date());

  const { data: userProfile } = useQuery<{ profileImageUrl?: string | null }>({
    queryKey: ['/api/user/profile'],
    enabled: showProfile,
  });

  const { data: streakData } = useQuery<{ currentStreak: number; longestStreak: number }>({
    queryKey: ['/api/user/streak'],
    enabled: showProfile,
  });

  const streak = streakData?.currentStreak || 0;
  const streakStyle = getStreakStyle(streak);

  return (
    <header 
      className="fixed top-0 left-0 right-0 z-50 bg-background"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex justify-between items-center h-14">
          {onBack ? (
            <Button
              onClick={onBack}
              variant="ghost"
              className="p-0 text-foreground hover:bg-muted flex items-center justify-center z-10"
              style={{ width: '50px', height: '50px', minWidth: '50px', minHeight: '50px' }}
              data-testid={useCloseIcon ? "button-close" : "button-back-to-topics"}
            >
              {useCloseIcon ? (
                <X className="w-6 h-6" style={{ width: '24px', height: '24px' }} />
              ) : (
                <ChevronLeft className="w-6 h-6" style={{ width: '28px', height: '28px' }} />
              )}
            </Button>
          ) : showProfile ? (
            <div className="flex items-center z-10 relative">
              <Link href="/profile" data-testid="link-profile" className="z-10">
                <div className="flex items-center cursor-pointer">
                  {userProfile?.profileImageUrl ? (
                    <img 
                      src={userProfile.profileImageUrl} 
                      alt="Profile" 
                      className="h-8 w-8 rounded-full object-cover ring-2 ring-background"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center ring-2 ring-background">
                      <User className="h-5 w-5 text-foreground" />
                    </div>
                  )}
                </div>
              </Link>
              <div className="flex items-center gap-0.5 bg-card rounded-full h-6 pl-4 pr-2 -ml-3 z-0">
                {streakStyle.showFlame && (
                  <Flame className={`h-3.5 w-3.5 ${streakStyle.flameColor}`} />
                )}
                <span className={`text-xs font-semibold ${streakStyle.color}`}>
                  {streak}
                </span>
              </div>
            </div>
          ) : (
            <div className="w-8"></div>
          )}
          
          {title ? (
            <h1 className="absolute left-1/2 transform -translate-x-1/2 text-foreground text-base font-semibold max-w-[55%] truncate text-center pointer-events-none" data-testid="header-title">
              {title}
            </h1>
          ) : showCalendarIcon ? (
            <span className="absolute left-1/2 transform -translate-x-1/2 text-foreground text-sm font-medium" data-testid="header-month-year">
              {format(selectedDate, "MMMM yyyy")}
            </span>
          ) : null}
          
          <div className="flex items-center gap-2">
            {showCalendarIcon && onTodayClick && (
              <Button
                onClick={onTodayClick}
                variant="ghost"
                size="sm"
                className="text-foreground hover:bg-muted text-xs px-2"
                data-testid="button-today"
              >
                Today
              </Button>
            )}
            {showCalendarIcon && (
              <Button
                onClick={() => onOpenCalendar?.()}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-foreground hover:bg-muted"
                data-testid="button-calendar-icon"
              >
                <Calendar className="h-5 w-5" />
              </Button>
            )}
            {onRightAction ? (
              <Button
                onClick={onRightAction}
                variant="ghost"
                size="sm"
                className="text-foreground hover:bg-muted flex items-center gap-2"
                data-testid="button-right-action"
              >
                {rightActionIcon}
                {rightActionLabel && <span className="text-sm font-medium">{rightActionLabel}</span>}
              </Button>
            ) : !showCalendarIcon && onTodayClick ? (
              <Button
                onClick={onTodayClick}
                variant="outline"
                size="sm"
                className="border-foreground/20 text-foreground hover:bg-muted"
                data-testid="button-today-standalone"
              >
                Today
              </Button>
            ) : !showCalendarIcon ? (
              <div className="w-8"></div>
            ) : null}
            {rightMenuButton && rightMenuButton}
          </div>
        </div>
      </div>
    </header>
  );
}
