import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  RotateCcw, 
  Clock, 
  Bell,
  Save,
  Armchair,
  ArrowUpDown,
  Coffee
} from "lucide-react";
import type { WorkdayUserProfile, WorkdayPosition } from "@shared/schema";

interface RotationSettings {
  rotationInterval: number;
  notificationsEnabled: boolean;
  activePositions: string[];
}

function PositionToggle({
  position,
  isActive,
  onToggle,
}: {
  position: WorkdayPosition;
  isActive: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <Card
      className={`bg-card border-2 transition-all ${
        isActive ? "border-primary" : "border-border opacity-60"
      }`}
      data-testid={`toggle-position-${position.id}`}
    >
      <CardContent className="p-3 flex items-center gap-3">
        {position.imageUrl ? (
          <img
            src={position.imageUrl}
            alt={position.name}
            className={`w-12 h-12 object-cover rounded-lg ${isActive ? "" : "grayscale"}`}
          />
        ) : (
          <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
            <Armchair className="h-6 w-6 text-gray-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium text-sm ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
            {position.name}
          </h4>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {isActive ? position.description : "Paused — toggle on to include in rotation"}
          </p>
        </div>
        <Switch
          checked={isActive}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-[#0cc9a9]"
          data-testid={`switch-position-${position.id}`}
        />
      </CardContent>
    </Card>
  );
}

export default function WorkdayRotation() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<RotationSettings>({
    rotationInterval: 45,
    notificationsEnabled: true,
    activePositions: [],
  });

  const { data: positions = [], isLoading: positionsLoading } = useQuery<WorkdayPosition[]>({
    queryKey: ["/api/workday/positions"],
    enabled: isAuthenticated,
  });

  const { data: profile, isLoading: profileLoading } = useQuery<WorkdayUserProfile>({
    queryKey: ["/api/workday/profile"],
    enabled: isAuthenticated,
  });

  const preferredPositions = profile?.preferredPositions ?? [];

  const saveMutation = useMutation({
    mutationFn: (data: Partial<RotationSettings>) =>
      apiRequest("POST", "/api/workday/profile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workday/profile"] });
      toast({ title: "Settings saved!" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (profile) {
      setSettings({
        rotationInterval: profile.rotationInterval || 45,
        notificationsEnabled: profile.notificationsEnabled ?? true,
        activePositions: profile.activePositions ?? profile.preferredPositions ?? [],
      });
    }
  }, [profile]);

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

  const setPositionActive = (positionId: number, active: boolean) => {
    const posIdStr = String(positionId);
    setSettings(prev => ({
      ...prev,
      activePositions: active
        ? prev.activePositions.includes(posIdStr)
          ? prev.activePositions
          : [...prev.activePositions, posIdStr]
        : prev.activePositions.filter(id => id !== posIdStr),
    }));
  };

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0cc9a9]"></div>
      </div>
    );
  }

  const isLoading = positionsLoading || profileLoading;

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopHeader title="Rotation Planning" onBack={() => navigate("/recovery/desk-health")} />
      
      <div className="px-4 pt-14 pb-4">
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <RotateCcw className="h-6 w-6 text-[#0cc9a9]" />
            <h1 className="text-xl font-bold text-foreground">Position Rotation</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Set up your rotation preferences for all-day comfort
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full bg-gray-700 rounded-xl" />
            <Skeleton className="h-32 w-full bg-gray-700 rounded-xl" />
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-[#0cc9a9]" />
                      <Label className="text-foreground font-medium">Rotation Interval</Label>
                    </div>
                    <Badge variant="outline" className="text-[#0cc9a9] border-[#0cc9a9]">
                      {settings.rotationInterval} min
                    </Badge>
                  </div>
                  <Slider
                    value={[settings.rotationInterval]}
                    onValueChange={([value]) => setSettings(prev => ({ ...prev, rotationInterval: value }))}
                    min={15}
                    max={120}
                    step={15}
                    className="w-full"
                    data-testid="slider-rotation"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>15 min</span>
                    <span>2 hours</span>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-[#0cc9a9]" />
                      <Label className="text-foreground font-medium">Rotation Reminders</Label>
                    </div>
                    <Switch
                      checked={settings.notificationsEnabled}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notificationsEnabled: checked }))}
                      className="data-[state=checked]:bg-[#0cc9a9]"
                      data-testid="switch-reminders"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 ml-7">
                    Get gentle nudges to change positions
                  </p>
                </div>
              </CardContent>
            </Card>

            <div>
              <h3 className="text-foreground font-medium mb-3 flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5 text-[#0cc9a9]" />
                Your Position Rotation
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Toggle a position off to pause it for now — it stays in your list. Add or remove positions on the Working Positions page.
              </p>
              
              <div className="space-y-3">
                {positions
                  .filter((position) => preferredPositions.includes(String(position.id)))
                  .map((position) => (
                    <PositionToggle
                      key={position.id}
                      position={position}
                      isActive={settings.activePositions.includes(String(position.id))}
                      onToggle={(next) => setPositionActive(position.id, next)}
                    />
                  ))}
                {preferredPositions.length === 0 && (
                  <div className="text-center py-8 px-4 bg-card rounded-xl border border-border">
                    <p className="text-sm text-muted-foreground">
                      No positions in your rotation yet. Add some from the Working Positions page.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90"
              data-testid="button-save"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? "Saving..." : "Save Preferences"}
            </Button>

            <div className="p-4 bg-card rounded-xl border border-border">
              <div className="flex items-start gap-3">
                <Coffee className="h-5 w-5 text-[#0cc9a9] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-1">Sample Rotation</h4>
                  <p className="text-sm text-muted-foreground">
                    Try: 45 min seated → 30 min standing → 5 min movement break → repeat
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
