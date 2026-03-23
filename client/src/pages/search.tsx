import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Search as SearchIcon, BookOpen, Bookmark, Star } from "lucide-react";
import type { Programme, Video, Recipe } from "@shared/schema";

interface SearchResults {
  programs: Programme[];
  videos: Video[];
  recipes: Recipe[];
}

export default function Search() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

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

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchResults, isLoading: searchLoading, error } = useQuery<SearchResults>({
    queryKey: ["/api/search", { q: debouncedQuery }],
    retry: false,
    enabled: isAuthenticated && debouncedQuery.length > 0,
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

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading search...</p>
        </div>
      </div>
    );
  }

  const popularTags = [
    "lower back pain",
    "Zone 2 cardio", 
    "meal prep",
    "sleep optimization",
    "stress management",
    "fat loss"
  ];

  const handleTagClick = (tag: string) => {
    setSearchQuery(tag);
  };

  const getContentTypeColor = (type: string) => {
    switch (type) {
      case 'programme':
        return 'bg-primary/10 text-primary';
      case 'video':
        return 'bg-secondary/10 text-secondary';
      case 'recipe':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatContentType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getTotalResults = () => {
    if (!searchResults) return 0;
    return searchResults.programs.length + searchResults.videos.length + searchResults.recipes.length;
  };

  return (
    <div className="min-h-screen bg-white pt-16">
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-neutral-dark mb-4">Knowledge Hub</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Search and discover content tailored to your specific needs and interests.
            </p>
          </div>
          
          {/* Search Interface */}
          <div className="max-w-2xl mx-auto mb-12">
            <div className="relative">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-primary focus:border-primary text-lg"
                placeholder="Search for topics, exercises, or advice..."
              />
              <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            </div>
            
            {/* Popular Tags */}
            <div className="mt-6">
              <p className="text-sm text-gray-600 mb-3">Popular searches:</p>
              <div className="flex flex-wrap gap-2">
                {popularTags.map((tag) => (
                  <Button
                    key={tag}
                    variant="outline"
                    size="sm"
                    onClick={() => handleTagClick(tag)}
                    className="bg-gray-100 hover:bg-primary hover:text-white text-gray-700 transition-colors"
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Search Results */}
          {searchLoading && debouncedQuery && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Searching...</p>
            </div>
          )}

          {!searchLoading && debouncedQuery && searchResults && (
            <>
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-neutral-dark mb-2">
                  Search Results for "{debouncedQuery}"
                </h2>
                <p className="text-gray-600">
                  Found {getTotalResults()} result{getTotalResults() !== 1 ? 's' : ''}
                </p>
              </div>

              {getTotalResults() === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No results found</h3>
                  <p className="text-gray-500">Try different keywords or browse our popular content.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Programme Results */}
                  {searchResults.programs.map((program) => (
                    <Card key={`program-${program.id}`} className="bg-gray-50 hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-3">
                          <Badge className={getContentTypeColor('programme')}>
                            Programme
                          </Badge>
                          <Bookmark className="h-4 w-4 text-gray-300 hover:text-primary cursor-pointer" />
                        </div>
                        <h3 className="font-semibold text-neutral-dark mb-2">{program.title}</h3>
                        <p className="text-sm text-gray-600 mb-4">{program.description}</p>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                          <span>{program.duration} min routine</span>
                          <div className="flex items-center">
                            <Star className="h-3 w-3 mr-1 fill-current text-[#0cc9a9]" />
                            <span>4.8 (234 reviews)</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {program.tags?.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Video Results */}
                  {searchResults.videos.map((video) => (
                    <Card key={`video-${video.id}`} className="bg-gray-50 hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-3">
                          <Badge className={getContentTypeColor('video')}>
                            Video
                          </Badge>
                          <Bookmark className="h-4 w-4 text-gray-300 hover:text-primary cursor-pointer" />
                        </div>
                        <h3 className="font-semibold text-neutral-dark mb-2">{video.title}</h3>
                        <p className="text-sm text-gray-600 mb-4">{video.description}</p>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                          <span>{Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')} min</span>
                          <div className="flex items-center">
                            <Star className="h-3 w-3 mr-1 fill-current text-[#0cc9a9]" />
                            <span>4.9 ({video.views || 0} views)</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {video.tags?.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Recipe Results */}
                  {searchResults.recipes.map((recipe) => (
                    <Card key={`recipe-${recipe.id}`} className="bg-gray-50 hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-3">
                          <Badge className={getContentTypeColor('recipe')}>
                            Recipe
                          </Badge>
                          <Bookmark className="h-4 w-4 text-gray-300 hover:text-primary cursor-pointer" />
                        </div>
                        <h3 className="font-semibold text-neutral-dark mb-2">{recipe.title}</h3>
                        <p className="text-sm text-gray-600 mb-4">{recipe.description}</p>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                          <span>{recipe.totalTime} min</span>
                          <div className="flex items-center">
                            <Star className="h-3 w-3 mr-1 fill-current text-[#0cc9a9]" />
                            <span>4.7 ({recipe.calories} cal)</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {recipe.tags?.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {!debouncedQuery && (
            <div className="text-center py-12">
              <SearchIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Start searching</h3>
              <p className="text-gray-500">Enter a keyword above to find relevant content.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
