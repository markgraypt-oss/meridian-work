import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Play, BookOpen, Eye, ChevronLeft } from "lucide-react";
import type { Video } from "@shared/schema";

export default function Library() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState("All");

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

  const { data: videos = [], isLoading: videosLoading, error } = useQuery<Video[]>({
    queryKey: ["/api/videos", selectedCategory],
    retry: false,
    enabled: isAuthenticated,
  });

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

  if (isLoading || videosLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading library...</p>
        </div>
      </div>
    );
  }

  const categories = ["All", "Training", "Nutrition", "Breathwork", "Recovery", "Supplements"];

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'training':
        return 'bg-primary/10 text-primary';
      case 'nutrition':
        return 'bg-secondary/10 text-secondary';
      case 'breathwork':
        return 'bg-purple-100 text-purple-700';
      case 'recovery':
        return 'bg-orange-100 text-orange-700';
      case 'supplements':
        return 'bg-teal-100 text-teal-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatCategory = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  return (
    <div className="min-h-screen bg-white pt-16 pb-20">
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            className="mb-4 -ml-4"
            onClick={() => navigate('/')}
            data-testid="button-back-to-home"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Back to Home
          </Button>
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-neutral-dark mb-4">Educational Library</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Comprehensive video library covering training, nutrition, breathwork, recovery, and supplements.
            </p>
          </div>
          
          {/* Category Tabs */}
          <div className="flex flex-wrap justify-center mb-8">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className={`mr-3 mb-3 ${
                  selectedCategory === category 
                    ? "bg-primary text-white" 
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
          
          {/* Video Grid */}
          {videos.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No videos found</h3>
              <p className="text-gray-500">Check back soon for new educational content.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <Card key={video.id} className="bg-gray-50 hover:shadow-lg transition-shadow overflow-hidden">
                  <div className="relative">
                    <img 
                      src={video.thumbnailUrl || "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300"} 
                      alt={video.title} 
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <Button className="bg-white/90 hover:bg-white text-primary rounded-full p-4">
                        <Play className="h-6 w-6" />
                      </Button>
                    </div>
                    <div className="absolute top-3 left-3">
                      <Badge className={getCategoryColor(video.category)}>
                        {formatCategory(video.category)}
                      </Badge>
                    </div>
                    <div className="absolute bottom-3 right-3">
                      <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                        {formatDuration(video.duration)}
                      </span>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-neutral-dark mb-2">{video.title}</h3>
                    <p className="text-sm text-gray-600 mb-3">{video.description}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{video.instructor}</span>
                      <div className="flex items-center">
                        <Eye className="h-3 w-3 mr-1" />
                        <span>{video.views || 0} views</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
