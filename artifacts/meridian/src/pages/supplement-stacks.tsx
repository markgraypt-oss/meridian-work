import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { MoreVertical, Sparkles, Info, History } from "lucide-react";
import TopHeader from "@/components/TopHeader";
import { addDays, format } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";

const FREQUENCY_OPTIONS = [
  { value: "1", label: "Daily" },
  { value: "2", label: "Every 2 days" },
  { value: "3", label: "Every 3 days" },
  { value: "4", label: "Every 4 days" },
  { value: "5", label: "Every 5 days" },
  { value: "6", label: "Every 6 days" },
  { value: "7", label: "Once per week" },
];

interface SupplementWithStatus {
  id: number;
  name: string;
  dosage?: string | null;
  timeOfDay: string;
  takenToday: boolean;
  frequency?: number;
  lastTakenDate?: string | null;
}

const getFrequencyLabel = (frequency?: number): string => {
  if (!frequency || frequency === 1) return 'daily';
  if (frequency === 7) return 'weekly';
  return `every ${frequency} days`;
};

const getNextDueDate = (supplement: SupplementWithStatus, formatter?: (date: Date, variant: "full" | "short" | "withDay" | "monthDay") => string): string | null => {
  if (!supplement.frequency || supplement.frequency === 1) return null;
  if (!supplement.lastTakenDate) return 'Not yet taken';
  const lastTaken = new Date(supplement.lastTakenDate);
  const nextDue = addDays(lastTaken, supplement.frequency);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (nextDue <= today) return 'Due today';
  return formatter ? formatter(nextDue, 'monthDay') : format(nextDue, 'MMM d');
};

interface RecommendedSupplement {
  name: string;
  category: string;
  timeOfDay: string;
  description: string;
  benefits: string[];
  recommendedDose: string;
  suitableFor: string[];
  notSuitableFor: string[];
}

