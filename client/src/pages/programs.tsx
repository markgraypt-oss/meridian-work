import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Clock, Target } from "lucide-react";
import type { Programme } from "@shared/schema";
import { ProgrammePreviewDialog } from "@/components/ProgrammePreviewDialog";

export default function Programmes() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [filters, setFilters] = useState({
    goal: "All Goals",
    equipment: "All Equipment",
    duration: "Any Duration",
    injuries: "No Restrictions"
  });
  const [selectedProgramme, setSelectedProgramme] = useState<Programme | null>(null);

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

  const { data: programs = [], isLoading: programsLoading, error } = useQuery<Programme[]>({
    queryKey: ["/api/programs", filters],
    retry: false,
    enabled: isAuthenticated,
  });

  const enrollMutation = useMutation({
    mutationFn: async (programId: number) => {
      const res = await apiRequest("POST", `/api/programs/${programId}/enroll`, {});
      return res.json();
    },
    onSuccess: (enrollment) => {
      toast({
        title: "Success",
        description: "You've been enrolled in the program!",
      });
      setSelectedProgramme(null);
      navigate(`/program-hub/${enrollment.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to enroll in program. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleOpenPreview = (program: Programme) => {
    setSelectedProgramme(program);
  };

  const handleClosePreview = () => {
    setSelectedProgramme(null);
  };

  const handleEnroll = (programId: number) => {
    enrollMutation.mutate(programId);
  };

  if (error && isUnauthorizedError(error as Error)) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 500);
    return null;
  }

  if (isLoading || programsLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading programs...</p>
        </div>
      </div>
    );
  }

  const getGoalColor = (goal: string) => {
    switch (goal) {
      case 'fat_loss':
        return 'bg-secondary/10 text-secondary';
      case 'performance':
        return 'bg-primary/10 text-primary';
      case 'pain_free':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatGoal = (goal: string) => {
    return goal.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-neutral-dark mb-4">Customized Training Programmes</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              AI-powered programs tailored to your goals, schedule, and available equipment.
            </p>
          </div>
          
          {/* Filter Panel */}
          <div className="bg-white rounded-xl p-6 mb-8 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Goal</label>
                <Select value={filters.goal} onValueChange={(value) => setFilters(prev => ({ ...prev, goal: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select goal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Goals">All Goals</SelectItem>
                    <SelectItem value="Fat Loss">Fat Loss</SelectItem>
                    <SelectItem value="Performance">Performance</SelectItem>
                    <SelectItem value="Pain-Free Movement">Pain-Free Movement</SelectItem>
                    <SelectItem value="Mobility">Mobility</SelectItem>
                    <SelectItem value="Yoga">Yoga</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Equipment</label>
                <Select value={filters.equipment} onValueChange={(value) => setFilters(prev => ({ ...prev, equipment: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Equipment">All Equipment</SelectItem>
                    <SelectItem value="Home Gym">Home Gym</SelectItem>
                    <SelectItem value="Full Gym">Full Gym</SelectItem>
                    <SelectItem value="Bodyweight Only">Bodyweight Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                <Select value={filters.duration} onValueChange={(value) => setFilters(prev => ({ ...prev, duration: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Any Duration">Any Duration</SelectItem>
                    <SelectItem value="15-30 min">15-30 min</SelectItem>
                    <SelectItem value="30-45 min">30-45 min</SelectItem>
                    <SelectItem value="45+ min">45+ min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Injuries</label>
                <Select value={filters.injuries} onValueChange={(value) => setFilters(prev => ({ ...prev, injuries: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select restrictions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No Restrictions">No Restrictions</SelectItem>
                    <SelectItem value="Lower Back">Lower Back</SelectItem>
                    <SelectItem value="Knee">Knee</SelectItem>
                    <SelectItem value="Shoulder">Shoulder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* Programme Cards */}
          {programs.length === 0 ? (
            <div className="text-center py-12">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No programs found</h3>
              <p className="text-gray-500">Try adjusting your filters to see more programs.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {programs.map((program) => (
                <Card key={program.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                  <img 
                    src={program.imageUrl || "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400"} 
                    alt={program.title} 
                    className="w-full h-48 object-cover"
                  />
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <Badge className={getGoalColor(program.goal)}>
                        {formatGoal(program.goal)}
                      </Badge>
                      <span className="text-sm text-gray-500">{program.duration} min</span>
                    </div>
                    <h3 className="text-xl font-semibold text-neutral-dark mb-2">{program.title}</h3>
                    <p className="text-gray-600 text-sm mb-4">{program.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="h-4 w-4 mr-1" />
                        <span>{program.weeks} weeks</span>
                      </div>
                      <Button 
                        className="btn-primary" 
                        onClick={() => handleOpenPreview(program)}
                        data-testid={`button-preview-program-${program.id}`}
                      >
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      <ProgrammePreviewDialog
        program={selectedProgramme}
        isOpen={!!selectedProgramme}
        onClose={handleClosePreview}
        onEnroll={handleEnroll}
        isEnrolling={enrollMutation.isPending}
        onToggleFavourite={() => {}}
        isFavourited={() => false}
      />
    </div>
  );
}
