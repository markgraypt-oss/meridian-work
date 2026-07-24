import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X, Camera, MoreVertical, ChevronDown, Download } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type PhotoCategory = "front" | "side" | "back";

interface PhotoSet {
  photoSetId: string;
  date: string;
  photos: {
    id: number;
    category: PhotoCategory;
    imageUrl: string;
  }[];
}

const poseLabels: Record<PhotoCategory, string> = {
  front: "Front",
  side: "Side",
  back: "Back",
};

const poseInstructions: Record<PhotoCategory, { label: string; eyeGuide: string; hipGuide: string }> = {
  front: { label: "Front", eyeGuide: "Eyes", hipGuide: "Hip" },
  side: { label: "Side", eyeGuide: "Eyes", hipGuide: "Hip" },
  back: { label: "Back", eyeGuide: "Ears", hipGuide: "Hip" },
};

export default function ProgressPhotosPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { formatDate } = useFormattedDate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Check for date query parameter and source page
  const urlParams = new URLSearchParams(window.location.search);
  const dateParam = urlParams.get('date');
  const fromParam = urlParams.get('from');
  const initialDate = dateParam || format(new Date(), "yyyy-MM-dd");
  
  const [showInstructions, setShowInstructions] = useState(false);
  const [showCaptureFlow, setShowCaptureFlow] = useState(false);
  const [currentPose, setCurrentPose] = useState<PhotoCategory>("front");
  const [captureDate, setCaptureDate] = useState(initialDate);
  const [currentPhotoSetId, setCurrentPhotoSetId] = useState<string>("");
  const [capturedPhotos, setCapturedPhotos] = useState<Record<PhotoCategory, string | null>>({
    front: null,
    side: null,
    back: null,
  });
  const [viewingPhotoSet, setViewingPhotoSet] = useState<PhotoSet | null>(null);
  const [viewingCategory, setViewingCategory] = useState<PhotoCategory>("front");
  const [showAngleDropdown, setShowAngleDropdown] = useState(false);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [showExistingPhotosDialog, setShowExistingPhotosDialog] = useState(false);
  const [pendingCaptureDate, setPendingCaptureDate] = useState<string>("");
  const [existingPhotoSetForDate, setExistingPhotoSetForDate] = useState<PhotoSet | null>(null);
  
  const { data: photoSets = [], isLoading } = useQuery<PhotoSet[]>({
    queryKey: ["/api/progress/pictures"],
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ category, imageData }: { category: PhotoCategory; imageData: string }) => {
      return apiRequest("POST", "/api/progress/pictures", {
        date: new Date(captureDate).toISOString(),
        photoSetId: currentPhotoSetId,
        imageUrl: imageData,
        category,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress/pictures"] });
    },
    onError: () => {
      toast({ title: "Failed to upload photo", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/progress/pictures/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress/pictures"] });
      toast({ title: "Photo deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete photo", variant: "destructive" });
    },
  });

  const findExistingSetForDate = (dateStr: string) => {
    const targetDate = format(new Date(dateStr), "yyyy-MM-dd");
    return photoSets.find(set => {
      const setDate = format(parseISO(set.date), "yyyy-MM-dd");
      return setDate === targetDate;
    });
  };

  const handleStartCapture = () => {
    setShowInstructions(false);
    localStorage.setItem("progress-photos-instructions-seen", "true");
    
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const existingSet = findExistingSetForDate(todayStr);
    
    if (existingSet) {
      setPendingCaptureDate(todayStr);
      setExistingPhotoSetForDate(existingSet);
      setShowExistingPhotosDialog(true);
    } else {
      setCurrentPhotoSetId(`set-${Date.now()}`);
      setCapturedPhotos({ front: null, side: null, back: null });
      setCurrentPose("front");
      setCaptureDate(todayStr);
      setShowCaptureFlow(true);
    }
  };

  const handleAddToExisting = () => {
    if (!existingPhotoSetForDate) return;
    setCurrentPhotoSetId(existingPhotoSetForDate.photoSetId);
    const existingCategories = existingPhotoSetForDate.photos.map(p => p.category);
    setCapturedPhotos({
      front: existingCategories.includes("front") ? "existing" : null,
      side: existingCategories.includes("side") ? "existing" : null,
      back: existingCategories.includes("back") ? "existing" : null,
    });
    // Start with first missing pose
    if (!existingCategories.includes("front")) {
      setCurrentPose("front");
    } else if (!existingCategories.includes("side")) {
      setCurrentPose("side");
    } else if (!existingCategories.includes("back")) {
      setCurrentPose("back");
    } else {
      toast({ title: "All angles already have photos for this date" });
      setShowExistingPhotosDialog(false);
      return;
    }
    setCaptureDate(pendingCaptureDate);
    setShowExistingPhotosDialog(false);
    setShowCaptureFlow(true);
  };

  const handleReplaceExisting = async () => {
    if (!existingPhotoSetForDate) return;
    // Delete all existing photos for this date
    for (const photo of existingPhotoSetForDate.photos) {
      await deleteMutation.mutateAsync(photo.id);
    }
    setCurrentPhotoSetId(`set-${Date.now()}`);
    setCapturedPhotos({ front: null, side: null, back: null });
    setCurrentPose("front");
    setCaptureDate(pendingCaptureDate);
    setShowExistingPhotosDialog(false);
    setShowCaptureFlow(true);
  };

  const handleDismissInstructions = () => {
    localStorage.setItem("progress-photos-instructions-seen", "true");
    setShowInstructions(false);
  };

  const handlePickPhoto = () => {
    fileInputRef.current?.click();
  };

  const getNextMissingPose = (afterPose: PhotoCategory, photos: Record<PhotoCategory, string | null>): PhotoCategory | null => {
    const poses: PhotoCategory[] = ["front", "side", "back"];
    const startIndex = poses.indexOf(afterPose);
    for (let i = startIndex + 1; i < poses.length; i++) {
      if (!photos[poses[i]] || photos[poses[i]] === null) {
        return poses[i];
      }
    }
    return null;
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result as string;
      const updatedPhotos = { ...capturedPhotos, [currentPose]: imageData };
      setCapturedPhotos(updatedPhotos);
      
      uploadMutation.mutate({ category: currentPose, imageData });
      
      const nextPose = getNextMissingPose(currentPose, updatedPhotos);
      if (nextPose) {
        setCurrentPose(nextPose);
      } else {
        setShowCaptureFlow(false);
        toast({ title: "Photos saved successfully!" });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSkipPose = () => {
    const nextPose = getNextMissingPose(currentPose, capturedPhotos);
    if (nextPose) {
      setCurrentPose(nextPose);
    } else {
      setShowCaptureFlow(false);
      const hasAnyNewPhoto = Object.values(capturedPhotos).some(v => v && v !== "existing");
      if (hasAnyNewPhoto) {
        toast({ title: "Photos saved successfully!" });
      }
    }
  };

  const handleCaptureDateChange = (newDate: string) => {
    const existingSet = findExistingSetForDate(newDate);
    if (existingSet) {
      setCaptureDate(newDate);
      setPendingCaptureDate(newDate);
      setExistingPhotoSetForDate(existingSet);
      setShowCaptureFlow(false);
      setShowExistingPhotosDialog(true);
    } else {
      setCaptureDate(newDate);
      setCurrentPhotoSetId(`set-${Date.now()}`);
      setCapturedPhotos({ front: null, side: null, back: null });
      setCurrentPose("front");
    }
  };

  const handleOpenPhoto = (set: PhotoSet, category: PhotoCategory) => {
    setViewingPhotoSet(set);
    setViewingCategory(category);
    setShowAngleDropdown(false);
    setShowPhotoMenu(false);
  };

  const handleCloseViewer = () => {
    setViewingPhotoSet(null);
    setShowAngleDropdown(false);
    setShowPhotoMenu(false);
  };

  const handleDownloadPhoto = () => {
    if (!viewingPhotoSet) return;
    const photo = viewingPhotoSet.photos.find(p => p.category === viewingCategory);
    if (!photo) return;
    
    const link = document.createElement('a');
    link.href = photo.imageUrl;
    link.download = `progress-${viewingCategory}-${format(parseISO(viewingPhotoSet.date), 'yyyy-MM-dd')}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowPhotoMenu(false);
    toast({ title: "Photo downloaded" });
  };

  const handleDeleteViewingPhoto = () => {
    if (!viewingPhotoSet) return;
    const photo = viewingPhotoSet.photos.find(p => p.category === viewingCategory);
    if (!photo) return;
    
    deleteMutation.mutate(photo.id);
    setShowPhotoMenu(false);
    handleCloseViewer();
  };

  const getAvailableAngles = () => {
    if (!viewingPhotoSet) return [];
    return (["front", "side", "back"] as PhotoCategory[]).filter(cat => 
      viewingPhotoSet.photos.some(p => p.category === cat)
    );
  };

  const hasNoPhotos = photoSets.length === 0;

  return (
    <div className="min-h-screen bg-background pt-14" data-testid="page-progress-photos">
      <header 
        className="fixed top-0 left-0 right-0 z-50 bg-background"
        style={{
          backgroundImage: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(0, 0, 0, 0.06) 100%)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <Button 
              variant="ghost" 
              className="p-0 text-foreground hover:bg-muted flex items-center justify-center"
              style={{ width: '50px', height: '50px', minWidth: '50px', minHeight: '50px' }}
              onClick={() => navigate(fromParam || "/")}
              data-testid="button-back"
            >
              <X className="w-5 h-5" />
            </Button>
            <h1 className="text-foreground text-xl font-semibold" data-testid="text-page-title">Photos</h1>
            <div className="w-[50px]" />
          </div>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
        data-testid="input-file-photo"
      />

      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-xl" data-testid="dialog-instructions">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-semibold">INSTRUCTIONS</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold text-foreground">For Best Progress Photos</h4>
            </div>
            <div>
              <h5 className="font-semibold text-foreground">Clothes</h5>
              <p className="text-muted-foreground">Wear swimwear or athletic clothing to see your body change</p>
            </div>
            <div>
              <h5 className="font-semibold text-foreground">Backdrop</h5>
              <p className="text-muted-foreground">Stand against a white wall or a plain background</p>
            </div>
            <div>
              <h5 className="font-semibold text-foreground">Pose Naturally</h5>
              <p className="text-muted-foreground">Don't suck in or push out</p>
            </div>
            <p className="text-muted-foreground">
              We'll take 3 photos from different angles today. You can compare them side by side as you get fitter.
            </p>
            <div className="space-y-2 pt-2">
              <Button
                variant="ghost"
                className="w-full text-[#0cc9a9] hover:text-[#0cc9a9]/80"
                onClick={handleStartCapture}
                data-testid="button-start-dont-show"
              >
                OK. Start & don't show this again
              </Button>
              <Button
                variant="ghost"
                className="w-full text-[#0cc9a9] hover:text-[#0cc9a9]/80"
                onClick={() => {
                  setShowInstructions(false);
                  handleStartCapture();
                }}
                data-testid="button-start"
              >
                Ok. let's start
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showExistingPhotosDialog} onOpenChange={setShowExistingPhotosDialog}>
        <DialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-xl" data-testid="dialog-existing-photos">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-semibold">Photos Already Exist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground text-center">
              You already have photos for this date. Would you like to add to them or replace them?
            </p>
            {existingPhotoSetForDate && (
              <div className="flex justify-center gap-2 py-2">
                {existingPhotoSetForDate.photos.map((photo, idx) => (
                  <div key={photo.id || idx} className="w-16 h-20 rounded overflow-hidden bg-muted">
                    <img 
                      src={photo.imageUrl} 
                      alt={photo.category}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2 pt-2">
              <Button
                className="w-full bg-[#0cc9a9] text-black hover:bg-[#0cc9a9]/90"
                onClick={handleAddToExisting}
                data-testid="button-add-to-existing"
              >
                Add Missing Angles
              </Button>
              <Button
                variant="outline"
                className="w-full border-destructive text-destructive hover:bg-destructive/10"
                onClick={handleReplaceExisting}
                disabled={deleteMutation.isPending}
                data-testid="button-replace-existing"
              >
                {deleteMutation.isPending ? "Deleting..." : "Replace All Photos"}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => setShowExistingPhotosDialog(false)}
                data-testid="button-cancel-existing"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCaptureFlow} onOpenChange={setShowCaptureFlow}>
        <DialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-xl p-4 bg-card [&>button]:hidden !overflow-visible" data-testid="dialog-capture">
          <div className="relative">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-base font-semibold text-foreground">{poseInstructions[currentPose].label}</h3>
              <span className="text-xs text-muted-foreground">{poseInstructions[currentPose].eyeGuide}</span>
            </div>
          
            <div className="relative aspect-[4/3] bg-muted rounded-lg mb-2 flex items-center justify-center">
              {capturedPhotos[currentPose] ? (
                <img 
                  src={capturedPhotos[currentPose]!} 
                  alt={`${currentPose} pose`}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <Camera className="w-8 h-8 mx-auto mb-1" />
                  <p className="text-xs">Take consistent photos<br />by using the guiding lines.</p>
                </div>
              )}
              <div className="absolute left-0 right-0 top-[15%] border-t border-dashed border-muted-foreground/30" />
              <div className="absolute left-0 right-0 top-[70%] border-t border-dashed border-muted-foreground/30" />
            </div>
          
            <div className="flex justify-end mb-2">
              <span className="text-xs text-muted-foreground">{poseInstructions[currentPose].hipGuide}</span>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="w-32">
                <Input
                  type="date"
                  value={captureDate}
                  onChange={(e) => handleCaptureDateChange(e.target.value)}
                  className="bg-muted text-foreground h-8 text-xs text-center"
                  data-testid="input-capture-date"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  className="text-[#0cc9a9] hover:text-[#0cc9a9]/80 h-9"
                  onClick={handlePickPhoto}
                  disabled={uploadMutation.isPending}
                  data-testid="button-pick-photo"
                >
                  PICK PHOTO
                </Button>
                <Button
                  variant="ghost"
                  className="text-[#0cc9a9] hover:text-[#0cc9a9]/80 h-9"
                  onClick={handlePickPhoto}
                  disabled={uploadMutation.isPending}
                  data-testid="button-take-now"
                >
                  TAKE NOW
                </Button>
              </div>
            </div>

            <Button
              variant="ghost"
              className="absolute top-full left-1/2 -translate-x-1/2 mt-8 text-foreground hover:text-foreground/80 hover:bg-transparent border-0"
              onClick={handleSkipPose}
              data-testid="button-skip-pose"
            >
              SKIP THIS POSE
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Screen Photo Viewer */}
      {viewingPhotoSet && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/80">
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground hover:bg-white/10"
              onClick={handleCloseViewer}
              data-testid="button-close-viewer"
            >
              <X className="h-6 w-6" />
            </Button>
            
            <div className="flex flex-col items-center">
              <button
                className="flex items-center gap-1 text-foreground font-medium"
                onClick={() => setShowAngleDropdown(!showAngleDropdown)}
                data-testid="button-angle-dropdown"
              >
                {poseLabels[viewingCategory]}
                <ChevronDown className={`h-4 w-4 transition-transform ${showAngleDropdown ? 'rotate-180' : ''}`} />
              </button>
              <span className="text-sm text-muted-foreground">
                {formatDate(parseISO(viewingPhotoSet.date), "full")}
              </span>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground hover:bg-white/10"
              onClick={() => setShowPhotoMenu(true)}
              data-testid="button-photo-menu"
            >
              <MoreVertical className="h-6 w-6" />
            </Button>
          </div>

          {/* Angle Dropdown */}
          {showAngleDropdown && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-card rounded-lg shadow-lg z-10 overflow-hidden">
              {getAvailableAngles().map(angle => (
                <button
                  key={angle}
                  className={`block w-full px-6 py-3 text-left text-foreground hover:bg-muted ${
                    viewingCategory === angle ? 'bg-muted' : ''
                  }`}
                  onClick={() => {
                    setViewingCategory(angle);
                    setShowAngleDropdown(false);
                  }}
                  data-testid={`button-select-angle-${angle}`}
                >
                  {poseLabels[angle]}
                </button>
              ))}
            </div>
          )}

          {/* Photo Display */}
          <div className="flex-1 flex items-center justify-center p-4">
            {(() => {
              const photo = viewingPhotoSet.photos.find(p => p.category === viewingCategory);
              return photo ? (
                <img
                  src={photo.imageUrl}
                  alt={`${viewingCategory} view`}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              ) : (
                <div className="text-gray-500">No photo for this angle</div>
              );
            })()}
          </div>

          {/* Bottom Sheet Menu */}
          {showPhotoMenu && (
            <>
              <div 
                className="fixed inset-0 bg-black/60 z-[101]"
                onClick={() => setShowPhotoMenu(false)}
              />
              <div className="fixed bottom-0 left-0 right-0 bg-background rounded-t-2xl z-[102] animate-in slide-in-from-bottom">
                <div className="w-10 h-1 bg-muted rounded-full mx-auto mt-3" />
                <div className="py-4">
                  <button
                    className="w-full flex items-center gap-4 px-6 py-4 text-foreground hover:bg-card"
                    onClick={handleDownloadPhoto}
                    data-testid="button-download-photo"
                  >
                    <Download className="h-5 w-5" />
                    <span>Download photo</span>
                  </button>
                  <button
                    className="w-full flex items-center gap-4 px-6 py-4 text-red-500 hover:bg-card"
                    onClick={handleDeleteViewingPhoto}
                    data-testid="button-delete-viewing-photo"
                  >
                    <X className="h-5 w-5" />
                    <span>Delete</span>
                  </button>
                </div>
                <div className="px-4 pb-8">
                  <Button
                    variant="outline"
                    className="w-full py-6 border-border text-foreground"
                    onClick={() => setShowPhotoMenu(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="p-4">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : hasNoPhotos ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <div className="relative mb-8">
              <div className="w-48 h-64 bg-card/50 rounded-2xl border-2 border-border flex items-center justify-center">
                <div className="flex gap-1">
                  <div className="w-14 h-20 bg-muted rounded" />
                  <div className="w-14 h-20 bg-muted rounded border-2 border-[#0cc9a9]" />
                  <div className="w-14 h-20 bg-muted rounded" />
                </div>
              </div>
            </div>
            
            <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="text-empty-title">
              Let's add some photos
            </h2>
            <p className="text-muted-foreground text-sm mb-8 max-w-xs" data-testid="text-empty-description">
              Easily take 3 simple poses to document a day. Review poses side by side to compare your progress.
            </p>
            
            <Button
              className="bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black font-semibold px-12 py-6 rounded-full text-base"
              onClick={() => setShowInstructions(true)}
              data-testid="button-add-photos"
            >
              ADD PHOTOS
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {photoSets
              .slice()
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map(set => (
                <Card 
                  key={set.photoSetId} 
                  className="p-4"
                  data-testid={`photo-set-${set.photoSetId}`}
                >
                  <div className="mb-3">
                    <span className="text-sm font-medium text-foreground">
                      {formatDate(parseISO(set.date), "full")}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["front", "side", "back"] as PhotoCategory[]).map(category => {
                      const photo = set.photos.find(p => p.category === category);
                      return (
                        <div 
                          key={category} 
                          className="relative aspect-[3/4] bg-card rounded-lg overflow-hidden cursor-pointer"
                          onClick={() => photo && handleOpenPhoto(set, category)}
                        >
                          {photo ? (
                            <img 
                              src={photo.imageUrl} 
                              alt={`${category} view`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-xs text-gray-500">{poseLabels[category]}</span>
                            </div>
                          )}
                          <span className="absolute bottom-1 left-1 text-xs text-foreground bg-black/50 px-1 rounded">
                            {poseLabels[category]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}

            <div className="fixed bottom-20 left-0 right-0 px-4 pb-4">
              <Button
                className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black font-semibold py-6 rounded-full text-base"
                onClick={() => setShowInstructions(true)}
                data-testid="button-add-more-photos"
              >
                ADD PHOTOS
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
