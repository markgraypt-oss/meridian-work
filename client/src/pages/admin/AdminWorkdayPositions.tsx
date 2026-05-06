import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { apiRequest } from "@/lib/queryClient";
import { uploadImageFile, uploadErrorMessage } from "@/lib/uploadImage";
import { useToast } from "@/hooks/use-toast";
import TopHeader from "@/components/TopHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, X, GripVertical, Check } from "lucide-react";
import type { WorkdayPosition } from "@shared/schema";

type PositionType = "seated" | "standing" | "alternative";

interface PositionFormData {
  name: string;
  description: string;
  imageUrl: string;
  setupCues: string[];
  positionType: PositionType;
  isActive: boolean;
}

const defaultFormData: PositionFormData = {
  name: "",
  description: "",
  imageUrl: "",
  setupCues: [],
  positionType: "seated",
  isActive: true,
};

export default function AdminWorkdayPositions() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<PositionFormData>(defaultFormData);
  const [newCue, setNewCue] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageJustUploaded, setImageJustUploaded] = useState(false);

  const { data: positions = [], isLoading } = useQuery<WorkdayPosition[]>({
    queryKey: ["/api/admin/workday/positions"],
  });

  const createMutation = useMutation({
    mutationFn: (data: PositionFormData) =>
      apiRequest("POST", "/api/admin/workday/positions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workday/positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workday/positions"] });
      toast({ title: "Position created successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create position", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PositionFormData> }) =>
      apiRequest("PATCH", `/api/admin/workday/positions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workday/positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workday/positions"] });
      toast({ title: "Position updated successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to update position", variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: number[]) =>
      apiRequest("PUT", "/api/admin/workday/positions/reorder", { orderedIds }),
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: ["/api/admin/workday/positions"] });
      const previous = queryClient.getQueryData<WorkdayPosition[]>(["/api/admin/workday/positions"]);
      if (previous) {
        const byId = new Map(previous.map((p) => [p.id, p]));
        const next = orderedIds
          .map((id, idx) => {
            const p = byId.get(id);
            return p ? { ...p, orderIndex: idx } : null;
          })
          .filter((p): p is WorkdayPosition => p !== null);
        queryClient.setQueryData<WorkdayPosition[]>(["/api/admin/workday/positions"], next);
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/admin/workday/positions"], context.previous);
      }
      toast({ title: "Failed to reorder positions", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workday/positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workday/positions"] });
    },
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    const items = Array.from(positions);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    reorderMutation.mutate(items.map((p) => p.id));
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/admin/workday/positions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workday/positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workday/positions"] });
      toast({ title: "Position deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete position", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingId(null);
    setShowForm(false);
    setNewCue("");
    setImageJustUploaded(false);
  };

  const handleEdit = (position: WorkdayPosition) => {
    const positionType: PositionType =
      position.positionType === "standing" || position.positionType === "alternative"
        ? position.positionType
        : "seated";
    setFormData({
      name: position.name,
      description: position.description,
      imageUrl: position.imageUrl || "",
      setupCues: position.setupCues || [],
      positionType,
      isActive: position.isActive ?? true,
    });
    setEditingId(position.id);
    setShowForm(true);
    setImageJustUploaded(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploadingImage(true);
      const objectPath = await uploadImageFile(file);
      setFormData((prev) => ({ ...prev, imageUrl: objectPath }));
      setImageJustUploaded(true);
      toast({ title: "Image uploaded", description: "Click Save to attach it to the position." });
    } catch (error) {
      toast({ title: "Upload failed", description: uploadErrorMessage(error), variant: "destructive" });
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  };

  const addCue = () => {
    if (newCue.trim()) {
      setFormData({ ...formData, setupCues: [...formData.setupCues, newCue.trim()] });
      setNewCue("");
    }
  };

  const removeCue = (index: number) => {
    setFormData({
      ...formData,
      setupCues: formData.setupCues.filter((_, i) => i !== index),
    });
  };

  const typeLabel = (t: string | null | undefined) => {
    if (t === "standing") return "Standing";
    if (t === "alternative") return "Alternative";
    return "Seated";
  };

  return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Workday Positions" onBack={() => navigate("/admin?tab=desk-health")} />

      <div className="p-4 pt-16 space-y-4">
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90"
            data-testid="button-add-position"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Position
          </Button>
        )}

        {showForm && (
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">
                {editingId ? "Edit Position" : "New Position"}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={resetForm} data-testid="button-close-form">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Seated, Standing"
                    className="bg-background border-border"
                    required
                    data-testid="input-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="positionType">Position type</Label>
                  <Select
                    value={formData.positionType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, positionType: value as PositionType })
                    }
                  >
                    <SelectTrigger id="positionType" className="bg-background border-border" data-testid="select-position-type">
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seated">Seated</SelectItem>
                      <SelectItem value="standing">Standing</SelectItem>
                      <SelectItem value="alternative">Alternative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="When to use this position"
                    className="bg-background border-border"
                    required
                    data-testid="input-description"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="imageUrl">Image (optional)</Label>
                  <p className="text-xs text-muted-foreground">
                    Recommended: 1200 × 800px (3:2 landscape). Min 600px wide. Max 10MB. JPG or PNG.
                  </p>
                  {formData.imageUrl ? (
                    <div className="space-y-2">
                      <div className="relative inline-block">
                        <img
                          src={formData.imageUrl}
                          alt="Preview"
                          className="w-48 h-32 object-cover rounded-lg border border-border"
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                        <button
                          type="button"
                          className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs font-bold hover:bg-destructive/80"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, imageUrl: "" }));
                            setImageJustUploaded(false);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                      {imageJustUploaded && (
                        <div className="flex items-center gap-1.5 text-xs text-[#0cc9a9]" data-testid="text-image-attached">
                          <Check className="h-3.5 w-3.5" />
                          Image attached. Click {editingId ? "Update" : "Create"} to save.
                        </div>
                      )}
                      <label className="inline-flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline">
                        Replace image
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-48 h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                      <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span className="text-xs font-medium">Upload Image</span>
                        <span className="text-[10px]">1200 × 800px</span>
                      </div>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                    </label>
                  )}
                  {uploadingImage && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Uploading...
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Setup Cues</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newCue}
                      onChange={(e) => setNewCue(e.target.value)}
                      placeholder="Add a setup cue"
                      className="bg-background border-border"
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addCue())}
                      data-testid="input-new-cue"
                    />
                    <Button type="button" onClick={addCue} variant="secondary" data-testid="button-add-cue">
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2 mt-2">
                    {formData.setupCues.map((cue, index) => (
                      <div key={index} className="flex items-center gap-2 bg-muted p-2 rounded">
                        <GripVertical className="h-4 w-4 text-gray-500" />
                        <span className="flex-1 text-sm">{cue}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCue(index)}
                          className="h-6 w-6"
                          data-testid={`button-remove-cue-${index}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    data-testid="switch-is-active"
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {editingId ? "Update Position" : "Create Position"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : positions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No positions yet. Add your first position above.
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="positions-list">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-3"
                >
                  {positions.map((position, index) => (
                    <Draggable
                      key={position.id}
                      draggableId={String(position.id)}
                      index={index}
                    >
                      {(dragProvided, snapshot) => (
                        <Card
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`bg-card border-border transition-colors ${!position.isActive ? "opacity-50" : ""} ${snapshot.isDragging ? "border-primary shadow-lg" : ""}`}
                          data-testid={`card-position-${position.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div
                                {...dragProvided.dragHandleProps}
                                className="flex-shrink-0 pt-1 cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300"
                                aria-label="Drag to reorder"
                                data-testid={`drag-handle-${position.id}`}
                              >
                                <GripVertical className="h-5 w-5" />
                              </div>
                              {position.imageUrl && (
                                <img
                                  src={position.imageUrl}
                                  alt={position.name}
                                  className="w-16 h-16 object-cover rounded"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-white">{position.name}</h3>
                                  <span className="text-xs bg-muted px-2 py-0.5 rounded text-foreground/80">
                                    {typeLabel(position.positionType)}
                                  </span>
                                  {!position.isActive && (
                                    <span className="text-xs bg-gray-600 px-2 py-0.5 rounded">Inactive</span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-400 line-clamp-2">{position.description}</p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(position)}
                                  data-testid={`button-edit-${position.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteMutation.mutate(position.id)}
                                  className="text-red-400 hover:text-red-300"
                                  data-testid={`button-delete-${position.id}`}
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
        )}
      </div>
    </div>
  );
}
