import { useState } from "react";
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
import { Plus, Pencil, Trash2, X } from "lucide-react";
import type { MindfulnessTool } from "@shared/schema";

interface MindfulnessFormData {
  title: string;
  description: string;
  category: string;
  duration: number | null;
  instructions: string;
  imageUrl: string;
  orderIndex: number;
  isActive: boolean;
}

const defaultFormData: MindfulnessFormData = {
  title: "",
  description: "",
  category: "breathing",
  duration: null,
  instructions: "",
  imageUrl: "",
  orderIndex: 0,
  isActive: true,
};

const categories = [
  { value: "breathing", label: "Breathing" },
  { value: "meditation", label: "Meditation" },
  { value: "visualization", label: "Visualization" },
  { value: "grounding", label: "Grounding" },
  { value: "journaling", label: "Journaling" },
  { value: "body_scan", label: "Body Scan" },
];

export default function AdminMindfulnessTools() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<MindfulnessFormData>(defaultFormData);

  const { data: tools = [], isLoading } = useQuery<MindfulnessTool[]>({
    queryKey: ["/api/admin/mindfulness"],
  });

  const createMutation = useMutation({
    mutationFn: (data: MindfulnessFormData) =>
      apiRequest("POST", "/api/admin/mindfulness", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mindfulness"] });
      toast({ title: "Mindfulness tool created" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create mindfulness tool", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: MindfulnessFormData }) =>
      apiRequest("PATCH", `/api/admin/mindfulness/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mindfulness"] });
      toast({ title: "Mindfulness tool updated" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to update mindfulness tool", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/admin/mindfulness/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mindfulness"] });
      toast({ title: "Mindfulness tool deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete mindfulness tool", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (tool: MindfulnessTool) => {
    setFormData({
      title: tool.title,
      description: tool.description,
      category: tool.category,
      duration: tool.duration,
      instructions: tool.instructions || "",
      imageUrl: tool.imageUrl || "",
      orderIndex: tool.orderIndex || 0,
      isActive: tool.isActive ?? true,
    });
    setEditingId(tool.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.description || !formData.category) {
      toast({ title: "Please fill in title, description, and category", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getCategoryLabel = (value: string) => {
    return categories.find(c => c.value === value)?.label || value;
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-foreground">Mindfulness Tools</h2>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />Add Tool
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-2 border-primary/30">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{editingId ? "Edit Tool" : "New Mindfulness Tool"}</CardTitle>
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
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Box Breathing"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the tool"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Instructions</Label>
              <Textarea
                value={formData.instructions}
                onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                placeholder="Step-by-step instructions for the user"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={formData.duration ?? ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value ? parseInt(e.target.value) : null }))}
                  placeholder="5"
                />
              </div>
              <div className="space-y-2">
                <Label>Order Index</Label>
                <Input
                  type="number"
                  value={formData.orderIndex}
                  onChange={(e) => setFormData(prev => ({ ...prev, orderIndex: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input
                  value={formData.imageUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                  placeholder="/uploads/images/..."
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
              <Label>Active</Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? "Update Tool" : "Create Tool"}
              </Button>
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tools.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <Card key={tool.id} className={!tool.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">{tool.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-[#0cc9a9]/10 text-[#0cc9a9] font-medium">
                        {getCategoryLabel(tool.category)}
                      </span>
                      {tool.duration && (
                        <span className="text-xs text-muted-foreground">{tool.duration} min</span>
                      )}
                      {!tool.isActive && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-500 font-medium">Inactive</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(tool)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={() => deleteMutation.mutate(tool.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">{tool.description}</p>
                {tool.instructions && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{tool.instructions}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No mindfulness tools created yet. Click "Add Tool" to get started.</p>
        </Card>
      )}
    </div>
  );
}
