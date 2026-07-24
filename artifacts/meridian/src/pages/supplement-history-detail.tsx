import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill, Check, ChevronLeft, ChevronRight, Flame, Calendar, Clock, TrendingUp } from "lucide-react";
import TopHeader from "@/components/TopHeader";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isAfter, startOfDay } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import type { Supplement, SupplementLog } from "@shared/schema";

const FREQUENCY_LABELS: Record<number, string> = {
  1: "Daily",
  2: "Every 2 days",
  3: "Every 3 days",
  4: "Every 4 days",
  5: "Every 5 days",
  6: "Every 6 days",
  7: "Once per week",
};

const TIME_LABELS: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

interface SupplementStats {
  totalLogs: number;
  currentStreak: number;
  longestStreak: number;
  monthlyPercentage: number;
}

function SupplementCalendar({ 
  logs, 
  currentMonth, 
  onMonthChange,
  frequency = 1
}: { 
  logs: SupplementLog[]; 
  currentMonth: Date; 
  onMonthChange: (date: Date) => void;
  frequency?: number;
}) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const isLoggedOnDay = (date: Date): boolean => {
    return logs.some(log => {
      const logDate = new Date(log.date);
      return isSameDay(logDate, date) && log.taken;
    });
  };

  const firstDayOfWeek = monthStart.getDay();
  const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const goToToday = () => onMonthChange(new Date());

  return (
    <Card className="bg-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToToday}
              className="h-8 w-8 p-0 text-xs font-bold"
            >
              T
            </Button>
            <span className="font-semibold text-foreground">
              {format(currentMonth, "MMM yyyy").toUpperCase()}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day} className="text-center text-xs text-muted-foreground font-medium py-1">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: adjustedFirstDay }).map((_, index) => (
            <div key={`empty-${index}`} className="h-10" />
          ))}
          {daysInMonth.map((date) => {
            const isLogged = isLoggedOnDay(date);
            const isFuture = isAfter(startOfDay(date), startOfDay(new Date()));
            const isCurrentDay = isSameDay(date, new Date());
            
            return (
              <div
                key={date.toISOString()}
                className={`h-10 flex items-center justify-center relative rounded-lg text-sm
                  ${isCurrentDay ? 'ring-2 ring-primary' : ''}
                  ${isFuture ? 'text-muted-foreground/40' : 'text-foreground'}
                `}
              >
                {isLogged ? (
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                ) : (
                  <span>{format(date, 'd')}</span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SupplementHistoryDetail() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const supplementId = parseInt(params.id || "0");
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { formatDate } = useFormattedDate();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: supplement, isLoading: supplementLoading } = useQuery<Supplement>({
    queryKey: [`/api/supplements/${supplementId}`],
    enabled: isAuthenticated && supplementId > 0,
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<SupplementLog[]>({
    queryKey: [`/api/supplements/${supplementId}/logs`],
    enabled: isAuthenticated && supplementId > 0,
  });

  const { data: stats } = useQuery<SupplementStats>({
    queryKey: [`/api/supplements/${supplementId}/stats`],
    enabled: isAuthenticated && supplementId > 0,
  });

  if (authLoading || supplementLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!supplement) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <TopHeader 
          title="Supplement Not Found" 
          onBack={() => window.history.back()} 
        />
        <div className="p-4 pt-16">
          <Card className="bg-card/50 border-dashed">
            <CardContent className="p-6 text-center">
              <Pill className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                This supplement could not be found.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader 
        title={supplement.name} 
        onBack={() => window.history.back()} 
      />
      
      <div className="p-4 space-y-4">
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Pill className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground text-lg">{supplement.name}</h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {supplement.dosage && <span>{supplement.dosage}</span>}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {TIME_LABELS[supplement.timeOfDay] || supplement.timeOfDay}
                  </span>
                </div>
              </div>
            </div>
            
            {supplement.frequency && supplement.frequency > 1 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Calendar className="w-4 h-4" />
                <span>{FREQUENCY_LABELS[supplement.frequency]}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-card">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Flame className="w-5 h-5 text-orange-500" />
                <p className="text-2xl font-bold text-primary">{stats?.currentStreak || 0}</p>
              </div>
              <p className="text-xs text-muted-foreground">Current Streak</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary mb-1">{stats?.monthlyPercentage || 0}%</p>
              <p className="text-xs text-muted-foreground">This Month</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <p className="text-2xl font-bold text-primary">{stats?.longestStreak || 0}</p>
              </div>
              <p className="text-xs text-muted-foreground">Best Streak</p>
            </CardContent>
          </Card>
        </div>

        <SupplementCalendar 
          logs={logs}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          frequency={supplement.frequency || 1}
        />
      </div>
    </div>
  );
}
