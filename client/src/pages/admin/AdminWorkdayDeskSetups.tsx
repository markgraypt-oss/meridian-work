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
import { Plus, Pencil, Trash2, X } from "lucide-react";
import type { WorkdayDeskSetup } from "@shared/schema";

interface DeskSetupFormData {
  title: string;
  deskType: string;
  positionType: string;
  description: string;
  imageUrl: string;
  keyAdjustments: string[];
  orderIndex: number;
  isActive: boolean;
}

const defaultFormData: DeskSetupFormData = {
  title: "",
  deskType: "fixed",
  positionType: "seated",
  description: "",
  imageUrl: "",
  keyAdjustments: [],
  orderIndex: 0,
  isActive: true,
};

const deskTypes = [
  { value: "fixed", label: "Fixed Desk" },
  { value: "sit_stand", label: "Sit-Stand Desk" },
  { value: "laptop_only", label: "Laptop Only" },
  { value: "external_monitor", label: "External Monitor" },
  { value: "dual_monitor", label: "Dual Monitor" },
];

const positionTypes = [
  { value: "seated", label: "Seated" },
  { value: "standing", label: "Standing" },
  { value: "alternative", label: "Alternative" },
];

export default function AdminWorkdayDeskSetups() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<DeskSetupFormData>(defaultFormData);
  const [newAdjustment, setNewAdjustment] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: deskSetups = [], isLoading } = useQuery<WorkdayDeskSetup[]>({
    queryKey: ["/api/admin/workday/desk-setups"],
  });

  const createMutation = useMutation({
    mutationFn: (data: DeskSetupFormData) =>
      apiRequest("POST", "/api/admin/workday/desk-setups", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workday/desk-setups"] });
      toast({ title: "Desk setup created successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create desk setup", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DeskSetupFormData> }) =>
      apiRequest("PATCH", `/api/admin/workday/desk-setups/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workday/desk-setups"] });
      toast({ title: "Desk setup updated successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to update desk setup", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/admin/workday/desk-setups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workday/desk-setups"] });
      toast({ title: "Desk setup deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete desk setup", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingId(null);
    setShowForm(false);
    setNewAdjustment("");
  };

  const handleEdit = (item: WorkdayDeskSetup) => {
    setFormData({
      title: item.title,
      deskType: item.deskType,
      positionType: item.positionType,
      description: item.description || "",
      imageUrl: item.imageUrl,
      keyAdjustments: item.keyAdjustments || [],
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

  const addAdjustment = () => {
    if (newAdjustment.trim()) {
      setFormData({ ...formData, keyAdjustments: [...formData.keyAdjustments, newAdjustment.trim()] });
      setNewAdjustment("");
    }
  };

  const removeAdjustment = (index: number) => {
    setFormData({
      ...formData,
      keyAdjustments: formData.keyAdjustments.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Desk Setup Gallery" onBack={() => navigate("/admin?tab=desk-health")} />
      
      <div className="p-4 pt-16 space-y-4">
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90"
            data-testid="button-add-desk-setup"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Desk Setup
          </Button>
        )}

        {showForm && (
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">
                {editingId ? "Edit Desk Setup" : "New Desk Setup"}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={resetForm} data-testid="button-close-form">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Seated Desk Setup"
                    className="bg-background border-border"
                    required
                    data-testid="input-title"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deskType">Desk Type</Label>
                    <Select
                      value={formData.deskType}
                      onValueChange={(value) => setFormData({ ...formData, deskType: value })}
                    >
                      <SelectTrigger className="bg-background border-border" data-testid="select-desk-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {deskTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="positionType">Position Type</Label>
                    <Select
                      value={formData.positionType}
                      onValueChange={(value) => setFormData({ ...formData, positionType: value })}
                    >
                      <SelectTrigger className="bg-background border-border" data-testid="select-position-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {positionTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description"
                    className="bg-background border-border"
                    data-testid="input-description"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="imageUrl">Image (required)</Label>
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
                  <Label>Key Adjustments</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newAdjustment}
                      onChange={(e) => setNewAdjustment(e.target.value)}
                      placeholder="Add adjustment tip"
                      className="bg-background border-border"
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addAdjustment())}
                      data-testid="input-new-adjustment"
                    />
                    <Button type="button" onClick={addAdjustment} variant="secondary" data-testid="button-add-adjustment">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.keyAdjustments.map((adj, index) => (
                      <span key={index} className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm">
                        {adj}
                        <button
                          type="button"
                          onClick={() => removeAdjustment(index)}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
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
                  {editingId ? "Update Desk Setup" : "Create Desk Setup"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : deskSetups.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No desk setups yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {deskSetups.map((item) => (
              <Card
                key={item.id}
                className={`bg-card border-border overflow-hidden ${!item.isActive ? "opacity-50" : ""}`}
                data-testid={`card-desk-setup-${item.id}`}
              >
                <div className="relative">
                  <img src={item.imageUrl} alt={item.title} className="w-full h-32 object-cover" />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 bg-black/50 hover:bg-black/70"
                      onClick={() => handleEdit(item)}
                      data-testid={`button-edit-${item.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 bg-black/50 hover:bg-red-500/70"
                      onClick={() => deleteMutation.mutate(item.id)}
                      data-testid={`button-delete-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-3">
                  <h3 className="font-semibold text-white text-sm">{item.title}</h3>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs bg-[#0cc9a9]/20 text-[#0cc9a9] px-2 py-0.5 rounded">
                      {deskTypes.find(t => t.value === item.deskType)?.label}
                    </span>
                    <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                      {positionTypes.find(t => t.value === item.positionType)?.label}
                    </span>
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