const RECOMMENDED_SUPPLEMENTS: RecommendedSupplement[] = [
  { 
    name: 'Vitamin D3', 
    category: 'Vitamins', 
    timeOfDay: 'morning',
    description: 'Essential fat-soluble vitamin that supports bone health, immune function, and mood regulation.',
    benefits: ['Bone health', 'Immune support', 'Mood regulation', 'Muscle function'],
    recommendedDose: '2000-5000 IU daily',
    suitableFor: ['Most adults', 'Those with limited sun exposure', 'People in northern climates'],
    notSuitableFor: ['Those with hypercalcemia', 'Kidney disease (consult doctor)']
  },
  { 
    name: 'Omega-3 Fish Oil', 
    category: 'Essential Fats', 
    timeOfDay: 'morning',
    description: 'Essential fatty acids EPA and DHA that support heart, brain, and joint health.',
    benefits: ['Heart health', 'Brain function', 'Joint support', 'Reduces inflammation'],
    recommendedDose: '1000-3000mg EPA+DHA daily',
    suitableFor: ['Most adults', 'Athletes', 'Those with inflammation'],
    notSuitableFor: ['Fish allergy', 'Blood thinning medications (consult doctor)']
  },
  { 
    name: 'Magnesium Glycinate', 
    category: 'Minerals', 
    timeOfDay: 'evening',
    description: 'Highly absorbable form of magnesium that supports sleep, muscle relaxation, and stress relief.',
    benefits: ['Sleep quality', 'Muscle relaxation', 'Stress reduction', 'Nerve function'],
    recommendedDose: '200-400mg daily',
    suitableFor: ['Most adults', 'Those with sleep issues', 'Athletes', 'Stress/anxiety'],
    notSuitableFor: ['Kidney disease', 'Heart block']
  },
  { 
    name: 'Zinc', 
    category: 'Minerals', 
    timeOfDay: 'morning',
    description: 'Essential mineral for immune function, wound healing, and testosterone production.',
    benefits: ['Immune support', 'Hormone balance', 'Skin health', 'Taste/smell'],
    recommendedDose: '15-30mg daily',
    suitableFor: ['Most adults', 'Athletes', 'Those with immune concerns'],
    notSuitableFor: ['High doses can interfere with copper absorption']
  },
  { 
    name: 'Vitamin K2', 
    category: 'Vitamins', 
    timeOfDay: 'morning',
    description: 'Works synergistically with Vitamin D to direct calcium to bones rather than arteries.',
    benefits: ['Bone health', 'Heart health', 'Calcium metabolism'],
    recommendedDose: '100-200mcg MK-7 daily',
    suitableFor: ['Those taking Vitamin D', 'Bone health concerns', 'Most adults'],
    notSuitableFor: ['Those on blood thinners (consult doctor)']
  },
  { 
    name: 'Creatine Monohydrate', 
    category: 'Performance', 
    timeOfDay: 'morning',
    description: 'Most researched sports supplement. Supports strength, power, and cognitive function.',
    benefits: ['Strength gains', 'Power output', 'Brain function', 'Recovery'],
    recommendedDose: '5g daily',
    suitableFor: ['Athletes', 'Strength trainers', 'Cognitive support'],
    notSuitableFor: ['Kidney disease (consult doctor)']
  },
  { 
    name: 'Ashwagandha', 
    category: 'Adaptogens', 
    timeOfDay: 'evening',
    description: 'Adaptogenic herb that helps the body manage stress and supports testosterone levels.',
    benefits: ['Stress reduction', 'Sleep quality', 'Testosterone support', 'Anxiety relief'],
    recommendedDose: '300-600mg KSM-66 daily',
    suitableFor: ['Those with high stress', 'Sleep issues', 'Athletes'],
    notSuitableFor: ['Pregnancy', 'Thyroid conditions', 'Autoimmune diseases']
  },
  { 
    name: 'Probiotics', 
    category: 'Gut Health', 
    timeOfDay: 'morning',
    description: 'Beneficial bacteria that support digestive health and immune function.',
    benefits: ['Gut health', 'Immune support', 'Nutrient absorption', 'Mental health'],
    recommendedDose: '10-50 billion CFU daily',
    suitableFor: ['Most adults', 'Those with digestive issues', 'After antibiotics'],
    notSuitableFor: ['Severely immunocompromised (consult doctor)']
  },
];

