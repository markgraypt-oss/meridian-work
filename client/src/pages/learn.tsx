import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import TopHeader from "@/components/TopHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, BookOpen, Play, ChevronDown, ChevronRight } from "lucide-react";
import type { LearnTopic, LearningPath } from "@shared/schema";
import sleepImage from "@assets/dsax`_1764192725907.png";
import stressBurnoutImage from "@assets/stock_images/stress_relief_and_re_b90aa673.jpg";
import movementImage from "@assets/stock_images/fitness_exercise_mov_94c80167.jpg";
import mindsetImage from "@assets/stock_images/mindset_goals_person_61096f8e.jpg";
import nutritionImage from "@assets/stock_images/healthy_nutrition_di_11ea532f.jpg";
import travelImage from "@assets/stock_images/travel_adventure_and_d57ee077.jpg";
import productivityImage from "@assets/stock_images/productivity_focus_w_3c0be8d2.jpg";

function TopicCard({ topic, onNavigate }: { topic: LearnTopic; onNavigate: (path: string) => void }) {
  const { isAuthenticated } = useAuth();
  const { data: stats } = useQuery({
    queryKey: [`/api/learn-topics/${topic.id}/stats`],
    enabled: isAuthenticated,
  });

  const calculatePercentage = () => {
    if (!stats || stats.totalPaths === 0 || stats.totalVideos === 0) return 0;
    const totalContent = stats.totalPaths + stats.totalVideos;
    const completedContent = stats.pathsCompleted + stats.videosWatched;
    return Math.round((completedContent / totalContent) * 100);
  };

  const percentage = calculatePercentage();

  const topicImages: Record<string, string> = {
    sleep: sleepImage,
    "stress-burnout": stressBurnoutImage,
    movement: movementImage,
    mindset: mindsetImage,
    nutrition: nutritionImage,
    "travel-routine": travelImage,
    productivity: productivityImage,
  };

  const backgroundImage = topicImages[topic.slug];

  return (
    <Card
      onClick={() => onNavigate(`/learn/${topic.slug}`)}
      className="bg-card cursor-pointer hover:shadow-lg transition-shadow overflow-hidden relative"
      data-testid={`topic-card-${topic.slug}`}
    >
      {backgroundImage && (
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            zIndex: 0
          }}
        />
      )}
      <div className="p-6 relative z-10 space-y-4">
        <h3 className="text-lg font-bold text-foreground">{topic.title}</h3>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            <span>{stats?.pathsCompleted || 0}/{stats?.totalPaths || 0} paths</span>
          </div>
          <div className="flex items-center gap-1">
            <Play className="h-3 w-3" />
            <span>{stats?.videosWatched || 0}/{stats?.totalVideos || 0} videos</span>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-primary font-semibold">{percentage}% done</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function Learn() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [myPathsOpen, setMyPathsOpen] = useState(false);

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

  const { data: enrolledPaths = [], isLoading: pathsLoading } = useQuery({
    queryKey: ["/api/user-path-assignments"],
    enabled: isAuthenticated,
  });

  const { data: topics = [], isLoading: topicsLoading } = useQuery<LearnTopic[]>({
    queryKey: ["/api/learn-topics"],
    enabled: isAuthenticated,
  });

  if (isLoading || topicsLoading || pathsLoading) {
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
      <TopHeader title="The Lab" onBack={() => navigate("/perform")} />
      
      <div className="px-5 pt-4 pb-6">
        <div className="max-w-4xl mx-auto">
          {enrolledPaths.length > 0 && (
            <Collapsible open={myPathsOpen} onOpenChange={setMyPathsOpen} className="mb-8">
              <Card className="bg-card">
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-lg">
                    <h2 className="text-base font-bold text-foreground">My Paths</h2>
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition-transform ${
                        myPathsOpen ? "rotate-180" : ""
                      }`}
                      data-testid="my-paths-toggle"
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4 pt-0">
                  <div className="grid grid-cols-1 gap-3">
                    {enrolledPaths.map((enrollment: any) => (
                      <Card
                        key={enrollment.id}
                        onClick={() => navigate(`/education-lab/path/${enrollment.pathId}`)}
                        className="cursor-pointer group transition-all hover:shadow-lg p-4"
                        data-testid={`my-path-card-${enrollment.pathId}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                              {enrollment.path?.title || "Untitled Path"}
                            </h3>
                            {enrollment.progress > 0 && (
                              <div className="mt-2 w-full bg-muted rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full transition-all"
                                  style={{ width: `${enrollment.progress}%` }}
                                />
                              </div>
                            )}
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors ml-4 flex-shrink-0" />
                        </div>
                      </Card>
                    ))}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-base font-bold text-foreground mb-1">
                Browse by Topic
              </h1>
              <p className="text-sm text-muted-foreground">
                Explore curated learning paths and discover content that matters to you
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/education-lab/bookmarks")}
              className="flex-shrink-0 h-9 w-9"
              data-testid="button-view-bookmarks"
            >
              <Heart className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {topics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} onNavigate={navigate} />
            ))}
          </div>

          {topics.length === 0 && (
            <Card className="bg-card">
              <div className="p-8 text-center">
                <p className="text-muted-foreground">
                  No topics available yet. Check back soon!
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

    </div>
  );
}
