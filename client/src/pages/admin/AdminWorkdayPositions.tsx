import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import TopHeader from "@/components/TopHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, X, GripVertical } from "lucide-react";
import type { WorkdayPosition } from "@shared/schema";

interface PositionFormData {
  name: string;
  description: string;
  imageUrl: string;
  setupCues: string[];
  minDuration: number;
  maxDuration: number;
  orderIndex: number;
  isActive: boolean;
}

const defaultFormData: PositionFormData = {
  name: "",
  description: "",
  imageUrl: "",
  setupCues: [],
  minDuration: 30,
  maxDuration: 90,
  orderIndex: 0,
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

  const { data: positions = [], isLoading } = useQuery<WorkdayPosition[]>({
    queryKey: ["/api/admin/workday/positions"],
  });

  const createMutation = useMutation({
    mutationFn: (data: PositionFormData) =>
      apiRequest("POST", "/api/admin/workday/positions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workday/positions"] });
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
      toast({ title: "Position updated successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to update position", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/admin/workday/positions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workday/positions"] });
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
  };

  const handleEdit = (position: WorkdayPosition) => {
    setFormData({
      name: position.name,
      description: position.description,
      imageUrl: position.imageUrl || "",
      setupCues: position.setupCues || [],
      minDuration: position.minDuration || 30,
      maxDuration: position.maxDuration || 90,
      orderIndex: position.orderIndex || 0,
      isActive: position.isActive ?? true,
    });
    setEditingId(position.id);
    setShowForm(true);
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
      const uploadData = new FormData();
      uploadData.append('image', file);
      const response = await fetch('/api/upload/image', { method: 'POST', body: uploadData, credentials: 'include' });
      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json();
      setFormData(prev => ({ ...prev, imageUrl: result.imageUrl || result.url }));
      toast({ title: "Image uploaded" });
    } catch (error) {
      toast({ title: "Upload failed", description: "Could not upload image", variant: "destructive" });
    } finally {
      setUploadingImage(false);
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
              <Button
                variant="ghost"
                size="icon"
                onClick={resetForm}
                data-testid="button-close-form"
              >
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
                        <img src={formData.imageUrl} alt="Preview" className="w-48 h-32 object-cover rounded-lg border border-border" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        <button type="button" className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs font-bold hover:bg-destructive/80" onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}>✕</button>
                      </div>
                      <label className="inline-flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline">
                        Replace image
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} disabled={uploadingImage} className="hidden" />
                      </label>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-48 h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                      <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <span className="text-xs font-medium">Upload Image</span>
                        <span className="text-[10px]">1200 × 800px</span>
                      </div>
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} disabled={uploadingImage} className="hidden" />
                    </label>
                  )}
                  {uploadingImage && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Uploading...
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minDuration">Min Duration (min)</Label>
                    <Input
                      id="minDuration"
                      type="number"
                      value={formData.minDuration}
                      onChange={(e) => setFormData({ ...formData, minDuration: parseInt(e.target.value) || 0 })}
                      className="bg-background border-border"
                      data-testid="input-min-duration"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxDuration">Max Duration (min)</Label>
                    <Input
                      id="maxDuration"
                      type="number"
                      value={formData.maxDuration}
                      onChange={(e) => setFormData({ ...formData, maxDuration: parseInt(e.target.value) || 0 })}
                      className="bg-background border-border"
                      data-testid="input-max-duration"
                    />
                  </div>
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

                <div className="space-y-2">
                  <Label htmlFor="orderIndex">Order Index</Label>
                  <Input
                    id="orderIndex"
                    type="number"
                    value={formData.orderIndex}
                    onChange={(e) => setFormData({ ...formData, orderIndex: parseInt(e.target.value) || 0 })}
                    className="bg-background border-border"
                    data-testid="input-order-index"
                  />
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
          <div className="text-center py-8 text-gray-400">No positions yet. Add your first position above.</div>
        ) : (
          <div className="space-y-3">
            {positions.map((position) => (
              <Card
                key={position.id}
                className={`bg-card border-border ${!position.isActive ? "opacity-50" : ""}`}
                data-testid={`card-position-${position.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {position.imageUrl && (
                      <img
                        src={position.imageUrl}
                        alt={position.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{position.name}</h3>
                        {!position.isActive && (
                          <span className="text-xs bg-gray-600 px-2 py-0.5 rounded">Inactive</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-2">{position.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {position.minDuration}-{position.maxDuration} min
                      </p>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
