import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Move3D, 
  RotateCcw, 
  Zap, 
  HeartPulse,
  ChevronRight,
  Armchair,
  Sparkles
} from "lucide-react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
  gradient: string;
}

function FeatureCard({ icon, title, description, href, gradient }: FeatureCardProps) {
  return (
    <Link href={href}>
      <Card 
        className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer group"
        data-testid={`card-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${gradient}`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {description}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function RecoveryDeskHealth() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0cc9a9] mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const features: FeatureCardProps[] = [
    {
      icon: <Sparkles className="h-6 w-6 text-white" />,
      title: "AI Desk Scan",
      description: "Upload a photo and get AI-powered ergonomic feedback on your setup",
      href: "/recovery/desk-health/scan",
      gradient: "bg-gradient-to-br from-cyan-500 to-[#0cc9a9]"
    },
    {
      icon: <Armchair className="h-6 w-6 text-white" />,
      title: "Working Positions",
      description: "Explore seated, standing, and movement options for your workday",
      href: "/recovery/desk-health/positions",
      gradient: "bg-gradient-to-br from-purple-500 to-purple-600"
    },
    {
      icon: <RotateCcw className="h-6 w-6 text-white" />,
      title: "Rotation Planning",
      description: "Set up your position rotation schedule for all-day comfort",
      href: "/recovery/desk-health/rotation",
      gradient: "bg-gradient-to-br from-teal-500 to-teal-600"
    },
    {
      icon: <Zap className="h-6 w-6 text-white" />,
      title: "Micro-Resets",
      description: "Quick desk-side movements to refresh and recharge",
      href: "/recovery/desk-health/micro-resets",
      gradient: "bg-gradient-to-br from-orange-500 to-orange-600"
    },
    {
      icon: <HeartPulse className="h-6 w-6 text-white" />,
      title: "Aches & Fixes",
      description: "Common desk discomforts and what to do about them",
      href: "/recovery/desk-health/aches-fixes",
      gradient: "bg-gradient-to-br from-rose-500 to-rose-600"
    }
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopHeader title="Workday Wellness" onBack={() => navigate("/recovery")} />
      
      <div className="px-4 pt-14 pb-4">
        <div className="space-y-3">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>

        <div className="mt-8 p-4 bg-card rounded-xl border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Quick Tip</h3>
          <p className="text-sm text-muted-foreground">
            Variety is key. Rotating between positions and taking regular micro-resets 
            helps maintain comfort and energy throughout your day.
          </p>
        </div>
      </div>
    </div>
  );
}
