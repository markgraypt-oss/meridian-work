import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface UserPreferences {
  weightUnit: string;
  distanceUnit: string;
  timeFormat: string;
  dateFormat: string;
  restTimerSounds: boolean;
  countdownBeeps: boolean;
}

const defaultPreferences: UserPreferences = {
  weightUnit: "kg",
  distanceUnit: "km",
  timeFormat: "24h",
  dateFormat: "DD/MM/YYYY",
  restTimerSounds: true,
  countdownBeeps: true,
};

export default function Preferences() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [weightUnit, setWeightUnit] = useState("kg");
  const [distanceUnit, setDistanceUnit] = useState("km");
  const [timeFormat, setTimeFormat] = useState("24h");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [restTimerSounds, setRestTimerSounds] = useState(true);
  const [countdownBeeps, setCountdownBeeps] = useState(true);

  const { data: preferences, isLoading } = useQuery<UserPreferences>({
    queryKey: ['/api/user/preferences'],
  });

  useEffect(() => {
    if (preferences) {
      setWeightUnit(preferences.weightUnit || "kg");
      setDistanceUnit(preferences.distanceUnit || "km");
      setTimeFormat(preferences.timeFormat || "24h");
      setDateFormat(preferences.dateFormat || "DD/MM/YYYY");
      setRestTimerSounds(preferences.restTimerSounds ?? true);
      setCountdownBeeps(preferences.countdownBeeps ?? true);
    }
  }, [preferences]);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: Partial<UserPreferences>) => {
      return apiRequest('PATCH', '/api/user/preferences', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
      toast({ title: "Preferences saved" });
    },
    onError: () => {
      toast({ title: "Failed to save preferences", variant: "destructive" });
    },
  });

  const handleSave = () => {
    updatePreferencesMutation.mutate({
      weightUnit,
      distanceUnit,
      timeFormat,
      dateFormat,
      restTimerSounds,
      countdownBeeps,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-14 flex items-center px-4">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-6 w-32 ml-4" />
        </div>
        <div className="pt-14 mx-4 space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-14 flex items-center px-4">
        <button 
          onClick={() => setLocation('/profile')}
          className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-foreground ml-2">Preferences</h1>
      </div>

      <div className="pt-16 mx-4 space-y-6">
        <div className="bg-card rounded-lg border border-border p-4 space-y-4">
          <h3 className="font-medium text-foreground mt-0">Units & Measurements</h3>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="weightUnit">Weight</Label>
            <Select value={weightUnit} onValueChange={setWeightUnit}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">Kilograms (kg)</SelectItem>
                <SelectItem value="lbs">Pounds (lbs)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="distanceUnit">Distance</Label>
            <Select value={distanceUnit} onValueChange={setDistanceUnit}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="km">Kilometers (km)</SelectItem>
                <SelectItem value="mi">Miles (mi)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-4 space-y-4">
          <h3 className="font-medium text-foreground">Display Settings</h3>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="timeFormat">Time Format</Label>
            <Select value={timeFormat} onValueChange={setTimeFormat}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12-hour</SelectItem>
                <SelectItem value="24h">24-hour</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="dateFormat">Date Format</Label>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-4 space-y-4">
          <h3 className="font-medium text-foreground">Workout Settings</h3>
          
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="restTimerSounds">Rest Timer Sounds</Label>
              <p className="text-sm text-muted-foreground">Play sound when rest timer ends</p>
            </div>
            <Switch 
              id="restTimerSounds"
              checked={restTimerSounds} 
              onCheckedChange={setRestTimerSounds}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="countdownBeeps">Countdown Beeps</Label>
              <p className="text-sm text-muted-foreground">Play beeps during final countdown</p>
            </div>
            <Switch 
              id="countdownBeeps"
              checked={countdownBeeps} 
              onCheckedChange={setCountdownBeeps}
            />
          </div>
        </div>

        <Button 
          onClick={handleSave} 
          className="w-full"
          disabled={updatePreferencesMutation.isPending}
        >
          {updatePreferencesMutation.isPending ? "Saving..." : "Save Preferences"}
        </Button>
      </div>
    </div>
  );
}
