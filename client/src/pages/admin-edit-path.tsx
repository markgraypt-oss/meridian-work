import { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PlayCircle, FileText, File, Trash2, Clock, Plus, Check, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import type { LearningPath, PathContentItem } from "@shared/schema";

interface LearnContentLibraryItem {
  id: number;
  title: string;
  description: string | null;
  contentType: string;
  contentUrl: string;
  thumbnailUrl: string | null;
  muxPlaybackId: string | null;
  duration: number | null;
  topicId: number;
  tags: string[] | null;
  createdAt: Date | null;
  orderIndex?: number;
  isRequired?: boolean | null;
  pathContentId?: number;
}

export default function AdminEditPath() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/admin/edit-path/:id");
  const pathId = params?.id;
  const { markDirty, markClean, handleNavigation, UnsavedChangesDialog } = useUnsavedChanges();
  const initialLoadRef = useRef(true);

  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [showAddContentModal, setShowAddContentModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteContentId, setDeleteContentId] = useState<number | null>(null);

  const { data: learningPath, isLoading: pathLoading } = useQuery<LearningPath>({
    queryKey: [`/api/learning-paths/${pathId}`],
    enabled: isAuthenticated && !!pathId,
  });

  // Get the path's library content (content items added to this path from the library)
  const { data: pathLibraryContent = [] } = useQuery<LearnContentLibraryItem[]>({
    queryKey: [`/api/learning-paths/${pathId}/library-content`],
    enabled: isAuthenticated && !!pathId,
  });

  // Fetch content library items for the topic when modal is open
  const { data: topicContent = [] } = useQuery<LearnContentLibraryItem[]>({
    queryKey: [`/api/content-library/topic/${learningPath?.topicId}`],
    enabled: isAuthenticated && showAddContentModal && !!learningPath?.topicId,
  });

  // Calculate total duration from content items (in seconds, convert to minutes)
  const calculatedDuration = useMemo(() => {
    const totalSeconds = pathLibraryContent.reduce((sum, item) => sum + (item.duration || 0), 0);
    return Math.ceil(totalSeconds / 60); // Convert to minutes
  }, [pathLibraryContent]);

  // Get IDs of content already added to the path
  const addedContentIds = useMemo(() => {
    return new Set(pathLibraryContent.map(item => item.id));
  }, [pathLibraryContent]);

  useEffect(() => {
    if (learningPath) {
      setEditingTitle(learningPath.title || "");
      setEditingDescription(learningPath.description || "");
      initialLoadRef.current = false;
      markClean();
    }
  }, [learningPath, markClean]);

  useEffect(() => {
    if (!initialLoadRef.current) {
      markDirty();
    }
  }, [editingTitle, editingDescription, markDirty]);

  const updatePathMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/learning-paths/${pathId}`, {
        title: editingTitle,
        description: editingDescription,
        estimatedDuration: calculatedDuration,
      });
    },
    onSuccess: () => {
      markClean();
      queryClient.invalidateQueries({ queryKey: [`/api/learning-paths/${pathId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/learning-paths"] });
      toast({ title: "Success", description: "Path updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update path", variant: "destructive" });
    },
  });

  // Add content from library to path
  const addLibraryContentMutation = useMutation({
    mutationFn: async (libraryItemId: number) => {
      return apiRequest("POST", `/api/learning-paths/${pathId}/library-content`, { libraryItemId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/learning-paths/${pathId}/library-content`] });
      toast({ title: "Success", description: "Content added to path" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add content to path", variant: "destructive" });
    },
  });

  // Remove content from path
  const removeLibraryContentMutation = useMutation({
    mutationFn: async (libraryItemId: number) => {
      return apiRequest("DELETE", `/api/learning-paths/${pathId}/library-content/${libraryItemId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/learning-paths/${pathId}/library-content`] });
      setDeleteContentId(null);
      toast({ title: "Success", description: "Content removed from path" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove content from path", variant: "destructive" });
    },
  });

  // Reorder content in path
  const reorderContentMutation = useMutation({
    mutationFn: async (itemIds: number[]) => {
      return apiRequest("PUT", `/api/learning-paths/${pathId}/reorder`, { itemIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/learning-paths/${pathId}/library-content`] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reorder content", variant: "destructive" });
    },
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;

    const items = Array.from(pathLibraryContent);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Get the ordered IDs and send to server
    const orderedIds = items.map(item => item.id);
    reorderContentMutation.mutate(orderedIds);
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case "video":
        return <PlayCircle className="h-5 w-5" />;
      case "pdf":
        return <FileText className="h-5 w-5" />;
      case "swipe_file":
        return <File className="h-5 w-5" />;
      default:
        return <File className="h-5 w-5" />;
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0min";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    if (secs === 0) return `${mins}min`;
    return `${mins}min ${secs}s`;
  };

  if (isLoading || pathLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <UnsavedChangesDialog />
      <TopHeader
        title="Edit Learning Path"
        onBack={() => handleNavigation(`/admin?tab=learn&pathId=${pathId}`)}
        data-testid="button-back-to-admin"
      />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Path Header - Editable */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-400">Path Title</label>
                <Input
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  className="mt-2 bg-background border-border"
                  placeholder="Enter path title"
                  data-testid="input-path-title"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-400">Description</label>
                <textarea
                  value={editingDescription}
                  onChange={(e) => setEditingDescription(e.target.value)}
                  className="w-full mt-2 px-3 py-2 bg-background border border-border rounded text-foreground"
                  rows={3}
                  placeholder="Enter path description"
                  data-testid="textarea-path-description"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => updatePathMutation.mutate()}
                  disabled={updatePathMutation.isPending}
                  className="flex-1"
                  data-testid="button-save-path"
                >
                  {updatePathMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Path Metadata - Duration is auto-calculated */}
        {learningPath && (
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="pt-6 text-center">
                <Clock className="h-5 w-5 mx-auto mb-2 text-blue-400" />
                <p className="text-sm text-slate-400">{calculatedDuration} min</p>
                <p className="text-xs text-slate-500 mt-1">Total Duration</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-6 text-center">
                <p className="text-sm font-medium">{pathLibraryContent.length} items</p>
                <p className="text-xs text-slate-500 mt-1">Content</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Learning Content with Drag and Drop */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Learning Content</h2>
            <Button
              onClick={() => setShowAddContentModal(true)}
              size="sm"
              className="gap-2"
              data-testid="button-add-content"
            >
              <Plus className="h-4 w-4" />
              Add Content
            </Button>
          </div>

          {pathLibraryContent.length > 0 ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="content-list">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-3"
                  >
                    {pathLibraryContent.map((item, index) => (
                      <Draggable key={item.id} draggableId={String(item.id)} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`bg-card border-border transition-colors ${snapshot.isDragging ? 'border-primary shadow-lg' : 'hover:border-border'}`}
                          >
                            <CardContent className="pt-6">
                              <div className="flex items-start justify-between">
                                <div className="flex gap-4 flex-1">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="flex-shrink-0 pt-1 cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300"
                                  >
                                    <GripVertical className="h-5 w-5" />
                                  </div>
                                  <div className="flex-shrink-0 pt-1">
                                    {getContentIcon(item.contentType)}
                                  </div>
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                                    <p className="text-sm text-slate-400 mt-1">{item.description || "No description"}</p>
                                    {item.duration && (
                                      <p className="text-xs text-slate-500 mt-2">{formatDuration(item.duration)}</p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 ml-4">
                                  <Badge variant="outline" className="text-xs">
                                    {item.contentType}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive/80"
                                    onClick={() => setDeleteContentId(item.id)}
                                    disabled={removeLibraryContentMutation.isPending}
                                    data-testid={`button-remove-content-${item.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          ) : (
            <Card className="bg-card border-border p-8 text-center">
              <p className="text-slate-400">No content items yet. Click "Add Content" to select videos from the topic library.</p>
            </Card>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteContentId !== null} onOpenChange={(open) => !open && setDeleteContentId(null)}>
          <AlertDialogContent className="bg-background border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Content</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove this content from the learning path? The content will remain in your library.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-card border-border hover:bg-muted">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteContentId && removeLibraryContentMutation.mutate(deleteContentId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Content from Library Modal */}
        <Dialog open={showAddContentModal} onOpenChange={setShowAddContentModal}>
          <DialogContent className="bg-background border-border max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Content from Topic Library</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <Input
                placeholder="Search content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-card border-border"
                data-testid="input-search-content"
              />

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {topicContent
                  .filter((item) =>
                    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (item.description || "").toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((item) => {
                    const isAdded = addedContentIds.has(item.id);
                    return (
                      <Card key={item.id} className={`bg-card border-border ${isAdded ? 'opacity-60' : 'hover:border-border'}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex gap-3 flex-1">
                              <div className="flex-shrink-0 pt-1">
                                {getContentIcon(item.contentType)}
                              </div>
                              <div className="flex-1">
                                <h3 className="font-semibold text-foreground">{item.title}</h3>
                                <p className="text-sm text-slate-400 mt-1">{item.description || "No description"}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {item.contentType}
                                  </Badge>
                                  {item.duration && (
                                    <span className="text-xs text-slate-500">
                                      {formatDuration(item.duration)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {isAdded ? (
                              <Badge variant="secondary" className="gap-1">
                                <Check className="h-3 w-3" />
                                Added
                              </Badge>
                            ) : (
                              <Button
                                onClick={() => addLibraryContentMutation.mutate(item.id)}
                                disabled={addLibraryContentMutation.isPending}
                                size="sm"
                                data-testid={`button-add-content-${item.id}`}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                {topicContent.filter((item) =>
                  item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (item.description || "").toLowerCase().includes(searchQuery.toLowerCase())
                ).length === 0 && (
                  <p className="text-center text-slate-400 py-8">No content found in this topic. Add videos to the topic first.</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
