import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { uploadImageFile, uploadErrorMessage } from "@/lib/uploadImage";
import { useToast } from "@/hooks/use-toast";
import TopHeader from "@/components/TopHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import type { WorkdayDeskSetup } from "@shared/schema";

interface DeskSetupFormData {
  title: string;
  description: string;
  deskType: string;
  positionType: string;
  viewAngle: string;
  aspectRatio: string;
  muxPlaybackId: string;
  imageUrl: string;
  keyAdjustments: string[];
  orderIndex: number;
  isActive: boolean;
}

const defaultFormData: DeskSetupFormData = {
  title: "",
  description: "",
  deskType: "any",
  positionType: "any",
  viewAngle: "side",
  aspectRatio: "4:5",
  muxPlaybackId: "",
  imageUrl: "",
  keyAdjustments: [],
  orderIndex: 0,
  isActive: true,
};

const deskTypes = [
  { value: "any", label: "Any desk" },
  { value: "fixed", label: "Fixed height" },
  { value: "adjustable", label: "Height adjustable" },
  { value: "laptop", label: "Laptop / travel" },
];

const positionTypes = [
  { value: "any", label: "Any position" },
  { value: "seated", label: "Seated" },
  { value: "standing", label: "Standing" },
];

// The angle decides the shape of the shot, so the two selects sit next to each
// other and the ratio hint changes with the angle.
const viewAngles = [
  { value: "side", label: "Side on", hint: "Best at 4:5 — the body is a tall subject" },
  { value: "overhead", label: "Overhead", hint: "Best at 16:9 or 1:1 — a desk is a wide subject" },
  { value: "close", label: "Close up", hint: "Best at 1:1 — hands and a keyboard, tight" },
];

