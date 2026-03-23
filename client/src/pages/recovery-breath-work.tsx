import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Wind, Heart, Zap, Focus, Clock, Star, Plus, 
  ChevronRight, ChevronDown, ChevronUp, Flame, Moon, Activity,
  ChevronLeft, Check
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import type { BreathTechnique, BreathWorkSessionLog } from "@shared/schema";

const categoryIcons: Record<string, typeof Wind> = {
  relaxation: Moon,
  energy: Zap,
  focus: Focus,
  recovery: Heart,
  performance: Flame,
};

const categoryColors: Record<string, string> = {
  relaxation: "from-indigo-500 to-purple-600",
  energy: "from-orange-500 to-red-500",
  focus: "from-blue-500 to-cyan-500",
  recovery: "from-green-500 to-emerald-500",
  performance: "from-[#0cc9a9] to-orange-500",
};

const categoryLabels: Record<string, string> = {
  relaxation: "Relaxation",
  energy: "Energy",
  focus: "Focus",
  recovery: "Recovery",
  performance: "Performance",
};

function TechniqueCard({ technique }: { technique: BreathTechnique }) {
  const Icon = categoryIcons[technique.category] || Wind;
  const gradient = categoryColors[technique.category] || "from-gray-500 to-gray-600";
  
  return (
    <Link href={`/recovery/breath-work/${technique.slug}`}>
      <Card 
        className="bg-card hover:bg-card/80 transition-colors cursor-pointer overflow-hidden"
        data-testid={`technique-card-${technique.slug}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{technique.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {technique.description}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {technique.defaultDurationMinutes} min
                </span>
                <span className="capitalize px-2 py-0.5 rounded-full bg-muted">
                  {technique.difficulty}
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function FavoriteCard({ technique }: { technique: BreathTechnique }) {
  const Icon = categoryIcons[technique.category] || Wind;
  const gradient = categoryColors[technique.category] || "from-gray-500 to-gray-600";
  
  return (
    <Link href={`/recovery/breath-work/${technique.slug}`}>
      <div 
        className="w-32 flex-shrink-0 cursor-pointer"
        data-testid={`favorite-card-${technique.slug}`}
      >
        <div className={`w-full h-24 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-2`}>
          <Icon className="w-10 h-10 text-white" />
        </div>
        <p className="text-sm font-medium text-foreground text-center truncate">{technique.name}</p>
      </div>
    </Link>
  );
}

function CategoryCard({ category, count }: { category: string; count: number }) {
  const Icon = categoryIcons[category] || Wind;
  const gradient = categoryColors[category] || "from-gray-500 to-gray-600";
  
  return (
    <Link href={`/recovery/breath-work/category/${category}`}>
      <div 
        className="flex-shrink-0 w-24 text-center cursor-pointer"
        data-testid={`category-card-${category}`}
      >
        <div className={`w-full h-20 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-2`}>
          <Icon className="w-8 h-8 text-white" />
        </div>
        <p className="text-sm font-medium text-foreground capitalize">{category}</p>
        <p className="text-xs text-muted-foreground">{count} techniques</p>
      </div>
    </Link>
  );
}

interface BreathworkCalendarProps {
  sessions: BreathWorkSessionLog[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onDayClick: (sessions: BreathWorkSessionLog[]) => void;
}

function BreathworkCalendar({ sessions, currentMonth, onMonthChange, onDayClick }: BreathworkCalendarProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getSessionsForDay = (date: Date): BreathWorkSessionLog[] => {
    return sessions.filter(session => {
      const sessionDate = new Date(session.completedAt);
      return isSameDay(sessionDate, date);
    });
  };

  const isDayCompleted = (date: Date): boolean => {
    return getSessionsForDay(date).length > 0;
  };

  const handleDayClick = (date: Date) => {
    const daySessions = getSessionsForDay(date);
    if (daySessions.length > 0) {
      onDayClick(daySessions);
    }
  };

  return (
    <div className="bg-card rounded-xl p-4">
      <div className="flex items-center justify-center mb-3 relative">
        <div className="absolute left-0 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
            className="text-foreground h-8 w-8"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMonthChange(new Date())}
            className="text-foreground font-bold text-sm px-2 h-8"
          >
            T
          </Button>
        </div>
        <h2 className="text-lg font-bold text-foreground">{format(currentMonth, 'MMM yyyy').toUpperCase()}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          className="text-foreground h-8 w-8 absolute right-0"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className="text-center text-xs text-muted-foreground font-medium py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
          <div key={`empty-${i}`} className="h-9" />
        ))}
        
        {daysInMonth.map(day => {
          const completed = isDayCompleted(day);
          const isToday = isSameDay(day, new Date());
          const sessionCount = getSessionsForDay(day).length;

          return (
            <div
              key={day.toString()}
              className={`h-9 flex items-center justify-center relative ${completed ? 'cursor-pointer' : ''}`}
              onClick={() => handleDayClick(day)}
            >
              {completed ? (
                <div className="bg-green-500 rounded-full w-7 h-7 flex items-center justify-center relative">
                  <Check className="h-4 w-4 text-white" strokeWidth={3} />
                  {sessionCount > 1 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-[10px] text-white rounded-full w-4 h-4 flex items-center justify-center font-bold">
                      {sessionCount}
                    </span>
                  )}
                </div>
              ) : (
                <div className={`text-sm font-medium ${isToday ? 'text-[#0cc9a9]' : 'text-foreground'}`}>
                  {format(day, 'd')}
                </div>
              )}
              {isToday && !completed && (
                <div className="absolute inset-1 rounded-full border border-[#0cc9a9]" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RecoveryBreathWork() {
  const { formatDate } = useFormattedDate();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [favouritesOpen, setFavouritesOpen] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDaySessions, setSelectedDaySessions] = useState<BreathWorkSessionLog[]>([]);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: techniques, isLoading: techniquesLoading } = useQuery<BreathTechnique[]>({
    queryKey: ['/api/breathwork/techniques'],
    enabled: isAuthenticated,
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/breathwork/seed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/breathwork/techniques'] });
    },
  });

  useEffect(() => {
    if (techniques && techniques.length === 0 && !seedMutation.isPending) {
      seedMutation.mutate();
    }
  }, [techniques]);

  const { data: favourites } = useQuery<any[]>({
    queryKey: ['/api/breathwork/favourites'],
    enabled: isAuthenticated,
  });

  const { data: stats } = useQuery<{ totalSessions: number; totalMinutes: number; currentStreak: number }>({
    queryKey: ['/api/breathwork/stats'],
    enabled: isAuthenticated,
  });

  const { data: routines } = useQuery<any[]>({
    queryKey: ['/api/breathwork/routines'],
    enabled: isAuthenticated,
  });

  const { data: sessions = [] } = useQuery<BreathWorkSessionLog[]>({
    queryKey: ['/api/breathwork/sessions'],
    enabled: isAuthenticated,
  });

  const categories = techniques ? Array.from(new Set(techniques.map(t => t.category))) : [];
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = techniques?.filter(t => t.category === cat).length || 0;
    return acc;
  }, {} as Record<string, number>);

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader title="Breath Work" onBack={() => navigate("/recovery")} />
      
      <div className="px-4 pt-14 pb-4 space-y-6">
        {/* Categories */}
        {categories.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Categories</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map((category) => (
                <CategoryCard 
                  key={category} 
                  category={category} 
                  count={categoryCounts[category]}
                />
              ))}
            </div>
          </section>
        )}

        {/* Favourites Section - Collapsible */}
        <Collapsible open={favouritesOpen} onOpenChange={setFavouritesOpen}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Star className="w-5 h-5 text-[#0cc9a9]" />
                Favourites
                {favourites && favourites.length > 0 && (
                  <span className="text-sm text-muted-foreground font-normal">({favourites.length})</span>
                )}
              </h2>
              {favouritesOpen ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {favourites && favourites.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {favourites.map((fav) => (
                  <FavoriteCard key={fav.id} technique={fav.technique} />
                ))}
              </div>
            ) : (
              <Card className="bg-card/50 border-dashed">
                <CardContent className="p-4 text-center">
                  <Star className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Tap the star on any technique to add it here
                  </p>
                </CardContent>
              </Card>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Custom Routines Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">My Routines</h2>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-primary"
              onClick={() => navigate("/recovery/breath-work/builder")}
              data-testid="btn-create-routine"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create
            </Button>
          </div>
          {routines && routines.length > 0 ? (
            <div className="space-y-2">
              {routines.map((routine) => (
                <Link key={routine.id} href={`/recovery/breath-work/routine/${routine.id}`}>
                  <Card className="bg-card hover:bg-card/80 transition-colors cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-foreground">{routine.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {routine.totalDurationMinutes} min • {routine.phases?.length || 0} phases
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="bg-card/50 border-dashed">
              <CardContent className="p-6 text-center">
                <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Create your own custom breathing routine
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => navigate("/recovery/breath-work/builder")}
                  data-testid="btn-create-routine-empty"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Build Routine
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Stats Banner */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-xl p-4 text-center" data-testid="stat-sessions">
            <p className="text-2xl font-bold text-primary">{stats?.totalSessions || 0}</p>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </div>
          <div className="bg-card rounded-xl p-4 text-center" data-testid="stat-minutes">
            <p className="text-2xl font-bold text-primary">{stats?.totalMinutes || 0}</p>
            <p className="text-xs text-muted-foreground">Minutes</p>
          </div>
          <div className="bg-card rounded-xl p-4 text-center" data-testid="stat-streak">
            <div className="flex items-center justify-center gap-1">
              <Flame className="w-5 h-5 text-orange-500" />
              <p className="text-2xl font-bold text-primary">{stats?.currentStreak || 0}</p>
            </div>
            <p className="text-xs text-muted-foreground">Day Streak</p>
          </div>
        </div>

        {/* Sessions Calendar */}
        <BreathworkCalendar 
          sessions={sessions}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          onDayClick={(daySessions) => {
            setSelectedDaySessions(daySessions);
            setSessionDialogOpen(true);
          }}
        />

      </div>

      {/* Session Details Dialog */}
      <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selectedDaySessions.length > 0 && formatDate(new Date(selectedDaySessions[0].completedAt), 'short')} - Session{selectedDaySessions.length > 1 ? 's' : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {selectedDaySessions.map((session, index) => (
              <SessionDetailCard key={session.id} session={session} index={index} sessionsCount={selectedDaySessions.length} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface SessionDetailCardProps {
  session: BreathWorkSessionLog;
  index: number;
  sessionsCount: number;
}

function SessionDetailCard({ session, index, sessionsCount }: SessionDetailCardProps) {
  const { data: technique } = useQuery<BreathTechnique>({
    queryKey: ['/api/breathwork/techniques/by-id', session.techniqueId],
    queryFn: async () => {
      const res = await fetch(`/api/breathwork/techniques/by-id/${session.techniqueId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch technique');
      return res.json();
    },
    enabled: !!session.techniqueId,
  });

  const durationMinutes = Math.floor(session.durationSeconds / 60);
  const durationSecsRemainder = session.durationSeconds % 60;
  const Icon = session.techniqueId && technique ? (categoryIcons[technique.category] || Wind) : Wind;
  const gradient = session.techniqueId && technique ? (categoryColors[technique.category] || "from-gray-500 to-gray-600") : "from-gray-500 to-gray-600";

  return (
    <Card className="bg-muted/50">
      <CardContent className="p-4">
        {sessionsCount > 1 && (
          <div className="text-xs text-muted-foreground mb-2">Session {index + 1}</div>
        )}
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-foreground">
              {technique?.name || 'Custom Session'}
            </h4>
            <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
              <p className="flex items-center gap-2">
                <Clock className="w-3 h-3" />
                {durationMinutes > 0 && `${durationMinutes}m `}{durationSecsRemainder > 0 && `${durationSecsRemainder}s`}
              </p>
              <p>{session.roundsCompleted} round{session.roundsCompleted !== 1 ? 's' : ''} completed</p>
              {session.mood && (
                <p className="capitalize">Mood: {session.mood}</p>
              )}
              <p className="text-xs">
                {format(new Date(session.completedAt), 'h:mm a')}
              </p>
            </div>
            {session.notes && (
              <p className="text-sm text-muted-foreground mt-2 italic">"{session.notes}"</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
