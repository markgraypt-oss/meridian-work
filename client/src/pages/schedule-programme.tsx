import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar as CalendarIcon,
  Check,
  Search,
  Filter,
  X,
  Clock,
  Target,
  Info,
} from "lucide-react";
import { format, addWeeks, addDays } from "date-fns";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import TopHeader from "@/components/TopHeader";

const goalLabels: Record<string, string> = {
  hypertrophy: "Hypertrophy",
  max_strength: "Max Strength",
  general_strength: "General Strength",
  power: "Power",
  conditioning: "Conditioning",
  fat_loss: "Fat Loss",
  pain_free: "Pain Free",
  mobility: "Mobility",
  yoga: "Yoga",
  recovery: "Recovery",
  corrective_exercises: "Corrective Exercises",
};

const equipmentLabels: Record<string, string> = {
  bodyweight: "Bodyweight",
  home_gym: "Home Gym",
  full_gym: "Full Gym",
  resistance_bands: "Resistance Bands",
  dumbbells: "Dumbbells",
};

const typeLabels: Record<string, string> = {
  main: "Main",
  supplementary: "Supplementary",
  corrective: "Corrective",
  stretching: "Stretching",
};

export default function ScheduleProgrammePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedProgramme, setSelectedProgramme] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [dateInitialized, setDateInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGoal, setFilterGoal] = useState<string>("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("");
  const [filterEquipment, setFilterEquipment] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");

  const { data: programs = [], isLoading: programsLoading } = useQuery<any[]>({
    queryKey: ["/api/programs"],
  });

  const { data: timeline } = useQuery<any>({
    queryKey: ["/api/my-programs/timeline"],
  });

  const currentEnrollment = timeline?.current;
  const currentEndDate = currentEnrollment?.endDate ? new Date(currentEnrollment.endDate) : null;
  const dayAfterEnd = currentEndDate ? addDays(currentEndDate, 1) : null;

  useEffect(() => {
    if (dayAfterEnd && !dateInitialized) {
      setSelectedDate(dayAfterEnd);
      setDateInitialized(true);
    }
  }, [dayAfterEnd, dateInitialized]);

  const officialPrograms = useMemo(() => {
    return programs.filter(p => p.sourceType !== 'user_created');
  }, [programs]);

  const availableGoals = useMemo(() => {
    const goals = new Set(officialPrograms.map(p => p.goal).filter(Boolean));
    return Array.from(goals).sort();
  }, [officialPrograms]);

  const availableEquipment = useMemo(() => {
    const equip = new Set(officialPrograms.map(p => p.equipment).filter(Boolean));
    return Array.from(equip).sort();
  }, [officialPrograms]);

  const availableTypes = useMemo(() => {
    const types = new Set(officialPrograms.map(p => p.programmeType).filter(Boolean));
    return Array.from(types).sort();
  }, [officialPrograms]);

  const filteredProgrammes = useMemo(() => {
    return officialPrograms.filter(program => {
      const matchesSearch = !searchQuery || 
        program.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (program.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGoal = !filterGoal || program.goal === filterGoal;
      const matchesDifficulty = !filterDifficulty || program.difficulty === filterDifficulty;
      const matchesEquipment = !filterEquipment || program.equipment === filterEquipment;
      const matchesType = !filterType || program.programmeType === filterType;
      return matchesSearch && matchesGoal && matchesDifficulty && matchesEquipment && matchesType;
    });
  }, [officialPrograms, searchQuery, filterGoal, filterDifficulty, filterEquipment, filterType]);

  const hasActiveFilters = filterGoal || filterDifficulty || filterEquipment || filterType;
  const activeFilterCount = [filterGoal, filterDifficulty, filterEquipment, filterType].filter(Boolean).length;

  const clearFilters = () => {
    setFilterGoal("");
    setFilterDifficulty("");
    setFilterEquipment("");
    setFilterType("");
  };

  const selectedProgram = programs.find((p: any) => p.id === selectedProgramme);

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProgramme || !selectedDate) {
        throw new Error("Please select a program and date");
      }
      const res = await fetch(`/api/programs/${selectedProgramme}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}` }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        const err: any = new Error(data.message || "Failed to schedule program");
        err.code = data.code;
        err.existingEnrollment = data.existingEnrollment;
        throw err;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-programs/timeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-programs"] });
      toast({
        title: "Programme Scheduled",
        description: "Your programme has been successfully scheduled.",
      });
      navigate("/training");
    },
    onError: (error: any) => {
      if (error.code === 'PROGRAMME_CONFLICT' && error.existingEnrollment) {
        const existingTitle = error.existingEnrollment.programme?.title || 'another programme';
        toast({
          title: "Programme Conflict",
          description: `You already have "${existingTitle}" as your active programme. Please finish or end it first, or enroll directly from the programme page to switch.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to schedule programme",
          variant: "destructive",
        });
      }
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Schedule Programme" onBack={() => navigate("/training")} />
      <div className="pt-16 pb-8 px-4 max-w-2xl mx-auto">

        {currentEnrollment && (
          <Card className="mb-5 border-[#0cc9a9]/30 bg-[#0cc9a9]/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#0cc9a9]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Info className="w-4 h-4 text-[#0cc9a9]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground mb-0.5">Current Programme</p>
                  <p className="text-sm text-foreground">{currentEnrollment.programTitle || currentEnrollment.programme?.title}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      <span>Started {format(new Date(currentEnrollment.startDate), 'dd MMM yyyy')}</span>
                    </div>
                    {currentEndDate && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Ends {format(currentEndDate, 'dd MMM yyyy')}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium text-foreground">
                        {currentEnrollment.workoutsCompleted}/{currentEnrollment.totalWorkouts} workouts
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0cc9a9] rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.round((currentEnrollment.workoutsCompleted / (currentEnrollment.totalWorkouts || 1)) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Label className="mb-3 block text-sm font-semibold">Select Programme</Label>

        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search programmes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card border-border"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                  {hasActiveFilters && (
                    <span className="ml-2 bg-[#0cc9a9] text-black rounded-full w-5 h-5 flex items-center justify-center text-xs">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="start">
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs mb-2 block">Goal</Label>
                    <Select value={filterGoal || "all"} onValueChange={(v) => setFilterGoal(v === "all" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Goals" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Goals</SelectItem>
                        {availableGoals.map((goal: string) => (
                          <SelectItem key={goal} value={goal}>
                            {goalLabels[goal] || goal.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs mb-2 block">Difficulty</Label>
                    <Select value={filterDifficulty || "all"} onValueChange={(v) => setFilterDifficulty(v === "all" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Levels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Levels</SelectItem>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs mb-2 block">Equipment</Label>
                    <Select value={filterEquipment || "all"} onValueChange={(v) => setFilterEquipment(v === "all" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Equipment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Equipment</SelectItem>
                        {availableEquipment.map((eq: string) => (
                          <SelectItem key={eq} value={eq}>
                            {equipmentLabels[eq] || eq.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs mb-2 block">Type</Label>
                    <Select value={filterType || "all"} onValueChange={(v) => setFilterType(v === "all" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {availableTypes.map((t: string) => (
                          <SelectItem key={t} value={t}>
                            {typeLabels[t] || t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-2">
          {filteredProgrammes.length} programme{filteredProgrammes.length !== 1 ? "s" : ""} available
        </p>

        {programsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredProgrammes.length === 0 ? (
          <div className="text-center py-8">
            <Target className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No programmes found.</p>
            {(searchQuery || hasActiveFilters) && (
              <Button variant="link" onClick={() => { setSearchQuery(""); clearFilters(); }} className="mt-2 text-[#0cc9a9]">
                Clear search and filters
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="h-80 pr-2">
            <div className="space-y-2">
              {filteredProgrammes.map((program: any) => (
                <Card
                  key={program.id}
                  onClick={() => setSelectedProgramme(program.id)}
                  className={`cursor-pointer transition-all ${
                    selectedProgramme === program.id
                      ? 'border-[#0cc9a9] bg-[#0cc9a9]/5 ring-1 ring-[#0cc9a9]/30'
                      : 'border-border hover:border-border/80'
                  }`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      {selectedProgramme === program.id && (
                        <div className="w-5 h-5 rounded-full bg-[#0cc9a9] flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-foreground mb-1">{program.title}</h4>
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {goalLabels[program.goal] || program.goal?.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">{program.weeks} weeks</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="text-[11px] text-muted-foreground capitalize">{program.difficulty}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="text-[11px] text-muted-foreground">{program.trainingDaysPerWeek} days/wk</span>
                        </div>
                        {program.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{program.description}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}

        {selectedProgramme && (
          <div className="mt-6">
            <Label className="mb-3 block text-sm font-semibold">Start Date</Label>
            <Card className="border-border">
              <CardContent className="p-3">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  defaultMonth={dayAfterEnd || undefined}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  className="rounded-md mx-auto"
                />
                {selectedDate && selectedProgram && (
                  <div className="mt-3 p-3 bg-[#0cc9a9]/5 border border-[#0cc9a9]/20 rounded-lg">
                    <div className="flex items-center text-sm text-foreground">
                      <CalendarIcon className="h-4 w-4 mr-2 text-[#0cc9a9]" />
                      <span className="font-medium">
                        Starts: {format(selectedDate, 'EEEE, MMMM do, yyyy')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 ml-6">
                      This {selectedProgram.weeks}-week programme will end {format(addWeeks(selectedDate, selectedProgram.weeks), 'EEEE, MMMM do, yyyy')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <div className="mt-6 pb-4">
          <Button
            className="w-full h-12 text-base font-semibold btn-primary"
            onClick={() => scheduleMutation.mutate()}
            disabled={!selectedProgramme || !selectedDate || scheduleMutation.isPending}
          >
            {scheduleMutation.isPending ? "Scheduling..." : "Schedule Programme"}
          </Button>
          <button
            onClick={() => navigate("/training")}
            className="w-full text-center text-sm text-muted-foreground mt-2 py-2"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