export default function SupplementStacks() {
  const { formatDate } = useFormattedDate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [customSupplementName, setCustomSupplementName] = useState('');
  const [supplementDosage, setSupplementDosage] = useState('');
  const [customFrequency, setCustomFrequency] = useState('1');
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSupplement, setSelectedSupplement] = useState<SupplementWithStatus | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDosage, setEditDosage] = useState('');
  const [editTimeOfDay, setEditTimeOfDay] = useState('');
  const [editFrequency, setEditFrequency] = useState('1');

  const { data: supplements = [], isLoading } = useQuery<SupplementWithStatus[]>({
    queryKey: ['/api/supplements'],
    enabled: isAuthenticated,
  });

  const addSupplementMutation = useMutation({
    mutationFn: async (data: { name: string; timeOfDay: string; dosage?: string; frequency?: number }) => {
      const res = await apiRequest('POST', '/api/supplements', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supplements'] });
      setCustomSupplementName('');
      setSupplementDosage('');
      setCustomFrequency('1');
      toast({ title: "Supplement added", description: "Added to your stack" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", variant: "destructive" });
        window.location.href = "/api/login";
      } else {
        toast({ title: "Failed to add supplement", variant: "destructive" });
      }
    },
  });

  const updateSupplementMutation = useMutation({
    mutationFn: async (data: { id: number; name: string; dosage?: string; timeOfDay: string; frequency: number }) => {
      const res = await apiRequest('PATCH', `/api/supplements/${data.id}`, {
        name: data.name,
        dosage: data.dosage,
        timeOfDay: data.timeOfDay,
        frequency: data.frequency,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supplements'] });
      setDrawerOpen(false);
      setIsEditing(false);
      setSelectedSupplement(null);
      toast({ title: "Supplement updated" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", variant: "destructive" });
        window.location.href = "/api/login";
      } else {
        toast({ title: "Failed to update supplement", variant: "destructive" });
      }
    },
  });

  const archiveSupplementMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/supplements/${id}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to archive');
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supplements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/supplements/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/supplements/inactive'] });
      setDrawerOpen(false);
      setSelectedSupplement(null);
      toast({ title: "Supplement moved to history" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", variant: "destructive" });
        window.location.href = "/api/login";
      } else if (error.message.includes("without any logged entries")) {
        toast({ 
          title: "Cannot archive", 
          description: "This supplement has no logged entries. It will be permanently deleted.",
          variant: "destructive" 
        });
      } else {
        toast({ title: "Failed to remove supplement", variant: "destructive" });
      }
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/supplements/${id}/permanent`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supplements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/supplements/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/supplements/inactive'] });
      setDrawerOpen(false);
      setSelectedSupplement(null);
      toast({ title: "Supplement deleted" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", variant: "destructive" });
        window.location.href = "/api/login";
      } else {
        toast({ title: "Failed to delete supplement", variant: "destructive" });
      }
    },
  });

  const handleOpenMenu = (supp: SupplementWithStatus) => {
    setSelectedSupplement(supp);
    setIsEditing(false);
    setDrawerOpen(true);
  };

  const handleEditClick = () => {
    if (selectedSupplement) {
      setEditName(selectedSupplement.name);
      setEditDosage(selectedSupplement.dosage || '');
      setEditTimeOfDay(selectedSupplement.timeOfDay);
      setEditFrequency(String(selectedSupplement.frequency || 1));
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    if (selectedSupplement && editName) {
      updateSupplementMutation.mutate({
        id: selectedSupplement.id,
        name: editName,
        dosage: editDosage || undefined,
        timeOfDay: editTimeOfDay,
        frequency: parseInt(editFrequency),
      });
    }
  };

  const handleDeleteClick = async () => {
    if (!selectedSupplement) return;
    
    try {
      const hasLogsRes = await fetch(`/api/supplements/${selectedSupplement.id}/has-logs`, { credentials: 'include' });
      const { hasLogs } = await hasLogsRes.json();
      
      if (hasLogs) {
        archiveSupplementMutation.mutate(selectedSupplement.id);
      } else {
        permanentDeleteMutation.mutate(selectedSupplement.id);
      }
    } catch {
      permanentDeleteMutation.mutate(selectedSupplement.id);
    }
  };

  const morningSupplements = supplements.filter(s => s.timeOfDay === 'morning');
  const afternoonSupplements = supplements.filter(s => s.timeOfDay === 'afternoon');
  const eveningSupplements = supplements.filter(s => s.timeOfDay === 'evening');

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader 
        title="Supplement Stacks" 
        onBack={() => navigate('/nutrition')} 
        rightMenuButton={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/supplement-history')}
            className="h-9 w-9"
          >
            <History className="h-5 w-5" />
          </Button>
        }
      />
      
      <div className="p-4 space-y-4">
        <Card className="bg-card">
          <CardContent className="pt-4 space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-2">Add Custom Supplement</h4>
              <div className="flex gap-2">
                <Input 
                  placeholder="Supplement name"
                  value={customSupplementName}
                  onChange={(e) => setCustomSupplementName(e.target.value)}
                  className="flex-1"
                />
                <Input 
                  placeholder="Dosage (e.g., 5g)"
                  value={supplementDosage}
                  onChange={(e) => setSupplementDosage(e.target.value)}
                  className="w-28"
                />
              </div>
              <div className="flex gap-2 mt-2">
                {['morning', 'afternoon', 'evening'].map((time) => (
                  <Button
                    key={time}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => {
                      if (customSupplementName) {
                        addSupplementMutation.mutate({
                          name: customSupplementName,
                          timeOfDay: time,
                          dosage: supplementDosage || undefined,
                          frequency: parseInt(customFrequency),
                        });
                      }
                    }}
                    disabled={!customSupplementName || addSupplementMutation.isPending}
                  >
                    + {time.charAt(0).toUpperCase() + time.slice(1)}
                  </Button>
                ))}
              </div>
              <div className="mt-3">
                <label className="text-xs text-muted-foreground mb-1 block">Frequency</label>
                <Select value={customFrequency} onValueChange={setCustomFrequency}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {[
              { time: 'morning', label: 'Morning Stack', items: morningSupplements },
              { time: 'afternoon', label: 'Afternoon Stack', items: afternoonSupplements },
              { time: 'evening', label: 'Evening Stack', items: eveningSupplements },
            ].map(({ time, label, items }) => (
              <div key={time} className="bg-muted/30 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-2">{label}</h4>
                <div className="space-y-1">
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No supplements added</p>
                  ) : (
                    items.map((supp) => {
                      const nextDue = getNextDueDate(supp, formatDate);
                      return (
                        <div key={supp.id} className="flex items-center justify-between gap-2 p-2 bg-background rounded">
                          <div className="min-w-0 flex-1 truncate">
                            <span className="text-sm">{supp.name}</span>
                            {supp.dosage && (
                              <span className="text-xs text-muted-foreground ml-2">({supp.dosage})</span>
                            )}
                            {supp.frequency && supp.frequency > 1 && (
                              <span className="text-xs text-primary ml-2 whitespace-nowrap">
                                • {getFrequencyLabel(supp.frequency)}
                                {nextDue && <span className="text-muted-foreground ml-1">(Next: {nextDue})</span>}
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground flex-shrink-0"
                            onClick={() => handleOpenMenu(supp)}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}

            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Add from Recommended
              </h4>
              <p className="text-xs text-muted-foreground mb-3">Tap a supplement for details and to add to your stack</p>

              <div className="space-y-2">
                {RECOMMENDED_SUPPLEMENTS.map((supp) => {
                  const isAlreadyAdded = supplements.some(s => s.name.toLowerCase() === supp.name.toLowerCase());
                  
                  if (isAlreadyAdded) return null;
                  
                  return (
                    <button 
                      key={supp.name} 
                      className="w-full p-3 rounded-lg border bg-background text-left hover:border-primary transition-colors"
                      onClick={() => navigate(`/supplement-detail/${encodeURIComponent(supp.name)}`)}
                    >
                      <p className="font-medium text-sm text-primary flex items-center gap-1">
                        {supp.name}
                        <Info className="h-3 w-3" />
                      </p>
                      <p className="text-xs text-muted-foreground">{supp.category} • {supp.recommendedDose}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="bg-background border-t border-muted">
          <div className="p-4 pb-8">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Name</label>
                  <Input 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Supplement name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Dosage</label>
                  <Input 
                    value={editDosage}
                    onChange={(e) => setEditDosage(e.target.value)}
                    placeholder="e.g., 5g, 1000mg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Time of Day</label>
                  <Select value={editTimeOfDay} onValueChange={setEditTimeOfDay}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning</SelectItem>
                      <SelectItem value="afternoon">Afternoon</SelectItem>
                      <SelectItem value="evening">Evening</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Frequency</label>
                  <Select value={editFrequency} onValueChange={setEditFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1 bg-primary"
                    onClick={handleSaveEdit}
                    disabled={!editName || updateSupplementMutation.isPending}
                  >
                    {updateSupplementMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <button
                  className="w-full text-left py-4 px-2 text-foreground text-lg hover:bg-muted/50 rounded-lg transition-colors"
                  onClick={handleEditClick}
                >
                  Edit supplement
                </button>
                <button
                  className="w-full text-left py-4 px-2 text-destructive text-lg hover:bg-muted/50 rounded-lg transition-colors"
                  onClick={handleDeleteClick}
                  disabled={archiveSupplementMutation.isPending || permanentDeleteMutation.isPending}
                >
                  {archiveSupplementMutation.isPending || permanentDeleteMutation.isPending 
                    ? 'Deleting...' 
                    : 'Delete'}
                </button>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
