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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, X, GripVertical } from "lucide-react";
import type { WorkdayMicroReset } from "@shared/schema";

interface MicroResetFormData {
  name: string;
  description: string;
  targetArea: string;
  duration: number;
  steps: string[];
  imageUrl: string;
  muxPlaybackId: string;
  orderIndex: number;
  isActive: boolean;
}

const defaultFormData: MicroResetFormData = {
  name: "",
  description: "",
  targetArea: "neck",
  duration: 60,
  steps: [],
  imageUrl: "",
  muxPlaybackId: "",
  orderIndex: 0,
  isActive: true,
};

const targetAreas = [
  { value: "neck", label: "Neck" },
  { value: "upper_back", label: "Upper Back" },
  { value: "lower_back", label: "Lower Back" },
  { value: "hips", label: "Hips" },
  { value: "wrists", label: "Wrists" },
];

export default function AdminWorkdayMicroResets() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<MicroResetFormData>(defaultFormData);
  const [newStep, setNewStep] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: microResets = [], isLoading } = useQuery<WorkdayMicroReset[]>({
    queryKey: ["/api/admin/workday/micro-resets"],
  });

  const createMutation = useMutation({
    mutationFn: (data: MicroResetFormData) =>
      apiRequest("POST", "/api/admin/workday/micro-resets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workday/micro-resets"] });
      toast({ title: "Micro-reset created successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create micro-reset", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MicroResetFormData> }) =>
      apiRequest("PATCH", `/api/admin/workday/micro-resets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workday/micro-resets"] });
      toast({ title: "Micro-reset updated successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to update micro-reset", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/admin/workday/micro-resets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workday/micro-resets"] });
      toast({ title: "Micro-reset deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete micro-reset", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingId(null);
    setShowForm(false);
    setNewStep("");
  };

  const handleEdit = (item: WorkdayMicroReset) => {
    setFormData({
      name: item.name,
      description: item.description,
      targetArea: item.targetArea,
      duration: item.duration,
      steps: item.steps || [],
      imageUrl: item.imageUrl || "",
      muxPlaybackId: item.muxPlaybackId || "",
      orderIndex: item.orderIndex || 0,
      isActive: item.isActive ?? true,
    });
    setEditingId(item.id);
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

  const addStep = () => {
    if (newStep.trim()) {
      setFormData({ ...formData, steps: [...formData.steps, newStep.trim()] });
      setNewStep("");
    }
  };

  const removeStep = (index: number) => {
    setFormData({
      ...formData,
      steps: formData.steps.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Desk Micro-Resets" onBack={() => navigate("/admin?tab=desk-health")} />
      
      <div className="p-4 pt-16 space-y-4">
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90"
            data-testid="button-add-micro-reset"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Micro-Reset
          </Button>
        )}

        {showForm && (
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">
                {editingId ? "Edit Micro-Reset" : "New Micro-Reset"}
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
                    placeholder="e.g., Neck Rolls"
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
                    placeholder="Brief description of the movement"
                    className="bg-background border-border"
                    required
                    data-testid="input-description"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetArea">Target Area</Label>
                  <Select
                    value={formData.targetArea}
                    onValueChange={(value) => setFormData({ ...formData, targetArea: value })}
                  >
                    <SelectTrigger className="bg-background border-border" data-testid="select-target-area">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {targetAreas.map((area) => (
                        <SelectItem key={area.value} value={area.value}>
                          {area.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (seconds)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 60 })}
                    className="bg-background border-border"
                    data-testid="input-duration"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Steps</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newStep}
                      onChange={(e) => setNewStep(e.target.value)}
                      placeholder="Add a step"
                      className="bg-background border-border"
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addStep())}
                      data-testid="input-new-step"
                    />
                    <Button type="button" onClick={addStep} variant="secondary" data-testid="button-add-step">
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2 mt-2">
                    {formData.steps.map((step, index) => (
                      <div key={index} className="flex items-center gap-2 bg-muted p-2 rounded">
                        <GripVertical className="h-4 w-4 text-gray-500" />
                        <span className="flex-1 text-sm">{index + 1}. {step}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeStep(index)}
                          className="h-6 w-6"
                          data-testid={`button-remove-step-${index}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
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

                <div className="space-y-2">
                  <Label htmlFor="muxPlaybackId">Mux Playback ID *</Label>
                  <Input
                    id="muxPlaybackId"
                    value={formData.muxPlaybackId}
                    onChange={(e) => setFormData({ ...formData, muxPlaybackId: e.target.value })}
                    placeholder="e.g., DS00Spx1CV902MCtPj5WknGlR102V5HFkDe"
                    className="bg-background border-border"
                    data-testid="input-mux-playback-id"
                  />
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
                  {editingId ? "Update Micro-Reset" : "Create Micro-Reset"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : microResets.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No micro-resets yet.</div>
        ) : (
          <div className="space-y-3">
            {microResets.map((item) => (
              <Card
                key={item.id}
                className={`bg-card border-border ${!item.isActive ? "opacity-50" : ""}`}
                data-testid={`card-micro-reset-${item.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{item.name}</h3>
                        <span className="text-xs bg-[#0cc9a9]/20 text-[#0cc9a9] px-2 py-0.5 rounded">
                          {targetAreas.find(a => a.value === item.targetArea)?.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-2">{item.description}</p>
                      <p className="text-xs text-gray-500 mt-1">{item.duration}s</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} data-testid={`button-edit-${item.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(item.id)}
                        className="text-red-400 hover:text-red-300"
                        data-testid={`button-delete-${item.id}`}
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
