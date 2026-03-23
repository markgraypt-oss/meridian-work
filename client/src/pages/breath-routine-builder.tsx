import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, GripVertical, Save, ChevronUp, ChevronDown } from "lucide-react";

interface PhaseInput {
  id: string;
  phaseName: string;
  inhaleSeconds: number;
  holdAfterInhaleSeconds: number;
  exhaleSeconds: number;
  holdAfterExhaleSeconds: number;
  rounds: number;
  restBetweenRoundsSeconds: number;
}

const createEmptyPhase = (): PhaseInput => ({
  id: crypto.randomUUID(),
  phaseName: 'Breathing Phase',
  inhaleSeconds: 4,
  holdAfterInhaleSeconds: 0,
  exhaleSeconds: 4,
  holdAfterExhaleSeconds: 0,
  rounds: 4,
  restBetweenRoundsSeconds: 0,
});

export default function BreathRoutineBuilder() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phases, setPhases] = useState<PhaseInput[]>([createEmptyPhase()]);

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

  const createRoutineMutation = useMutation({
    mutationFn: async () => {
      const totalDurationMinutes = Math.ceil(
        phases.reduce((sum, p) => {
          const cycleTime = p.inhaleSeconds + p.holdAfterInhaleSeconds + p.exhaleSeconds + p.holdAfterExhaleSeconds;
          return sum + (cycleTime * p.rounds);
        }, 0) / 60
      );

      return apiRequest('POST', '/api/breathwork/routines', {
        name,
        description,
        totalDurationMinutes,
        phases: phases.map((p, i) => ({
          phaseName: p.phaseName,
          inhaleSeconds: p.inhaleSeconds,
          holdAfterInhaleSeconds: p.holdAfterInhaleSeconds,
          exhaleSeconds: p.exhaleSeconds,
          holdAfterExhaleSeconds: p.holdAfterExhaleSeconds,
          rounds: p.rounds,
          restBetweenRoundsSeconds: p.restBetweenRoundsSeconds,
          position: i,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/breathwork/routines'] });
      toast({ title: "Routine created successfully!" });
      navigate("/recovery/breath-work");
    },
    onError: () => {
      toast({ title: "Failed to create routine", variant: "destructive" });
    },
  });

  const addPhase = () => {
    setPhases([...phases, createEmptyPhase()]);
  };

  const removePhase = (id: string) => {
    if (phases.length > 1) {
      setPhases(phases.filter(p => p.id !== id));
    }
  };

  const updatePhase = (id: string, updates: Partial<PhaseInput>) => {
    setPhases(phases.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const movePhase = (index: number, direction: 'up' | 'down') => {
    const newPhases = [...phases];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= phases.length) return;
    [newPhases[index], newPhases[targetIndex]] = [newPhases[targetIndex], newPhases[index]];
    setPhases(newPhases);
  };

  const totalDuration = phases.reduce((sum, p) => {
    const cycleTime = p.inhaleSeconds + p.holdAfterInhaleSeconds + p.exhaleSeconds + p.holdAfterExhaleSeconds;
    return sum + (cycleTime * p.rounds);
  }, 0);

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: "Please enter a name for your routine", variant: "destructive" });
      return;
    }
    createRoutineMutation.mutate();
  };

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
      <TopHeader 
        title="Create Routine" 
        onBack={() => navigate("/recovery/breath-work")} 
      />
      
      <div className="px-4 pt-14 pb-4 space-y-6">
        {/* Name & Description */}
        <Card className="bg-card">
          <CardContent className="p-4 space-y-4">
            <div>
              <Label htmlFor="name">Routine Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Morning Energy Boost"
                data-testid="input-routine-name"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this routine for?"
                rows={2}
                data-testid="input-routine-description"
              />
            </div>
          </CardContent>
        </Card>

        {/* Duration Preview */}
        <div className="text-center p-4 bg-primary/10 rounded-xl">
          <p className="text-sm text-muted-foreground">Estimated Duration</p>
          <p className="text-3xl font-bold text-primary">
            {Math.floor(totalDuration / 60)}:{String(Math.round(totalDuration % 60)).padStart(2, '0')}
          </p>
        </div>

        {/* Phases */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Phases</h3>
            <Button variant="outline" size="sm" onClick={addPhase} data-testid="btn-add-phase">
              <Plus className="w-4 h-4 mr-1" />
              Add Phase
            </Button>
          </div>

          {phases.map((phase, index) => (
            <Card key={phase.id} className="bg-card">
              <CardContent className="p-4">
                <div className="flex items-start gap-2 mb-4">
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => movePhase(index, 'up')}
                      disabled={index === 0}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <GripVertical className="w-4 h-4 text-muted-foreground mx-auto" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => movePhase(index, 'down')}
                      disabled={index === phases.length - 1}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <Input
                        value={phase.phaseName}
                        onChange={(e) => updatePhase(phase.id, { phaseName: e.target.value })}
                        className="font-semibold text-lg border-0 p-0 h-auto bg-transparent"
                        data-testid={`input-phase-name-${index}`}
                      />
                      {phases.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removePhase(phase.id)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`btn-remove-phase-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Breathing Pattern */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="text-center">
                        <Label className="text-xs">Inhale</Label>
                        <Input
                          type="number"
                          min="1"
                          max="30"
                          value={phase.inhaleSeconds}
                          onChange={(e) => updatePhase(phase.id, { inhaleSeconds: parseInt(e.target.value) || 0 })}
                          className="text-center"
                          data-testid={`input-inhale-${index}`}
                        />
                      </div>
                      <div className="text-center">
                        <Label className="text-xs">Hold In</Label>
                        <Input
                          type="number"
                          min="0"
                          max="30"
                          value={phase.holdAfterInhaleSeconds}
                          onChange={(e) => updatePhase(phase.id, { holdAfterInhaleSeconds: parseInt(e.target.value) || 0 })}
                          className="text-center"
                          data-testid={`input-hold-in-${index}`}
                        />
                      </div>
                      <div className="text-center">
                        <Label className="text-xs">Exhale</Label>
                        <Input
                          type="number"
                          min="1"
                          max="30"
                          value={phase.exhaleSeconds}
                          onChange={(e) => updatePhase(phase.id, { exhaleSeconds: parseInt(e.target.value) || 0 })}
                          className="text-center"
                          data-testid={`input-exhale-${index}`}
                        />
                      </div>
                      <div className="text-center">
                        <Label className="text-xs">Hold Out</Label>
                        <Input
                          type="number"
                          min="0"
                          max="30"
                          value={phase.holdAfterExhaleSeconds}
                          onChange={(e) => updatePhase(phase.id, { holdAfterExhaleSeconds: parseInt(e.target.value) || 0 })}
                          className="text-center"
                          data-testid={`input-hold-out-${index}`}
                        />
                      </div>
                    </div>

                    {/* Rounds */}
                    <div className="flex items-center justify-between">
                      <Label>Rounds</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updatePhase(phase.id, { rounds: Math.max(1, phase.rounds - 1) })}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                        <span className="w-8 text-center font-semibold">{phase.rounds}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updatePhase(phase.id, { rounds: Math.min(20, phase.rounds + 1) })}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Save Button */}
        <Button 
          className="w-full h-12"
          onClick={handleSave}
          disabled={createRoutineMutation.isPending}
          data-testid="btn-save-routine"
        >
          <Save className="w-5 h-5 mr-2" />
          {createRoutineMutation.isPending ? 'Saving...' : 'Save Routine'}
        </Button>
      </div>
    </div>
  );
}
