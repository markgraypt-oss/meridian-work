import { useState, useMemo } from "react";
import { localDateStr } from "@/lib/dateUtils";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Check, Search, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

interface ScheduleProgrammeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleProgrammeDialog({ open, onOpenChange }: ScheduleProgrammeDialogProps) {
  const { toast } = useToast();
  const [selectedProgramme, setSelectedProgramme] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGoal, setFilterGoal] = useState<string>("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("");
  const [filterEquipment, setFilterEquipment] = useState<string>("");

  const { data: programs = [], isLoading: programsLoading } = useQuery<any[]>({
    queryKey: ["/api/programs"],
    enabled: open,
  });

  const filteredProgrammes = useMemo(() => {
    return programs.filter(program => {
      const matchesSearch = program.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           program.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGoal = !filterGoal || program.goal === filterGoal;
      const matchesDifficulty = !filterDifficulty || program.difficulty === filterDifficulty;
      const matchesEquipment = !filterEquipment || program.equipment === filterEquipment;
      
      return matchesSearch && matchesGoal && matchesDifficulty && matchesEquipment;
    });
  }, [programs, searchQuery, filterGoal, filterDifficulty, filterEquipment]);

  const hasActiveFilters = filterGoal || filterDifficulty || filterEquipment;

  const clearFilters = () => {
    setFilterGoal("");
    setFilterDifficulty("");
    setFilterEquipment("");
  };

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProgramme || !selectedDate) {
        throw new Error("Please select a program and date");
      }
      
      const res = await fetch(`/api/programs/${selectedProgramme}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: localDateStr(selectedDate) }),
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
        description: "Your program has been successfully scheduled.",
      });
      onOpenChange(false);
      setSelectedProgramme(null);
      setSelectedDate(new Date());
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
          description: error.message || "Failed to schedule program",
          variant: "destructive",
        });
      }
    },
  });

  const handleSchedule = () => {
    scheduleMutation.mutate();
  };

  const formatGoal = (goal: string) => {
    return goal.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Schedule a Programme</DialogTitle>
          <DialogDescription>
            Choose a program and set when you'd like to start it. You can schedule programs in advance to plan your training blocks.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Programme Selection */}
          <div>
            <Label className="mb-3 block">Select Programme</Label>
            
            {/* Search and Filter Bar */}
            <div className="mb-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search programs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-programs"
                />
              </div>

              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1" data-testid="button-filter-programs">
                      <Filter className="h-4 w-4 mr-2" />
                      Filters
                      {hasActiveFilters && (
                        <span className="ml-2 bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                          {[filterGoal, filterDifficulty, filterEquipment].filter(Boolean).length}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="start">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs mb-2 block">Goal</Label>
                        <Select value={filterGoal} onValueChange={setFilterGoal}>
                          <SelectTrigger data-testid="select-filter-goal">
                            <SelectValue placeholder="All Goals" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Goals</SelectItem>
                            <SelectItem value="hypertrophy">Hypertrophy</SelectItem>
                            <SelectItem value="max_strength">Max Strength</SelectItem>
                            <SelectItem value="power">Power</SelectItem>
                            <SelectItem value="conditioning">Conditioning</SelectItem>
                            <SelectItem value="fat_loss">Fat Loss</SelectItem>
                            <SelectItem value="pain_free">Pain Free</SelectItem>
                            <SelectItem value="mobility">Mobility</SelectItem>
                            <SelectItem value="yoga">Yoga</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs mb-2 block">Difficulty</Label>
                        <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
                          <SelectTrigger data-testid="select-filter-difficulty">
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
                        <Select value={filterEquipment} onValueChange={setFilterEquipment}>
                          <SelectTrigger data-testid="select-filter-equipment">
                            <SelectValue placeholder="All Equipment" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Equipment</SelectItem>
                            <SelectItem value="home_gym">Home Gym</SelectItem>
                            <SelectItem value="full_gym">Full Gym</SelectItem>
                            <SelectItem value="bodyweight">Bodyweight</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {hasActiveFilters && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {programsLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <ScrollArea className="h-96 pr-4">
                <div className="space-y-3">
                  {filteredProgrammes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No programs found matching your criteria.</p>
                      {(searchQuery || hasActiveFilters) && (
                        <Button 
                          variant="link" 
                          onClick={() => {
                            setSearchQuery("");
                            clearFilters();
                          }}
                          className="mt-2"
                        >
                          Clear search and filters
                        </Button>
                      )}
                    </div>
                  ) : (
                    filteredProgrammes.map((program) => (
                    <div
                      key={program.id}
                      onClick={() => setSelectedProgramme(program.id)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedProgramme === program.id
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      data-testid={`program-option-${program.id}`}
                    >
                      <div className="flex items-start gap-3">
                        {selectedProgramme === program.id && (
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center mt-0.5">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-sm">{program.title}</h4>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className="text-xs">
                              {formatGoal(program.goal)}
                            </Badge>
                            <span className="text-xs text-gray-500">{program.weeks} weeks</span>
                            <span className="text-xs text-gray-500 capitalize">{program.difficulty}</span>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2">{program.description}</p>
                        </div>
                      </div>
                    </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Date Selection */}
          <div>
            <Label className="mb-3 block">Start Date</Label>
            <div className="border rounded-lg p-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                className="rounded-md"
                data-testid="calendar-start-date"
              />
              {selectedDate && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center text-sm text-blue-900">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    <span className="font-medium">
                      Starts: {format(selectedDate, 'PPPP')}
                    </span>
                  </div>
                  {selectedProgramme && programs.find(p => p.id === selectedProgramme) && (
                    <p className="text-xs text-blue-700 mt-2">
                      This {programs.find(p => p.id === selectedProgramme)?.weeks}-week program will end around {format(new Date(selectedDate.getTime() + programs.find(p => p.id === selectedProgramme)?.weeks * 7 * 24 * 60 * 60 * 1000), 'PPPP')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-schedule"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={!selectedProgramme || !selectedDate || scheduleMutation.isPending}
            data-testid="button-confirm-schedule"
          >
            {scheduleMutation.isPending ? "Scheduling..." : "Schedule Programme"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
