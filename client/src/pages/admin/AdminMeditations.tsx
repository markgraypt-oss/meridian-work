import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, X, Music, Loader2, Check, Image as ImageIcon } from "lucide-react";
import { uploadAudioFile, uploadErrorMessage } from "@/lib/uploadAudio";
import { uploadImageFile } from "@/lib/uploadImage";
import type { Meditation } from "@shared/schema";

interface MeditationFormData {
  title: string;
  description: string;
  category: string;
  durationMin: number | null;
  audioUrl: string;
  coverImageUrl: string;
  tags: string;
  orderIndex: number;
  isActive: boolean;
}

const defaultFormData: MeditationFormData = {
  title: "",
  description: "",
  category: "Relaxation",
  durationMin: null,
  audioUrl: "",
  coverImageUrl: "",
  tags: "",
  orderIndex: 0,
  isActive: true,
};

// Keep in sync with meditationCategories in client/src/lib/meditation-data.ts
const categories = ["Focus", "Relaxation", "Awareness", "Sleep", "Emotional"];

export default function AdminMeditations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<MeditationFormData>(defaultFormData);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const { data: meditations = [], isLoading } = useQuery<Meditation[]>({
    queryKey: ["/api/admin/meditations"],
  });

  const buildPayload = (data: MeditationFormData) => ({
    title: data.title.trim(),
    category: data.category,
    durationMin: Number(data.durationMin) || 0,
    description: data.description.trim() || null,
    audioUrl: data.audioUrl.trim() || null,
    coverImageUrl: data.coverImageUrl.trim() || null,
    tags: data.tags.split(",").map((t) => t.trim()).filter(Boolean),
    orderIndex: Number(data.orderIndex) || 0,
    isActive: data.isActive,
  });

  const createMutation = useMutation({
    mutationFn: (data: MeditationFormData) =>
      apiRequest("POST", "/api/admin/meditations", buildPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/meditations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meditations"] });
      toast({ title: "Meditation created" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create meditation", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: MeditationFormData }) =>
      apiRequest("PATCH", `/api/admin/meditations/${id}`, buildPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/meditations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meditations"] });
      toast({ title: "Meditation updated" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to update meditation", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/meditations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/meditations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meditations"] });
      toast({ title: "Meditation deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete meditation", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingId(null);
    setShowForm(false);
    setUploadPct(0);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsCoverUploading(false);
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const handleEdit = (m: Meditation) => {
    setFormData({
      title: m.title,
      description: m.description || "",
      category: m.category,
      durationMin: m.durationMin,
      audioUrl: m.audioUrl || "",
      coverImageUrl: m.coverImageUrl || "",
      tags: (m.tags || []).join(", "),
      orderIndex: m.orderIndex || 0,
      isActive: m.isActive ?? true,
    });
    setEditingId(m.id);
    setShowForm(true);
  };

  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadPct(0);
    try {
      const objectPath = await uploadAudioFile(file, {
        visibility: "public",
        onProgress: setUploadPct,
      });
      setFormData((prev) => ({ ...prev, audioUrl: objectPath }));
      toast({ title: "Audio uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", description: uploadErrorMessage(err), variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCoverUploading(true);
    try {
      const objectPath = await uploadImageFile(file, { visibility: "public" });
      setFormData((prev) => ({ ...prev, coverImageUrl: objectPath }));
      toast({ title: "Cover uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", description: uploadErrorMessage(err), variant: "destructive" });
    } finally {
      setIsCoverUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.category || !formData.durationMin) {
      toast({ title: "Please fill in title, category, and duration", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-foreground">Meditations</h2>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />Add Meditation
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-2 border-primary/30">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{editingId ? "Edit Meditation" : "New Meditation"}</CardTitle>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Wind Down"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData((prev) => ({ ...prev, category: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Short description shown to the user"
                rows={2}
              />
            </div>

            {/* Audio upload */}
            <div className="space-y-2">
              <Label>Audio file</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg"
                className="hidden"
                onChange={handleAudioSelect}
              />
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading {uploadPct}%</>
                  ) : (
                    <><Music className="h-4 w-4 mr-2" />{formData.audioUrl ? "Replace audio" : "Upload audio"}</>
                  )}
                </Button>
                {formData.audioUrl && !isUploading && (
                  <span className="flex items-center text-sm text-[#0cc9a9]">
                    <Check className="h-4 w-4 mr-1" />Audio attached
                  </span>
                )}
              </div>
              {formData.audioUrl && !isUploading && (
                <audio controls src={formData.audioUrl} className="w-full mt-2" />
              )}
              <p className="text-xs text-muted-foreground">
                mp3, m4a, wav, aac or ogg (up to 200MB). Uploaded to secure storage; no audio means the player falls back to a silent timer.
              </p>
            </div>

            {/* Cover image (optional — overrides the category orb in the app) */}
            <div className="space-y-2">
              <Label>Cover image (optional)</Label>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverSelect}
              />
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={isCoverUploading}
                >
                  {isCoverUploading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</>
                  ) : (
                    <><ImageIcon className="h-4 w-4 mr-2" />{formData.coverImageUrl ? "Replace cover" : "Upload cover"}</>
                  )}
                </Button>
                {formData.coverImageUrl && !isCoverUploading && (
                  <img src={formData.coverImageUrl} alt="cover" className="h-12 w-12 rounded-lg object-cover border border-border" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Optional. A square image works best. If left empty, the app shows a designed cover based on the category.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={formData.durationMin ?? ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, durationMin: e.target.value ? parseInt(e.target.value) : null }))}
                  placeholder="10"
                />
              </div>
              <div className="space-y-2">
                <Label>Order Index</Label>
                <Input
                  type="number"
                  value={formData.orderIndex}
                  onChange={(e) => setFormData((prev) => ({ ...prev, orderIndex: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
                  placeholder="sleep, evening"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
              />
              <Label>Active</Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending || isUploading}
              >
                {editingId ? "Update Meditation" : "Create Meditation"}
              </Button>
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {meditations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {meditations.map((m) => (
            <Card key={m.id} className={!m.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">{m.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded bg-[#0cc9a9]/10 text-[#0cc9a9] font-medium">
                        {m.category}
                      </span>
                      <span className="text-xs text-muted-foreground">{m.durationMin} min</span>
                      {m.audioUrl ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-[#0cc9a9]/10 text-[#0cc9a9] font-medium flex items-center gap-1">
                          <Music className="h-3 w-3" />Audio
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium">No audio</span>
                      )}
                      {!m.isActive && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-500 font-medium">Inactive</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(m)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={() => {
                        if (confirm(`Delete "${m.title}"? This cannot be undone.`)) deleteMutation.mutate(m.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {m.description && <p className="text-sm text-muted-foreground line-clamp-2">{m.description}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No meditations yet. Click "Add Meditation" to create one and upload its audio.</p>
        </Card>
      )}
    </div>
  );
}
