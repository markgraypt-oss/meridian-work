import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Wind, Heart, Zap, Focus, Clock, ChevronRight, Flame, Moon,
  Target, Sparkles, CheckCircle2, Timer, Users
} from "lucide-react";
import type { BreathTechnique } from "@shared/schema";

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

const categoryData: Record<string, {
  title: string;
  description: string;
  desiredOutcome: string;
  benefits: string[];
  bestTimeToUse: string;
  recommendedDuration: string;
  idealFor: string[];
}> = {
  relaxation: {
    title: "Relaxation",
    description: "Breathing techniques designed to activate your parasympathetic nervous system, reduce cortisol levels, and bring you into a state of calm. These practices help release tension, quiet the mind, and restore inner peace.",
    desiredOutcome: "A deep sense of calm, reduced stress and anxiety, improved sleep quality, and a more balanced emotional state.",
    benefits: [
      "Lowers heart rate and blood pressure",
      "Reduces cortisol and stress hormones",
      "Calms racing thoughts",
      "Prepares body for restful sleep",
      "Releases physical tension"
    ],
    bestTimeToUse: "Before bed, during stressful moments, or whenever you need to decompress",
    recommendedDuration: "5-15 minutes",
    idealFor: ["Stress relief", "Better sleep", "Anxiety management", "Wind-down routine"]
  },
  energy: {
    title: "Energy",
    description: "Dynamic breathing patterns that stimulate your sympathetic nervous system and increase oxygen flow throughout your body. These techniques naturally boost alertness, mental clarity, and physical vitality without caffeine.",
    desiredOutcome: "Increased alertness, natural energy boost, enhanced mental clarity, and improved physical readiness.",
    benefits: [
      "Increases oxygen to the brain",
      "Stimulates natural adrenaline",
      "Enhances mental alertness",
      "Boosts metabolism",
      "Improves circulation"
    ],
    bestTimeToUse: "Morning wake-up, mid-afternoon slump, or before activities requiring energy",
    recommendedDuration: "3-10 minutes",
    idealFor: ["Morning routine", "Pre-activity boost", "Beating fatigue", "Mental sharpness"]
  },
  focus: {
    title: "Focus",
    description: "Precision breathing techniques that enhance cognitive function, sharpen concentration, and create a state of flow. These practices balance your nervous system to achieve optimal mental performance.",
    desiredOutcome: "Heightened concentration, improved cognitive performance, clear thinking, and sustained attention.",
    benefits: [
      "Improves cognitive function",
      "Enhances concentration span",
      "Reduces mental fog",
      "Balances brain hemispheres",
      "Promotes flow state"
    ],
    bestTimeToUse: "Before important tasks, during work sessions, or when studying",
    recommendedDuration: "5-10 minutes",
    idealFor: ["Deep work", "Study sessions", "Creative projects", "Problem solving"]
  },
  recovery: {
    title: "Recovery",
    description: "Restorative breathing practices that support your body's natural healing processes. These techniques enhance oxygen delivery to tissues, reduce inflammation, and accelerate physical and mental recovery.",
    desiredOutcome: "Faster physical recovery, reduced muscle soreness, enhanced tissue repair, and improved overall restoration.",
    benefits: [
      "Accelerates muscle recovery",
      "Reduces inflammation",
      "Enhances cellular repair",
      "Improves lymphatic flow",
      "Supports immune function"
    ],
    bestTimeToUse: "After workouts, during rest days, or when recovering from illness",
    recommendedDuration: "10-20 minutes",
    idealFor: ["Post-workout", "Injury recovery", "Rest days", "General wellness"]
  },
  performance: {
    title: "Performance",
    description: "High-intensity breathing protocols used by elite athletes and performers to optimize physical and mental output. These techniques prepare your body for peak performance and help you access your full potential.",
    desiredOutcome: "Optimal physical readiness, enhanced mental focus, improved reaction time, and peak performance state.",
    benefits: [
      "Primes nervous system for action",
      "Increases pain tolerance",
      "Enhances reaction time",
      "Boosts confidence",
      "Maximizes oxygen efficiency"
    ],
    bestTimeToUse: "Before competitions, presentations, or challenging physical activities",
    recommendedDuration: "3-8 minutes",
    idealFor: ["Pre-competition", "Before presentations", "Physical challenges", "High-stakes moments"]
  },
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

export default function BreathCategory() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ category: string }>();
  const category = params.category || "";

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

  const categoryInfo = categoryData[category];
  const filteredTechniques = techniques?.filter(t => t.category === category) || [];
  const Icon = categoryIcons[category] || Wind;
  const gradient = categoryColors[category] || "from-gray-500 to-gray-600";

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

  if (!categoryInfo) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <TopHeader title="Category Not Found" onBack={() => navigate("/recovery/breath-work")} />
        <div className="p-4 text-center">
          <p className="text-muted-foreground">This category doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader title={categoryInfo.title} onBack={() => navigate("/recovery/breath-work")} />
      
      <div className="px-4 pt-14 pb-4 space-y-6">
        {/* Hero Section */}
        <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-6`}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <Icon className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{categoryInfo.title}</h1>
              <p className="text-white/80 text-sm">{filteredTechniques.length} techniques available</p>
            </div>
          </div>
          <p className="text-white/90 text-sm leading-relaxed">
            {categoryInfo.description}
          </p>
        </div>

        {/* Desired Outcome */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Desired Outcome</h2>
          </div>
          <Card className="bg-card">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm leading-relaxed">
                {categoryInfo.desiredOutcome}
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Key Benefits */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-[#0cc9a9]" />
            <h2 className="text-lg font-semibold text-foreground">Key Benefits</h2>
          </div>
          <Card className="bg-card">
            <CardContent className="p-4 space-y-2">
              {categoryInfo.benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">{benefit}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* Quick Info */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Timer className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground font-medium">Duration</span>
              </div>
              <p className="text-sm font-medium text-foreground">{categoryInfo.recommendedDuration}</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground font-medium">Best Time</span>
              </div>
              <p className="text-sm font-medium text-foreground line-clamp-2">{categoryInfo.bestTimeToUse.split(',')[0]}</p>
            </CardContent>
          </Card>
        </div>

        {/* Ideal For */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-foreground">Ideal For</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {categoryInfo.idealFor.map((item, index) => (
              <span 
                key={index}
                className={`px-3 py-1.5 rounded-full text-sm font-medium bg-gradient-to-r ${gradient} text-white`}
              >
                {item}
              </span>
            ))}
          </div>
        </section>

        {/* Techniques */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            {categoryInfo.title} Techniques
          </h2>
          {techniquesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredTechniques.length > 0 ? (
            <div className="space-y-3">
              {filteredTechniques.map((technique) => (
                <TechniqueCard key={technique.id} technique={technique} />
              ))}
            </div>
          ) : (
            <Card className="bg-card/50">
              <CardContent className="p-6 text-center">
                <Wind className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">
                  No techniques available in this category yet
                </p>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
