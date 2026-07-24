import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { Droplets, X, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import type { HydrationLog, HydrationGoal } from "@shared/schema";

interface HydrationModalProps {
  open: boolean;
  onClose: () => void;
}

const getTodayTimeOfDay = () => {
  const hour = new Date().getHours();
  return hour < 18 ? 'morning' : 'evening';
};

const getColorClass = (percentage: number) => {
  if (percentage < 50) return 'text-red-500';
  if (percentage < 75) return 'text-[#0cc9a9]';
  return 'text-green-400';
};

const getProgressBarColor = (percentage: number) => {
  if (percentage < 50) return '#ef4444'; // red
  if (percentage < 75) return '#0cc9a9'; // yellow
  return '#4ade80'; // green
};

const getCircleColor = () => {
  return 'border-primary';
};

export default function HydrationModal({ open, onClose }: HydrationModalProps) {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalInput, setGoalInput] = useState(3000);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualAmount, setManualAmount] = useState('');
  const [showLogs, setShowLogs] = useState(false);

  const { data: hydrationStats } = useQuery<{
    totalMl: number;
    goalMl: number;
    percentage: number;
    logs: HydrationLog[];
    goal: HydrationGoal | undefined;
  }>({
    queryKey: ['/api/hydration/today'],
    enabled: isAuthenticated && open,
  });

  const addHydrationMutation = useMutation({
    mutationFn: async (amountMl: number) => {
      return await apiRequest('POST', '/api/hydration/log', {
        amountMl,
        timeOfDay: getTodayTimeOfDay(),
        fluidType: 'water',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hydration/today'] });
      toast({ title: "Logged", description: `Water logged successfully!` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log water", variant: "destructive" });
    },
  });

  const setGoalMutation = useMutation({
    mutationFn: async (goalMl: number) => {
      return await apiRequest('POST', '/api/hydration/goal', {
        goalMl,
        isManuallySet: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hydration/today'] });
      toast({ title: "Goal Updated", description: `Daily goal set to ${goalInput}ml` });
      setShowGoalModal(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to set goal", variant: "destructive" });
    },
  });

  const deleteLogMutation = useMutation({
    mutationFn: async (logId: number) => {
      return await apiRequest('DELETE', `/api/hydration/log/${logId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hydration/today'] });
      toast({ title: "Deleted", description: "Log entry removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete log", variant: "destructive" });
    },
  });

  if (!open) return null;

  const hydrationGoal = hydrationStats?.goalMl || 3000;
  const hydrationCurrent = hydrationStats?.totalMl || 0;
  const hydrationPercentage = hydrationStats?.percentage || 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="modal-hydration-popup" onClick={(e) => e.stopPropagation()}>
      <div className="bg-card rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-border">
        <div className="bg-card text-foreground px-6 py-4 flex items-center justify-between rounded-t-2xl sticky top-0 z-10 border-b border-border">
          <h1 className="text-lg font-semibold flex items-center gap-2 text-foreground">
            <Droplets className="h-5 w-5" />
            Hydration Tracker
          </h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-foreground hover:bg-muted h-8 w-8"
            data-testid="button-close-hydration-modal"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6">
          <div>
            <div className="bg-muted/50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Today's Hydration</p>
                  <p className="text-3xl font-bold text-foreground">{hydrationCurrent}ml</p>
                  <button 
                    onClick={() => setShowGoalModal(true)}
                    className="text-xs text-[#0cc9a9] hover:opacity-80 transition mt-1"
                    data-testid="button-edit-hydration-goal-modal"
                  >
                    Goal: {hydrationGoal}ml (click to edit)
                  </button>
                </div>
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg width="128" height="128" className="transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="8"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke="#0cc9a9"
                      strokeWidth="8"
                      strokeDasharray={2 * Math.PI * 56}
                      strokeDashoffset={2 * Math.PI * 56 * (1 - hydrationPercentage / 100)}
                      strokeLinecap="round"
                      className="transition-all duration-300"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className={`text-3xl font-bold ${getColorClass(hydrationPercentage)}`} data-testid="text-hydration-percentage-modal">
                        {Math.round(hydrationPercentage)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">of goal</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex h-2 w-full bg-gray-200 rounded-full overflow-hidden mb-6">
                <div 
                  className="h-full transition-all"
                  style={{ 
                    width: `${Math.min(hydrationPercentage, 100)}%`,
                    backgroundColor: getProgressBarColor(hydrationPercentage)
                  }}
                ></div>
              </div>
              
              <p className="text-sm font-semibold mb-3 text-foreground">Quick Add</p>
              <div className="grid grid-cols-2 gap-2 mb-6">
                <Button 
                  size="sm" 
                  className="text-xs bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black border-0"
                  onClick={() => addHydrationMutation.mutate(250)}
                  disabled={addHydrationMutation.isPending}
                  data-testid="button-hydration-250-modal"
                >
                  +250ml
                </Button>
                <Button 
                  size="sm" 
                  className="text-xs bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black border-0"
                  onClick={() => addHydrationMutation.mutate(500)}
                  disabled={addHydrationMutation.isPending}
                  data-testid="button-hydration-500-modal"
                >
                  +500ml
                </Button>
                <Button 
                  size="sm" 
                  className="text-xs bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black border-0"
                  onClick={() => addHydrationMutation.mutate(750)}
                  disabled={addHydrationMutation.isPending}
                  data-testid="button-hydration-750-modal"
                >
                  +750ml
                </Button>
                <Button 
                  size="sm" 
                  className="text-xs bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black border-0"
                  onClick={() => addHydrationMutation.mutate(1000)}
                  disabled={addHydrationMutation.isPending}
                  data-testid="button-hydration-1000-modal"
                >
                  +1L
                </Button>
              </div>

              <Button 
                size="sm" 
                className="w-full text-xs bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black border-0 mb-6"
                onClick={() => setShowManualInput(true)}
                data-testid="button-manual-hydration-modal"
              >
                Manual Entry
              </Button>

              {hydrationStats?.logs && hydrationStats.logs.length > 0 && (
                <div className="mt-6 pt-6 border-t border-border">
                  <button 
                    onClick={() => setShowLogs(!showLogs)}
                    className="flex items-center justify-between w-full text-sm font-semibold text-foreground hover:text-muted-foreground transition"
                    data-testid="button-toggle-logs"
                  >
                    <span>Today's Logs ({hydrationStats.logs.length})</span>
                    {showLogs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {showLogs && (
                    <div className="space-y-2 mt-3">
                      {hydrationStats.logs.map((log: HydrationLog) => (
                        <div key={log.id} className="flex justify-between text-xs items-center p-2 bg-muted rounded relative group" data-testid={`item-hydration-log-modal-${log.id}`}>
                          <span className="text-muted-foreground">
                            {log.createdAt && new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{log.amountMl}ml</span>
                            <button 
                              onClick={() => deleteLogMutation.mutate(log.id)}
                              disabled={deleteLogMutation.isPending}
                              className="text-muted-foreground hover:text-red-500 w-6 h-6 flex items-center justify-center rounded transition"
                              data-testid={`button-delete-log-modal-${log.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {hydrationPercentage >= 100 && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-600 font-semibold">✓ Goal reached! Great hydration today.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Goal Setting Modal (nested) */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" data-testid="modal-hydration-goal-modal" onClick={(e) => e.stopPropagation()}>
          <div className="bg-card rounded-lg p-6 max-w-sm w-full border border-border shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Set Daily Hydration Goal</h3>
            
            <div className="mb-4">
              <label className="text-sm text-muted-foreground mb-2 block">Daily Goal (ml)</label>
              <input 
                type="number" 
                value={goalInput || hydrationGoal}
                onChange={(e) => setGoalInput(parseInt(e.target.value) || 3000)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground"
                data-testid="input-hydration-goal-modal"
              />
              <p className="text-xs text-muted-foreground mt-2">Common goals: 2000ml, 2500ml, 3000ml, 3500ml, 4000ml</p>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => setShowGoalModal(false)}
                className="flex-1"
                data-testid="button-cancel-goal-modal"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => setGoalMutation.mutate(goalInput)}
                disabled={setGoalMutation.isPending}
                className="flex-1 bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black border-0"
                data-testid="button-save-goal-modal"
              >
                {setGoalMutation.isPending ? "Saving..." : "Save Goal"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" data-testid="modal-manual-hydration-modal" onClick={(e) => e.stopPropagation()}>
          <div className="bg-card rounded-lg p-6 max-w-sm w-full border border-border shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Manually Add Hydration</h3>
            
            <div className="mb-4">
              <label className="text-sm text-muted-foreground mb-2 block">Amount (ml)</label>
              <input 
                type="number" 
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="Enter amount in ml"
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground"
                data-testid="input-manual-amount-modal"
              />
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => {
                  setShowManualInput(false);
                  setManualAmount('');
                }}
                className="flex-1"
                data-testid="button-cancel-manual-modal"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  const amount = parseInt(manualAmount);
                  if (amount > 0) {
                    addHydrationMutation.mutate(amount);
                    setManualAmount('');
                    setShowManualInput(false);
                  }
                }}
                disabled={addHydrationMutation.isPending || !manualAmount}
                className="flex-1 bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black border-0"
                data-testid="button-save-manual-modal"
              >
                {addHydrationMutation.isPending ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
