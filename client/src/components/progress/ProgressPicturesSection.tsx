import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProgressPicture {
  id: number;
  date: string;
  imageUrl: string;
  category: string | null;
  notes: string | null;
}

export function ProgressPicturesSection() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newCategory, setNewCategory] = useState("front");
  const [newNotes, setNewNotes] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [compareImages, setCompareImages] = useState<[ProgressPicture | null, ProgressPicture | null]>([null, null]);
  const [selectedImage, setSelectedImage] = useState<ProgressPicture | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: pictures, isLoading } = useQuery<ProgressPicture[]>({
    queryKey: ["/api/progress/pictures"],
  });

  const addMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/progress/pictures", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to upload");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress/pictures"] });
      setIsAddOpen(false);
      setSelectedFile(null);
      setNewNotes("");
      toast({ title: "Photo uploaded" });
    },
    onError: () => {
      toast({ title: "Failed to upload photo", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/progress/pictures/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress/pictures"] });
      toast({ title: "Photo deleted" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("date", newDate);
    formData.append("category", newCategory);
    if (newNotes) formData.append("notes", newNotes);
    addMutation.mutate(formData);
  };

  const toggleCompare = (picture: ProgressPicture) => {
    if (compareImages[0]?.id === picture.id) {
      setCompareImages([null, compareImages[1]]);
    } else if (compareImages[1]?.id === picture.id) {
      setCompareImages([compareImages[0], null]);
    } else if (!compareImages[0]) {
      setCompareImages([picture, compareImages[1]]);
    } else if (!compareImages[1]) {
      setCompareImages([compareImages[0], picture]);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      </div>
    );
  }

  const sortedPictures = pictures 
    ? [...pictures].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  const groupedByCategory = {
    front: sortedPictures.filter(p => p.category === "front"),
    side: sortedPictures.filter(p => p.category === "side"),
    back: sortedPictures.filter(p => p.category === "back"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Progress Pictures</h3>
        <div className="flex gap-2">
          {sortedPictures.length >= 2 && (
            <Button 
              variant={compareMode ? "default" : "outline"} 
              size="sm"
              onClick={() => {
                setCompareMode(!compareMode);
                setCompareImages([null, null]);
              }}
              data-testid="button-compare-mode"
            >
              Compare
            </Button>
          )}
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-[#0cc9a9] hover:bg-[#0cc9a9]/90" data-testid="button-add-photo">
                <Plus className="w-4 h-4 mr-1" />
                Add Photo
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Add Progress Photo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-[#0cc9a9] transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {selectedFile ? (
                    <div className="space-y-2">
                      <img 
                        src={URL.createObjectURL(selectedFile)} 
                        alt="Preview" 
                        className="max-h-48 mx-auto rounded-lg"
                      />
                      <p className="text-sm text-muted-foreground">{selectedFile.name}</p>
                    </div>
                  ) : (
                    <>
                      <Camera className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">Click to select a photo</p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                    data-testid="input-photo-file"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    data-testid="input-photo-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger data-testid="select-photo-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="front">Front</SelectItem>
                      <SelectItem value="side">Side</SelectItem>
                      <SelectItem value="back">Back</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Week 4, morning, etc."
                    data-testid="input-photo-notes"
                  />
                </div>
                <Button 
                  onClick={handleUpload} 
                  className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90"
                  disabled={!selectedFile || addMutation.isPending}
                  data-testid="button-upload-photo"
                >
                  {addMutation.isPending ? "Uploading..." : "Upload Photo"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {compareMode && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Compare Photos</CardTitle>
            <p className="text-sm text-muted-foreground">Select two photos to compare</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {[0, 1].map((index) => (
                <div key={index} className="aspect-square bg-muted/30 rounded-lg flex items-center justify-center">
                  {compareImages[index] ? (
                    <div className="relative w-full h-full">
                      <img 
                        src={compareImages[index]!.imageUrl} 
                        alt={`Compare ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        {format(new Date(compareImages[index]!.date), "dd MMM yyyy")}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70"
                        onClick={() => {
                          const newImages = [...compareImages] as [ProgressPicture | null, ProgressPicture | null];
                          newImages[index] = null;
                          setCompareImages(newImages);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Select photo {index + 1}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {sortedPictures.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <Camera className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Progress Pictures</h3>
            <p className="text-muted-foreground">Take photos to track your visual progress over time.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {sortedPictures.map((picture) => (
              <div 
                key={picture.id} 
                className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer group ${
                  compareMode && (compareImages[0]?.id === picture.id || compareImages[1]?.id === picture.id)
                    ? 'ring-2 ring-[#0cc9a9]'
                    : ''
                }`}
                onClick={() => compareMode ? toggleCompare(picture) : setSelectedImage(picture)}
                data-testid={`photo-${picture.id}`}
              >
                <img 
                  src={picture.imageUrl} 
                  alt={`Progress ${format(new Date(picture.date), "dd MMM yyyy")}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <p className="text-white text-xs">{format(new Date(picture.date), "dd MMM")}</p>
                  {picture.category && (
                    <p className="text-white/70 text-xs capitalize">{picture.category}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="bg-card border-border max-w-2xl">
          {selectedImage && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {format(new Date(selectedImage.date), "dd MMMM yyyy")}
                  {selectedImage.category && ` - ${selectedImage.category.charAt(0).toUpperCase() + selectedImage.category.slice(1)}`}
                </DialogTitle>
              </DialogHeader>
              <div className="relative">
                <img 
                  src={selectedImage.imageUrl} 
                  alt="Progress"
                  className="w-full rounded-lg"
                />
                {selectedImage.notes && (
                  <p className="mt-2 text-sm text-muted-foreground">{selectedImage.notes}</p>
                )}
              </div>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => {
                  deleteMutation.mutate(selectedImage.id);
                  setSelectedImage(null);
                }}
                data-testid="button-delete-photo"
              >
                Delete Photo
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
