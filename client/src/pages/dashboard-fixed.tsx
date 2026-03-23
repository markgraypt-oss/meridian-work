import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  Dumbbell, 
  Moon, 
  Flame, 
  ClipboardCheck, 
  TrendingUp,
  Calendar,
  Target,
  Brain
} from "lucide-react";

export default function DashboardFixed() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();

  // Redirect to home if not authenticated
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
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: latestProgress, isLoading: progressLoading } = useQuery({
    queryKey: ["/api/progress/latest"],
    retry: false,
    enabled: isAuthenticated,
  });

  const { data: latestCheckIn, isLoading: checkInLoading } = useQuery({
    queryKey: ["/api/check-ins/latest"],
    retry: false,
    enabled: isAuthenticated,
  });

  if (isLoading || progressLoading || checkInLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const healthScore = latestProgress?.healthScore || 87;
  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-blue-600";
    if (score >= 40) return "text-[#0cc9a9]";
    return "text-red-600";
  };

  const getHealthScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Attention";
  };

  console.log("DashboardFixed component is rendering");
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="gradient-primary text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold mb-6">
                Executive Dashboard - Welcome back, {user?.firstName || "Executive"}
              </h1>
              <p className="text-xl mb-8 text-blue-100">
                Your personalized health and fitness command center designed for high-performing executives.
              </p>
              
              {/* Daily Health Score */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Today's Health Score</h3>
                  <Brain className="h-5 w-5 text-blue-200" />
                </div>
                <div className="flex items-center">
                  <div className="relative w-16 h-16 mr-4">
                    <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                      <path 
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                        fill="none" 
                        stroke="rgba(255,255,255,0.2)" 
                        strokeWidth="2"
                      />
                      <path 
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                        fill="none" 
                        stroke="#10B981" 
                        strokeWidth="2" 
                        strokeDasharray={`${healthScore}, 100`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold">{healthScore}</span>
                    </div>
                  </div>
                  <div>
                    <div className={`text-sm mb-1 ${getHealthScoreColor(healthScore)}`}>
                      {getHealthScoreLabel(healthScore)}
                    </div>
                    <div className="text-xs text-blue-200">
                      Sleep: {latestProgress?.sleepHours || 8.2}h | HRV: {latestProgress?.hrv || 45}ms | RHR: {latestProgress?.rhr || 52}bpm
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="hidden lg:block">
              <img 
                src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600" 
                alt="Executive fitness training" 
                className="rounded-xl shadow-2xl w-full h-auto object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">This Week</p>
                    <p className="text-2xl font-bold text-neutral-dark">
                      {latestProgress?.workoutsCompleted || 4}/5
                    </p>
                    <p className="text-xs text-secondary">Workouts Completed</p>
                  </div>
                  <div className="bg-secondary/10 p-3 rounded-full">
                    <Dumbbell className="h-5 w-5 text-secondary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg Sleep</p>
                    <p className="text-2xl font-bold text-neutral-dark">
                      {latestProgress?.sleepHours || 7.8}h
                    </p>
                    <p className="text-xs text-primary">Last 7 days</p>
                  </div>
                  <div className="bg-primary/10 p-3 rounded-full">
                    <Moon className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Streak</p>
                    <p className="text-2xl font-bold text-neutral-dark">12</p>
                    <p className="text-xs text-orange-600">Days Active</p>
                  </div>
                  <div className="bg-orange-100 p-3 rounded-full">
                    <Flame className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Check-ins</p>
                    <p className="text-2xl font-bold text-neutral-dark">3/4</p>
                    <p className="text-xs text-purple-600">This Month</p>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-full">
                    <ClipboardCheck className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-neutral-dark mb-2">Quick Actions</h2>
            <p className="text-gray-600">Get started with your health journey today</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/programs'}>
              <CardContent className="p-6 text-center">
                <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto mb-4">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Start Programme</h3>
                <p className="text-sm text-gray-600">Begin a customized training program</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/dashboard'}>
              <CardContent className="p-6 text-center">
                <div className="bg-secondary/10 p-4 rounded-full w-fit mx-auto mb-4">
                  <Calendar className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="font-semibold mb-2">Daily Check-in</h3>
                <p className="text-sm text-gray-600">Log how you're feeling today</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/injury-tracking'}>
              <CardContent className="p-6 text-center">
                <div className="bg-orange-100 p-4 rounded-full w-fit mx-auto mb-4">
                  <TrendingUp className="h-6 w-6 text-orange-600" />
                </div>
                <h3 className="font-semibold mb-2">Injury Tracking</h3>
                <p className="text-sm text-gray-600">Track recovery and get smart recommendations</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/library'}>
              <CardContent className="p-6 text-center">
                <div className="bg-purple-100 p-4 rounded-full w-fit mx-auto mb-4">
                  <Brain className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold mb-2">Learn</h3>
                <p className="text-sm text-gray-600">Explore educational content</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Progress Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Weekly Goal</span>
                      <span>80%</span>
                    </div>
                    <div className="flex h-2 w-full bg-border rounded-full overflow-hidden"><div className="h-full bg-[#0cc9a9] transition-all" style={{ width: "80%" }}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Nutrition Adherence</span>
                      <span>75%</span>
                    </div>
                    <div className="flex h-2 w-full bg-border rounded-full overflow-hidden"><div className="h-full bg-[#0cc9a9] transition-all" style={{ width: "75%" }}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Sleep Quality</span>
                      <span>90%</span>
                    </div>
                    <div className="flex h-2 w-full bg-border rounded-full overflow-hidden"><div className="h-full bg-[#0cc9a9] transition-all" style={{ width: "90%" }}></div></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Next Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center p-3 bg-blue-50 rounded-lg">
                    <Calendar className="h-5 w-5 text-primary mr-3" />
                    <div>
                      <p className="font-medium text-sm">Complete Weekly Check-in</p>
                      <p className="text-xs text-gray-600">Due in 2 days</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center p-3 bg-green-50 rounded-lg">
                    <Dumbbell className="h-5 w-5 text-secondary mr-3" />
                    <div>
                      <p className="font-medium text-sm">Tomorrow's Workout</p>
                      <p className="text-xs text-gray-600">HIIT Circuit - 30 min</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center p-3 bg-purple-50 rounded-lg">
                    <Brain className="h-5 w-5 text-purple-600 mr-3" />
                    <div>
                      <p className="font-medium text-sm">New Content Available</p>
                      <p className="text-xs text-gray-600">Stress Management Workshop</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}