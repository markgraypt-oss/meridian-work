import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, parseISO, isToday } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { X, MoreVertical, Pencil, Calendar, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { BodyweightEntry, BodyMeasurement, BodyFatEntry, LeanBodyMassEntry } from "@shared/schema";

interface MeasurementField {
  key: keyof BodyMeasurement;
  label: string;
  position: { left: string; top: string };
}

const measurementFields: MeasurementField[] = [
  { key: "neck", label: "Neck", position: { left: "50%", top: "8%" } },
  { key: "chest", label: "Chest", position: { left: "50%", top: "24%" } },
  { key: "leftArm", label: "L. Bicep", position: { left: "18%", top: "30%" } },
  { key: "rightArm", label: "R. Bicep", position: { left: "82%", top: "30%" } },
  { key: "waist", label: "Waist", position: { left: "50%", top: "40%" } },
  { key: "hips", label: "Hips", position: { left: "50%", top: "48%" } },
  { key: "leftThigh", label: "L. Thigh", position: { left: "35%", top: "62%" } },
  { key: "rightThigh", label: "R. Thigh", position: { left: "65%", top: "62%" } },
];

export default function ProgressEntryDetail() {
  const [, navigate] = useLocation();
  const { metricKey, id } = useParams();
  const { toast } = useToast();
  const { formatDate } = useFormattedDate();
  
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editWeight, setEditWeight] = useState("");
  const [editBodyFat, setEditBodyFat] = useState("");
  const [editLeanMass, setEditLeanMass] = useState("");
  const [editMeasurements, setEditMeasurements] = useState<Record<string, string>>({});
  const [moveDate, setMoveDate] = useState("");

  const entryId = id ? parseInt(id) : null;

  // Fetch bodyweight entry
  const { data: entry, isLoading: loadingEntry } = useQuery<BodyweightEntry>({
    queryKey: [`/api/progress/bodyweight/${entryId}`],
    enabled: !!entryId && metricKey === "bodyWeight",
  });

  // Fetch body fat entry directly when coming from bodyFat metric
  const { data: bodyFatDirectEntry, isLoading: loadingBodyFatDirect } = useQuery<BodyFatEntry>({
    queryKey: [`/api/progress/body-fat/${entryId}`],
    enabled: !!entryId && metricKey === "bodyFat",
  });

  // Fetch measurement entry directly when coming from measurements metric
  const { data: measurementDirectEntry, isLoading: loadingMeasurementDirect } = useQuery<BodyMeasurement>({
    queryKey: [`/api/progress/measurements/${entryId}`],
    enabled: !!entryId && metricKey === "measurements",
  });

  // Determine the entry date based on which metric we're viewing
  const primaryEntry = metricKey === "bodyFat" ? bodyFatDirectEntry : metricKey === "measurements" ? measurementDirectEntry : entry;
  const entryDate = primaryEntry?.date ? (typeof primaryEntry.date === 'string' ? primaryEntry.date : primaryEntry.date.toISOString()) : null;
  const dateFormatted = entryDate ? entryDate.split('T')[0] : null;
  const dateQueryParam = dateFormatted ? `${dateFormatted}T00:00:00.000Z` : null;

  // When coming from bodyWeight or bodyFat, fetch measurements by date
  const { data: measurementsByDate, isLoading: loadingMeasurementsByDate } = useQuery<BodyMeasurement | null>({
    queryKey: [`/api/progress/measurements/by-date/${dateQueryParam}`],
    enabled: !!dateQueryParam && metricKey !== "measurements",
  });
  
  // Use direct measurement or fetched by date
  const measurements = metricKey === "measurements" ? measurementDirectEntry : measurementsByDate;
  const loadingMeasurements = metricKey === "measurements" ? loadingMeasurementDirect : loadingMeasurementsByDate;

  // When coming from bodyWeight, fetch body fat by date; when from bodyFat, use the direct entry
  const { data: bodyFatByDate, isLoading: loadingBodyFatByDate } = useQuery<BodyFatEntry | null>({
    queryKey: [`/api/progress/body-fat/by-date/${dateQueryParam}`],
    enabled: !!dateQueryParam && metricKey === "bodyWeight",
  });
  
  const bodyFatEntry = metricKey === "bodyFat" ? bodyFatDirectEntry : bodyFatByDate;
  const loadingBodyFat = metricKey === "bodyFat" ? loadingBodyFatDirect : loadingBodyFatByDate;

  const { data: leanMassEntry, isLoading: loadingLeanMass } = useQuery<LeanBodyMassEntry | null>({
    queryKey: [`/api/progress/lean-body-mass/by-date/${dateQueryParam}`],
    enabled: !!dateQueryParam,
  });

  const updateWeightMutation = useMutation({
    mutationFn: async (updates: { weight?: number; date?: string }) => {
      return apiRequest("PATCH", `/api/progress/bodyweight/${entryId}`, updates);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/progress/bodyweight'] });
      await queryClient.invalidateQueries({ queryKey: [`/api/progress/bodyweight/${entryId}`] });
    },
    onError: () => {
      toast({ title: "Failed to update weight", variant: "destructive" });
    },
  });

  const updateBodyFatMutation = useMutation({
    mutationFn: async (percentage: number) => {
      if (bodyFatEntry?.id) {
        return apiRequest("PATCH", `/api/progress/body-fat/${bodyFatEntry.id}`, { percentage });
      } else if (dateFormatted) {
        return apiRequest("POST", "/api/progress/body-fat", { 
          date: `${dateFormatted}T00:00:00.000Z`,
          percentage 
        });
      }
    },
    onSuccess: async () => {
      if (dateQueryParam) {
        await queryClient.invalidateQueries({ queryKey: [`/api/progress/body-fat/by-date/${dateQueryParam}`] });
      }
      await queryClient.invalidateQueries({ queryKey: ['/api/progress/body-fat'] });
    },
    onError: () => {
      toast({ title: "Failed to update body fat", variant: "destructive" });
    },
  });

  const updateLeanMassMutation = useMutation({
    mutationFn: async (mass: number) => {
      if (leanMassEntry?.id) {
        return apiRequest("PATCH", `/api/progress/lean-body-mass/${leanMassEntry.id}`, { mass });
      } else if (dateFormatted) {
        return apiRequest("POST", "/api/progress/lean-body-mass", { 
          date: `${dateFormatted}T00:00:00.000Z`,
          mass 
        });
      }
    },
    onSuccess: async () => {
      if (dateQueryParam) {
        await queryClient.invalidateQueries({ queryKey: [`/api/progress/lean-body-mass/by-date/${dateQueryParam}`] });
      }
      await queryClient.invalidateQueries({ queryKey: ['/api/progress/lean-body-mass'] });
    },
    onError: () => {
      toast({ title: "Failed to update lean mass", variant: "destructive" });
    },
  });

  const updateMeasurementsMutation = useMutation({
    mutationFn: async (updates: Record<string, number | null>) => {
      if (measurements?.id) {
        return apiRequest("PATCH", `/api/progress/measurements/${measurements.id}`, updates);
      } else if (dateFormatted) {
        return apiRequest("POST", "/api/progress/measurements", { 
          date: `${dateFormatted}T00:00:00.000Z`,
          ...updates 
        });
      }
    },
    onSuccess: async () => {
      if (dateQueryParam) {
        await queryClient.invalidateQueries({ queryKey: [`/api/progress/measurements/by-date/${dateQueryParam}`] });
      }
      await queryClient.invalidateQueries({ queryKey: ['/api/progress/measurements'] });
    },
    onError: () => {
      toast({ title: "Failed to update measurements", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (metricKey === "bodyWeight") {
        return apiRequest("DELETE", `/api/progress/bodyweight/${entryId}`);
      } else if (metricKey === "bodyFat") {
        return apiRequest("DELETE", `/api/progress/body-fat/${entryId}`);
      } else if (metricKey === "measurements") {
        return apiRequest("DELETE", `/api/progress/measurements/${entryId}`);
      }
    },
    onSuccess: async () => {
      if (metricKey === "bodyWeight") {
        await queryClient.invalidateQueries({ queryKey: ['/api/progress/bodyweight'] });
      } else if (metricKey === "bodyFat") {
        await queryClient.invalidateQueries({ queryKey: ['/api/progress/body-fat'] });
      } else if (metricKey === "measurements") {
        await queryClient.invalidateQueries({ queryKey: ['/api/progress/measurements'] });
      }
      toast({ title: "Entry deleted" });
      navigate(metricKey === "measurements" ? "/progress" : `/my-progress/${metricKey}`);
    },
    onError: () => {
      toast({ title: "Failed to delete entry", variant: "destructive" });
    },
  });

  const openEditDialog = () => {
    setEditWeight(entry?.weight?.toString() || "");
    setEditBodyFat(bodyFatEntry?.percentage?.toString() || "");
    setEditLeanMass(leanMassEntry?.mass?.toString() || "");
    const measurementVals: Record<string, string> = {};
    measurementFields.forEach(field => {
      measurementVals[field.key] = measurements?.[field.key]?.toString() || "";
    });
    setEditMeasurements(measurementVals);
    setShowEditDialog(true);
  };

  const openMoveDialog = () => {
    setMoveDate(dateFormatted || "");
    setShowMoveDialog(true);
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      const promises: Promise<any>[] = [];
      
      if (editWeight && parseFloat(editWeight) !== entry?.weight) {
        promises.push(updateWeightMutation.mutateAsync({ weight: parseFloat(editWeight) }));
      }
      
      if (editBodyFat) {
        const newBodyFat = parseFloat(editBodyFat);
        if (newBodyFat !== bodyFatEntry?.percentage) {
          promises.push(updateBodyFatMutation.mutateAsync(newBodyFat));
        }
      }
      
      if (editLeanMass) {
        const newLeanMass = parseFloat(editLeanMass);
        if (newLeanMass !== leanMassEntry?.mass) {
          promises.push(updateLeanMassMutation.mutateAsync(newLeanMass));
        }
      }
      
      const measurementUpdates: Record<string, number | null> = {};
      let hasMeasurementChanges = false;
      measurementFields.forEach(field => {
        const newValue = editMeasurements[field.key] ? parseFloat(editMeasurements[field.key]) : null;
        const oldValue = measurements?.[field.key] ?? null;
        if (newValue !== oldValue) {
          measurementUpdates[field.key] = newValue;
          hasMeasurementChanges = true;
        }
      });
      
      if (hasMeasurementChanges) {
        promises.push(updateMeasurementsMutation.mutateAsync(measurementUpdates));
      }
      
      await Promise.all(promises);
      toast({ title: "Entry updated successfully" });
      setShowEditDialog(false);
    } catch (error) {
      toast({ title: "Failed to update some fields", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveDate = () => {
    if (moveDate) {
      updateWeightMutation.mutate({ date: `${moveDate}T00:00:00.000Z` }, {
        onSuccess: () => {
          toast({ title: "Entry moved successfully" });
          setShowMoveDialog(false);
        }
      });
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const isLoading = loadingEntry || loadingBodyFatDirect || loadingMeasurementDirect || loadingMeasurements || loadingBodyFat || loadingLeanMass;
  const validMetricKeys = ["bodyWeight", "bodyFat", "measurements"];

  if (!entryId || !validMetricKeys.includes(metricKey || "")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">Entry not found</p>
          <Button 
            className="mt-4"
            onClick={() => navigate(metricKey === "measurements" ? "/progress" : `/my-progress/${metricKey || "bodyWeight"}`)}
            data-testid="button-go-back"
          >
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  const fatMass = entry?.weight && bodyFatEntry?.percentage 
    ? (entry.weight * (bodyFatEntry.percentage / 100)).toFixed(1)
    : null;

  return (
    <div className="min-h-screen bg-background pt-14" data-testid="page-entry-detail">
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
              onClick={() => metricKey === "measurements" ? navigate("/progress") : navigate(`/my-progress/${metricKey}`)}
              data-testid="button-back"
            >
              <X className="w-5 h-5" />
            </Button>
            <h1 className="text-foreground text-xl font-semibold" data-testid="text-page-title">
              {entryDate ? (isToday(parseISO(entryDate)) ? "Today" : formatDate(parseISO(entryDate), "full")) : "Entry Details"}
            </h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-menu">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={openEditDialog} data-testid="menu-edit">
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit Stats
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openMoveDialog} data-testid="menu-move">
                  <Calendar className="w-4 h-4 mr-2" />
                  Move To Another Day
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)} 
                  className="text-destructive"
                  data-testid="menu-delete"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {isLoading ? (
          <>
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </>
        ) : (
          <>
            <Card className="p-4" data-testid="card-composition">
              <h2 className="font-semibold text-lg mb-4">Body Weight / Composition</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold text-foreground" data-testid="text-weight">
                    {entry?.weight ? `${entry.weight} kg` : "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">Weight</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold text-foreground" data-testid="text-body-fat">
                    {bodyFatEntry?.percentage ? `${bodyFatEntry.percentage}%` : "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">Body Fat %</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold text-foreground" data-testid="text-fat-mass">
                    {fatMass ? `${fatMass} kg` : "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">Fat Mass</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold text-foreground" data-testid="text-lean-mass">
                    {leanMassEntry?.mass ? `${leanMassEntry.mass} kg` : "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">Lean Mass</p>
                </div>
              </div>
            </Card>

            <Card className="p-4" data-testid="card-measurements">
              <h2 className="font-semibold text-lg mb-4">Body Measurements</h2>
              
              <div className="relative mx-auto" style={{ width: "200px", height: "340px" }}>
                <svg
                  viewBox="0 0 100 170"
                  className="w-full h-full"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <ellipse cx="50" cy="10" rx="8" ry="9" fill="#374151" />
                  <rect x="40" y="18" width="20" height="8" rx="2" fill="#374151" />
                  <path d="M30 26 L40 26 L38 60 L32 60 Z" fill="#374151" />
                  <path d="M60 26 L70 26 L68 60 L62 60 Z" fill="#374151" />
                  <path d="M38 26 L62 26 L64 80 L36 80 Z" fill="#374151" />
                  <path d="M36 80 L48 80 L46 140 L34 140 Z" fill="#374151" />
                  <path d="M52 80 L64 80 L66 140 L54 140 Z" fill="#374151" />
                  <path d="M30 60 L24 62 L18 58 L22 54 Z" fill="#374151" />
                  <path d="M70 60 L76 62 L82 58 L78 54 Z" fill="#374151" />
                  <path d="M34 140 L46 140 L46 160 L36 160 Z" fill="#374151" />
                  <path d="M54 140 L66 140 L64 160 L54 160 Z" fill="#374151" />
                </svg>
                
                {measurementFields.map(field => {
                  const value = measurements?.[field.key];
                  return (
                    <div
                      key={field.key}
                      className="absolute transform -translate-x-1/2 text-center"
                      style={{ left: field.position.left, top: field.position.top }}
                      data-testid={`measurement-${field.key}`}
                    >
                      <div className="text-[10px] text-muted-foreground whitespace-nowrap">{field.label}</div>
                      <div className="text-xs font-semibold text-[#0cc9a9]">
                        {value ? `${value} cm` : "-"}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {!measurements && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  No measurements recorded for this date
                </p>
              )}
            </Card>
          </>
        )}
      </div>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stats</DialogTitle>
            <DialogDescription>
              Update your body weight and composition data
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Weight (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={editWeight}
                  onChange={(e) => setEditWeight(e.target.value)}
                  placeholder="e.g., 75.5"
                  data-testid="input-edit-weight"
                />
              </div>
              <div>
                <Label>Body Fat (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={editBodyFat}
                  onChange={(e) => setEditBodyFat(e.target.value)}
                  placeholder="e.g., 15.0"
                  data-testid="input-edit-body-fat"
                />
              </div>
            </div>
            <div>
              <Label>Lean Mass (kg)</Label>
              <Input
                type="number"
                step="0.1"
                value={editLeanMass}
                onChange={(e) => setEditLeanMass(e.target.value)}
                placeholder="e.g., 62.0"
                data-testid="input-edit-lean-mass"
              />
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Measurements (cm)</h4>
              <div className="grid grid-cols-2 gap-3">
                {measurementFields.map(field => (
                  <div key={field.key}>
                    <Label className="text-xs">{field.label}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={editMeasurements[field.key] || ""}
                      onChange={(e) => setEditMeasurements(prev => ({
                        ...prev,
                        [field.key]: e.target.value
                      }))}
                      placeholder="cm"
                      className="h-8"
                      data-testid={`input-edit-${field.key}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={isSaving}
              className="bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black"
              data-testid="button-save-edit"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move To Another Day</DialogTitle>
            <DialogDescription>
              Select a new date for this entry
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>New Date</Label>
            <Input
              type="date"
              value={moveDate}
              onChange={(e) => setMoveDate(e.target.value)}
              data-testid="input-move-date"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleMoveDate}
              disabled={updateWeightMutation.isPending}
              className="bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black"
              data-testid="button-confirm-move"
            >
              {updateWeightMutation.isPending ? "Moving..." : "Move Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
