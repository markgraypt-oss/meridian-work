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
import type { WorkdayAchesFix } from "@shared/schema";

interface AchesFixFormData {
  issueType: string;
  title: string;
  description: string;
  contributors: string[];
  setupFactors: string[];
  positionChanges: string[];
  movementOptions: string[];
  imageUrl: string;
  orderIndex: number;
  isActive: boolean;
}

const defaultFormData: AchesFixFormData = {
  issueType: "lower_back",
  title: "",
  description: "",
  contributors: [],
  setupFactors: [],
  positionChanges: [],
  movementOptions: [],
  imageUrl: "",
  orderIndex: 0,
  isActive: true,
};

const issueTypes = [
  { value: "lower_back", label: "Lower Back" },
  { value: "neck", label: "Neck" },
  { value: "shoulder", label: "Shoulder" },
  { value: "wrist", label: "Wrist" },
  { value: "hip", label: "Hip" },
];

export default function AdminWorkdayAchesFixes() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<AchesFixFormData>(defaultFormData);
  const [newContributor, setNewContributor] = useState("");
  const [newSetupFactor, setNewSetupFactor] = useState("");
  const [newPositionChange, setNewPositionChange] = useState("");
  const [newMovementOption, setNewMovementOption] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: achesFixes = [], isLoading } = useQuery<WorkdayAchesFix[]>({
    queryKey: ["/api/admin/workday/aches-fixes"],
  });

  const createMutation = useMutation({
    mutationFn: (data: AchesFixFormData) =>
      apiRequest("POST", "/api/admin/workday/aches-fixes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workday/aches-fixes"] });
      toast({ title: "Aches & fix created successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create aches & fix", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AchesFixFormData> }) =>
      apiRequest("PATCH", `/api/admin/workday/aches-fixes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workday/aches-fixes"] });
      toast({ title: "Aches & fix updated successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to update aches & fix", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/admin/workday/aches-fixes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workday/aches-fixes"] });
      toast({ title: "Aches & fix deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete aches & fix", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (item: WorkdayAchesFix) => {
    setFormData({
      issueType: item.issueType,
      title: item.title,
      description: item.description,
      contributors: item.contributors || [],
      setupFactors: item.setupFactors || [],
      positionChanges: item.positionChanges || [],
      movementOptions: item.movementOptions || [],
      imageUrl: item.imageUrl || "",
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

  const addToArray = (field: keyof AchesFixFormData, value: string, setter: (v: string) => void) => {
    if (value.trim()) {
      setFormData({ ...formData, [field]: [...(formData[field] as string[]), value.trim()] });
      setter("");
    }
  };

  const removeFromArray = (field: keyof AchesFixFormData, index: number) => {
    setFormData({
      ...formData,
      [field]: (formData[field] as string[]).filter((_, i) => i !== index),
    });
  };

  const ArrayInput = ({
    label,
    field,
    value,
    setValue,
    placeholder,
  }: {
    label: string;
    field: keyof AchesFixFormData;
    value: string;
    setValue: (v: string) => void;
    placeholder: string;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="bg-background border-border"
          onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addToArray(field, value, setValue))}
        />
        <Button type="button" onClick={() => addToArray(field, value, setValue)} variant="secondary">
          Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {(formData[field] as string[]).map((item, index) => (
          <span key={index} className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm">
            {item}
            <button type="button" onClick={() => removeFromArray(field, index)} className="text-gray-400 hover:text-white">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Desk Aches & Fixes" onBack={() => navigate("/admin?tab=desk-health")} />
      
      <div className="p-4 pt-16 space-y-4">
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90"
            data-testid="button-add-aches-fix"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Aches & Fix
          </Button>
        )}

        {showForm && (
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">
                {editingId ? "Edit Aches & Fix" : "New Aches & Fix"}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={resetForm} data-testid="button-close-form">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="issueType">Issue Type</Label>
                  <Select
                    value={formData.issueType}
                    onValueChange={(value) => setFormData({ ...formData, issueType: value })}
                  >
                    <SelectTrigger className="bg-background border-border" data-testid="select-issue-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {issueTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Lower Back Stiffness"
                    className="bg-background border-border"
                    required
                    data-testid="input-title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the issue"
                    className="bg-background border-border"
                    required
                    data-testid="input-description"
                  />
                </div>

                <ArrayInput
                  label="Contributors"
                  field="contributors"
                  value={newContributor}
                  setValue={setNewContributor}
                  placeholder="Likely desk-related contributor"
                />

                <ArrayInput
                  label="Setup Factors"
                  field="setupFactors"
                  value={newSetupFactor}
                  setValue={setNewSetupFactor}
                  placeholder="Setup factor that may help"
                />

                <ArrayInput
                  label="Position Changes"
                  field="positionChanges"
                  value={newPositionChange}
                  setValue={setNewPositionChange}
                  placeholder="Position change that may help"
                />

                <ArrayInput
                  label="Movement Options"
                  field="movementOptions"
                  value={newMovementOption}
                  setValue={setNewMovementOption}
                  placeholder="Movement-based option"
                />

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
                  {editingId ? "Update" : "Create"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : achesFixes.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No aches & fixes yet.</div>
        ) : (
          <div className="space-y-3">
            {achesFixes.map((item) => (
              <Card
                key={item.id}
                className={`bg-card border-border ${!item.isActive ? "opacity-50" : ""}`}
                data-testid={`card-aches-fix-${item.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.title} className="w-16 h-16 object-cover rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{item.title}</h3>
                        <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
                          {issueTypes.find(t => t.value === item.issueType)?.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-2">{item.description}</p>
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
