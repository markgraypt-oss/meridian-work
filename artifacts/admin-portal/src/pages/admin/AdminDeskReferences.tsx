import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Upload, Trash2, ImageIcon } from "lucide-react";

type Position = "seated" | "standing" | "alternative";

interface RefMap {
  seated: string | null;
  standing: string | null;
  alternative: string | null;
}

const POSITIONS: Array<{ id: Position; label: string; help: string }> = [
  { id: "seated", label: "Seated setup", help: "What a great seated workstation looks like." },
  { id: "standing", label: "Standing setup", help: "What a great standing setup looks like." },
  { id: "alternative", label: "Alternative setup", help: "Lounge, kneeling chair, perch, or other position." },
];

function downscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.onload = () => {
        const MAX = 1600;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width >= height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export default function AdminDeskReferences() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<Position | null>(null);
  const inputs = useRef<Record<Position, HTMLInputElement | null>>({ seated: null, standing: null, alternative: null });

  const { data: refs, isLoading } = useQuery<RefMap>({
    queryKey: ["/api/workday/desk-references"],
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ position, imageBase64 }: { position: Position; imageBase64: string }) => {
      const res = await apiRequest("POST", "/api/admin/workday/desk-references", { position, imageBase64 });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/workday/desk-references"] });
      toast({ title: "Reference photo updated" });
    },
    onError: () => toast({ title: "Couldn't upload that photo", variant: "destructive" }),
    onSettled: () => setBusy(null),
  });

  const deleteMutation = useMutation({
    mutationFn: async (position: Position) => {
      await apiRequest("DELETE", `/api/admin/workday/desk-references/${position}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/workday/desk-references"] });
      toast({ title: "Reverted to default" });
    },
    onError: () => toast({ title: "Couldn't reset that one", variant: "destructive" }),
    onSettled: () => setBusy(null),
  });

  const handlePick = async (position: Position, file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Please choose an image under 8 MB.", variant: "destructive" });
      return;
    }
    try {
      setBusy(position);
      const imageBase64 = await downscale(file);
      uploadMutation.mutate({ position, imageBase64 });
    } catch {
      setBusy(null);
      toast({ title: "Couldn't read that image", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopHeader title="Desk Reference Photos" onBack={() => navigate("/admin")} />
      <main className="px-4 pt-14 pb-4 space-y-4 max-w-2xl mx-auto">
        <Card className="bg-gradient-to-br from-[#0cc9a9]/15 to-[#0cc9a9]/5 border-[#0cc9a9]/30">
          <CardContent className="p-4">
            <h2 className="font-semibold text-foreground mb-1">Choose what users see as the ideal setup</h2>
            <p className="text-sm text-foreground/80">
              These photos appear in the AI Desk Analyzer under "See an ideal setup" for each position. Upload your own to replace the default reference image.
            </p>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[#0cc9a9]" />
          </div>
        ) : (
          POSITIONS.map(({ id, label, help }) => {
            const url = refs?.[id] || null;
            const isBusy = busy === id;
            return (
              <Card key={id} className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base">{label}</CardTitle>
                  <CardDescription>{help}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg overflow-hidden bg-black/40 border border-border min-h-[180px] flex items-center justify-center">
                    {url ? (
                      <img src={url} alt={`Custom ${label}`} className="w-full h-auto max-h-[300px] object-contain" />
                    ) : (
                      <div className="text-center py-10 text-muted-foreground">
                        <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">Using default reference image</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={(el) => { inputs.current[id] = el; }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePick(id, f);
                      e.target.value = "";
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => inputs.current[id]?.click()}
                      disabled={isBusy}
                      className="flex-1 bg-[#0cc9a9] hover:bg-[#0cc9a9]/80 text-black"
                      data-testid={`button-upload-${id}`}
                    >
                      {isBusy ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
                      ) : (
                        <><Upload className="h-4 w-4 mr-2" /> {url ? 'Replace photo' : 'Upload photo'}</>
                      )}
                    </Button>
                    {url && (
                      <Button
                        variant="outline"
                        onClick={() => { setBusy(id); deleteMutation.mutate(id); }}
                        disabled={isBusy}
                        className="border-red-500/40 text-red-400 hover:bg-red-500/10"
                        data-testid={`button-reset-${id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-1.5" /> Reset
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}