const aspectRatios = [
  { value: "4:5", label: "4:5 — portrait (side on)" },
  { value: "1:1", label: "1:1 — square (close up)" },
  { value: "16:9", label: "16:9 — landscape (overhead)" },
  { value: "3:4", label: "3:4 — portrait, softer" },
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

  const KEY = "/api/admin/workday/desk-setups";

  const { data: setups = [], isLoading } = useQuery<WorkdayDeskSetup[]>({ queryKey: [KEY] });

  const createMutation = useMutation({
    mutationFn: (data: DeskSetupFormData) => apiRequest("POST", KEY, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      toast({ title: "Desk setup created" });
      resetForm();
    },
    onError: () => toast({ title: "Failed to create desk setup", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DeskSetupFormData> }) =>
      apiRequest("PATCH", `${KEY}/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      toast({ title: "Desk setup updated" });
      resetForm();
    },
    onError: () => toast({ title: "Failed to update desk setup", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `${KEY}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      toast({ title: "Desk setup deleted" });
    },
    onError: () => toast({ title: "Failed to delete desk setup", variant: "destructive" }),
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
      description: item.description || "",
      deskType: item.deskType || "any",
      positionType: item.positionType || "any",
      viewAngle: (item as any).viewAngle || "side",
      aspectRatio: (item as any).aspectRatio || "4:5",
      muxPlaybackId: (item as any).muxPlaybackId || "",
      imageUrl: item.imageUrl || "",
      keyAdjustments: item.keyAdjustments || [],
      orderIndex: item.orderIndex || 0,
      isActive: item.isActive ?? true,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) updateMutation.mutate({ id: editingId, data: formData });
    else createMutation.mutate(formData);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploadingImage(true);
      const objectPath = await uploadImageFile(file, { visibility: "public" });
      setFormData(prev => ({ ...prev, imageUrl: objectPath }));
      toast({ title: "Image uploaded" });
    } catch (error) {
      toast({ title: "Upload failed", description: uploadErrorMessage(error), variant: "destructive" });
    } finally {
      setUploadingImage(false);
      event.target.value = "";
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

  const angleHint = viewAngles.find(a => a.value === formData.viewAngle)?.hint;

  return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Desk Setups" onBack={() => navigate("/admin?tab=desk-health")} />

      <div className="p-4 pt-16 space-y-4">
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="w-full" data-testid="button-add-desk-setup">
            <Plus className="w-4 h-4 mr-2" /> Add desk setup
          </Button>
        )}

        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Monitor height and distance"
                    required
                    className="bg-background border-border"
                    data-testid="input-title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What this fixes, and why it matters"
                    className="bg-background border-border"
                    data-testid="input-description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="viewAngle">Camera angle</Label>
                    <Select
                      value={formData.viewAngle}
                      onValueChange={(value) => setFormData({ ...formData, viewAngle: value })}
                    >
                      <SelectTrigger id="viewAngle" className="bg-background border-border" data-testid="select-view-angle">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {viewAngles.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="aspectRatio">Aspect ratio</Label>
                    <Select
                      value={formData.aspectRatio}
                      onValueChange={(value) => setFormData({ ...formData, aspectRatio: value })}
                    >
                      <SelectTrigger id="aspectRatio" className="bg-background border-border" data-testid="select-aspect-ratio">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {aspectRatios.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {angleHint && <p className="text-xs text-muted-foreground -mt-2">{angleHint}</p>}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="deskType">Desk type</Label>
                    <Select
                      value={formData.deskType}
                      onValueChange={(value) => setFormData({ ...formData, deskType: value })}
                    >
                      <SelectTrigger id="deskType" className="bg-background border-border" data-testid="select-desk-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {deskTypes.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="positionType">Position</Label>
                    <Select
                      value={formData.positionType}
                      onValueChange={(value) => setFormData({ ...formData, positionType: value })}
                    >
                      <SelectTrigger id="positionType" className="bg-background border-border" data-testid="select-position-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {positionTypes.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="muxPlaybackId">Mux Playback ID</Label>
                  <p className="text-xs text-muted-foreground">
                    The demonstration. When set it plays instead of the image, muted and looping,
                    at the aspect ratio chosen above — so upload the video in that same ratio.
                  </p>
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
                  <Label htmlFor="imageUrl">Image (optional)</Label>
                  <p className="text-xs text-muted-foreground">
                    Fallback for setups without a video. A setup with a video needs no image —
                    the list uses the video's own poster frame.
                  </p>
                  {formData.imageUrl ? (
                    <div className="flex items-center gap-3">
                      <img src={formData.imageUrl} alt="" className="w-32 h-24 object-cover rounded-lg border border-border" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, imageUrl: "" }))}
                        data-testid="button-remove-image"
                      >
                        <X className="w-4 h-4 mr-1" /> Remove
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-48 h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                      <Plus className="w-5 h-5 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">
                        {uploadingImage ? "Uploading..." : "Upload image"}
                      </span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Key adjustments</Label>
                  <p className="text-xs text-muted-foreground">
                    The checklist under the video. One instruction per line, in the order someone
                    would actually do them — work from the ground up.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={newAdjustment}
                      onChange={(e) => setNewAdjustment(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAdjustment(); } }}
                      placeholder="Add an adjustment"
                      className="bg-background border-border"
                      data-testid="input-new-adjustment"
                    />
                    <Button type="button" onClick={addAdjustment} variant="secondary" data-testid="button-add-adjustment">
                      Add
                    </Button>
                  </div>
                  {formData.keyAdjustments.length > 0 && (
                    <ul className="space-y-1.5 pt-1">
                      {formData.keyAdjustments.map((adj, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-muted-foreground tabular-nums pt-0.5">{i + 1}.</span>
                          <span className="flex-1">{adj}</span>
                          <button
                            type="button"
                            onClick={() => removeAdjustment(i)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Remove adjustment"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="orderIndex">Order index</Label>
                    <Input
                      id="orderIndex"
                      type="number"
                      value={formData.orderIndex}
                      onChange={(e) => setFormData({ ...formData, orderIndex: parseInt(e.target.value) || 0 })}
                      className="bg-background border-border"
                      data-testid="input-order-index"
                    />
                  </div>
                  <div className="flex items-center gap-2 pb-2">
                    <Switch
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                      data-testid="switch-is-active"
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1" data-testid="button-save-desk-setup">
                    {editingId ? "Save changes" : "Create desk setup"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm} data-testid="button-cancel">
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : setups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No desk setups yet. Add the first one above.
          </p>
        ) : (
          <div className="space-y-2">
            {setups.map((item) => (
              <Card key={item.id} className={item.isActive ? "" : "opacity-60"}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {(item as any).viewAngle || "side"} · {(item as any).aspectRatio || "4:5"}
                      {(item as any).muxPlaybackId ? " · video" : item.imageUrl ? " · image" : " · no media"}
                      {item.isActive ? "" : " · hidden"}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(item)} data-testid={`button-edit-${item.id}`}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(item.id)}
                    data-testid={`button-delete-${item.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
