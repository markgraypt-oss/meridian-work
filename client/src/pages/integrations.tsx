import { useLocation } from "wouter";
import { ArrowLeft, Smartphone, Watch, Activity, Heart } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: typeof Smartphone;
  connected: boolean;
  comingSoon?: boolean;
}

const integrations: Integration[] = [
  {
    id: "apple-health",
    name: "Apple Health",
    description: "Sync steps, sleep, and heart rate data",
    icon: Heart,
    connected: false,
    comingSoon: true,
  },
  {
    id: "google-fit",
    name: "Google Fit",
    description: "Sync activity and wellness data",
    icon: Activity,
    connected: false,
    comingSoon: true,
  },
  {
    id: "fitbit",
    name: "Fitbit",
    description: "Sync fitness and sleep tracking",
    icon: Watch,
    connected: false,
    comingSoon: true,
  },
  {
    id: "garmin",
    name: "Garmin",
    description: "Sync workouts and health metrics",
    icon: Watch,
    connected: false,
    comingSoon: true,
  },
  {
    id: "whoop",
    name: "WHOOP",
    description: "Sync strain, recovery, and sleep data",
    icon: Activity,
    connected: false,
    comingSoon: true,
  },
  {
    id: "oura",
    name: "Oura Ring",
    description: "Sync sleep and readiness scores",
    icon: Activity,
    connected: false,
    comingSoon: true,
  },
];

export default function Integrations() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-14 flex items-center px-4">
        <button 
          onClick={() => setLocation('/profile')}
          className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-foreground ml-2">Integrations</h1>
      </div>

      <div className="pt-16 mx-4 space-y-4">
        <p className="text-muted-foreground text-sm mt-0">
          Connect your fitness devices and apps to automatically sync your health data.
        </p>

        <div className="bg-card rounded-lg border border-border overflow-hidden divide-y divide-border">
          {integrations.map((integration) => {
            const Icon = integration.icon;
            return (
              <div 
                key={integration.id}
                className="px-4 py-4 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-medium">{integration.name}</span>
                      {integration.comingSoon && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{integration.description}</p>
                  </div>
                </div>
                <Switch 
                  checked={integration.connected} 
                  disabled={integration.comingSoon}
                />
              </div>
            );
          })}
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            More integrations are being added. Have a specific device or app you'd like to connect? 
            Let us know through Help & Support.
          </p>
        </div>
      </div>
    </div>
  );
}
