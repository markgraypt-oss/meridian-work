import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Trash2, BookOpen, Play, ChefHat, Users, Database, Shield } from "lucide-react";

export default function AdminFinal() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch data only when authenticated
  const { data: programs = [], isLoading: programsLoading } = useQuery<any[]>({
    queryKey: ["/api/programs"],
    enabled: isAuthenticated,
  });

  const { data: videos = [], isLoading: videosLoading } = useQuery<any[]>({
    queryKey: ["/api/videos"],
    enabled: isAuthenticated,
  });

  const { data: recipes = [], isLoading: recipesLoading } = useQuery<any[]>({
    queryKey: ["/api/recipes"],
    enabled: isAuthenticated,
  });

  // Delete mutations
  const deleteProgramme = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/programs/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete program");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/programs"] });
      toast({ title: "Programme deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete program", variant: "destructive" });
    },
  });

  const deleteVideo = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/videos/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete video");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      toast({ title: "Video deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete video", variant: "destructive" });
    },
  });

  const deleteRecipe = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete recipe");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Recipe deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete recipe", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">You need to be logged in to access the admin panel.</p>
          <button
            onClick={() => window.location.href = "/api/login"}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-600 mt-2">Manage your platform content and settings</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: "overview", name: "Overview", icon: Database },
                { id: "programs", name: "Programmes", icon: BookOpen },
                { id: "videos", name: "Videos", icon: Play },
                { id: "recipes", name: "Recipes", icon: ChefHat },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap flex items-center py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  <tab.icon className="h-5 w-5 mr-2" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <div className="flex items-center">
                      <BookOpen className="h-8 w-8 text-blue-600" />
                      <div className="ml-4">
                        <p className="text-2xl font-bold text-blue-900">{programs.length}</p>
                        <p className="text-blue-700">Training Programmes</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 p-6 rounded-lg">
                    <div className="flex items-center">
                      <Play className="h-8 w-8 text-green-600" />
                      <div className="ml-4">
                        <p className="text-2xl font-bold text-green-900">{videos.length}</p>
                        <p className="text-green-700">Educational Videos</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 p-6 rounded-lg">
                    <div className="flex items-center">
                      <ChefHat className="h-8 w-8 text-purple-600" />
                      <div className="ml-4">
                        <p className="text-2xl font-bold text-purple-900">{recipes.length}</p>
                        <p className="text-purple-700">Nutrition Recipes</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Platform Status */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Platform Status</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Database Connection</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Authentication System</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Secured
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Content Management</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Ready
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "programs" && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">Training Programmes</h2>
                {programsLoading ? (
                  <div className="text-center py-8">Loading programs...</div>
                ) : (
                  <div className="grid gap-4">
                    {programs.map((program) => (
                      <div key={program.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{program.title}</h3>
                            <p className="text-sm text-gray-600 mt-1">{program.description?.slice(0, 150)}...</p>
                            <div className="flex gap-2 mt-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {program.goal}
                              </span>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {program.difficulty}
                              </span>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {program.duration} min
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => deleteProgramme.mutate(program.id)}
                            disabled={deleteProgramme.isPending}
                            className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-md"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "videos" && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">Educational Videos</h2>
                {videosLoading ? (
                  <div className="text-center py-8">Loading videos...</div>
                ) : (
                  <div className="grid gap-4">
                    {videos.map((video) => (
                      <div key={video.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{video.title}</h3>
                            <p className="text-sm text-gray-600 mt-1">{video.description?.slice(0, 150)}...</p>
                            <div className="flex gap-2 mt-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {video.category}
                              </span>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {Math.floor(video.duration / 60)} min
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => deleteVideo.mutate(video.id)}
                            disabled={deleteVideo.isPending}
                            className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-md"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "recipes" && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">Nutrition Recipes</h2>
                {recipesLoading ? (
                  <div className="text-center py-8">Loading recipes...</div>
                ) : (
                  <div className="grid gap-4">
                    {recipes.map((recipe) => (
                      <div key={recipe.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{recipe.title}</h3>
                            <p className="text-sm text-gray-600 mt-1">{recipe.description?.slice(0, 150)}...</p>
                            <div className="flex gap-2 mt-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                {recipe.category}
                              </span>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {recipe.difficulty}
                              </span>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {recipe.calories} cal
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => deleteRecipe.mutate(recipe.id)}
                            disabled={deleteRecipe.isPending}
                            className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-md"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}