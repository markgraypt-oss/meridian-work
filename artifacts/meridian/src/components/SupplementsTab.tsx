import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Pill, Check, ChevronDown, ChevronUp, ChevronRight, Sparkles, Info,
  MoreVertical, Brain, AlertTriangle, Clock, Calendar, Trash2, Loader2
} from "lucide-react";
import type { Supplement } from "@shared/schema";

interface SupplementWithStatus {
  id: number;
  name: string;
  dosage?: string | null;
  timeOfDay: string;
  takenToday: boolean;
  frequency?: number;
  lastTakenDate?: string | null;
}

interface InteractionWarning {
  supplements: string[];
  warning: string;
  severity: 'low' | 'medium' | 'high';
}

const FREQUENCY_OPTIONS = [
  { value: "1", label: "Daily" },
  { value: "2", label: "Every 2 days" },
  { value: "3", label: "Every 3 days" },
  { value: "4", label: "Every 4 days" },
  { value: "5", label: "Every 5 days" },
  { value: "6", label: "Every 6 days" },
  { value: "7", label: "Once per week" },
];

const FREQUENCY_LABELS: Record<number, string> = {
  1: "Daily",
  2: "Every 2 days",
  3: "Every 3 days",
  4: "Every 4 days",
  5: "Every 5 days",
  6: "Every 6 days",
  7: "Once per week",
};

const TIME_LABELS: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
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

const isSupplementDueToday = (supplement: SupplementWithStatus): boolean => {
  const frequency = supplement.frequency || 1;
  if (frequency === 1) return true;
  if (!supplement.lastTakenDate) return true;
  const lastTaken = new Date(supplement.lastTakenDate);
  lastTaken.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysSinceLastTaken = Math.floor((today.getTime() - lastTaken.getTime()) / (1000 * 60 * 60 * 24));
  return daysSinceLastTaken >= frequency;
};

const getFrequencyLabel = (frequency?: number): string => {
  if (!frequency || frequency === 1) return 'daily';
  if (frequency === 7) return 'weekly';
  return `every ${frequency} days`;
};

export default function SupplementsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = sessionStorage.getItem('supplements-expanded-sections');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { schedule: true, manage: false, ai: false, history: false, interactions: false };
  });

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

  const [historyTab, setHistoryTab] = useState<"current" | "past">("current");

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = { ...prev, [section]: !prev[section] };
      try { sessionStorage.setItem('supplements-expanded-sections', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const { data: supplements = [], isLoading } = useQuery<SupplementWithStatus[]>({
    queryKey: ['/api/supplements'],
  });

  const { data: activeSupplements = [] } = useQuery<Supplement[]>({
    queryKey: ['/api/supplements/active'],
  });

  const { data: inactiveSupplements = [] } = useQuery<Supplement[]>({
    queryKey: ['/api/supplements/inactive'],
  });

  const { data: interactionsData } = useQuery<{ warnings: InteractionWarning[] }>({
    queryKey: ['/api/supplements/interactions'],
    retry: false,
  });

  const morningSchedule = supplements.filter(s => s.timeOfDay === 'morning' && (s.takenToday || isSupplementDueToday(s)));
  const afternoonSchedule = supplements.filter(s => s.timeOfDay === 'afternoon' && (s.takenToday || isSupplementDueToday(s)));
  const eveningSchedule = supplements.filter(s => s.timeOfDay === 'evening' && (s.takenToday || isSupplementDueToday(s)));

  const morningAll = supplements.filter(s => s.timeOfDay === 'morning');
  const afternoonAll = supplements.filter(s => s.timeOfDay === 'afternoon');
  const eveningAll = supplements.filter(s => s.timeOfDay === 'evening');

  const toggleSupplementMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('POST', `/api/supplements/${id}/toggle`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supplements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/streak'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to toggle supplement", variant: "destructive" });
    },
  });

  const addSupplementMutation = useMutation({
    mutationFn: async (data: { name: string; timeOfDay: string; dosage?: string; frequency?: number }) => {
      const res = await apiRequest('POST', '/api/supplements', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supplements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/supplements/active'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/supplements/active'] });
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
      } else {
        toast({ title: "Failed to remove supplement", variant: "destructive" });
      }
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/supplements/${id}/permanent`);
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

  const aiRecommendationsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/supplements/ai-recommendations', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to get recommendations');
      return res.json();
    },
    onError: () => {
      toast({ title: "Failed to load AI recommendations", variant: "destructive" });
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

  const takenCount = supplements.filter(s => s.takenToday).length;
  const dueCount = supplements.filter(s => s.takenToday || isSupplementDueToday(s)).length;
  const adherencePercentage = dueCount > 0 ? Math.round((takenCount / dueCount) * 100) : 0;

  const warnings = interactionsData?.warnings || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Section 1: Today's Schedule */}
      <Card className="bg-card">
        <CardHeader className="cursor-pointer" onClick={() => toggleSection('schedule')}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-base">
              <Pill className="h-5 w-5 text-purple-500 mr-2" />
              Today's Schedule
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {takenCount}/{dueCount} taken
              </Badge>
              {expandedSections.schedule ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </CardHeader>
        {expandedSections.schedule && (
          <CardContent className="space-y-4">
            {[
              { time: 'morning', label: 'Morning Stack', items: morningSchedule },
              { time: 'afternoon', label: 'Afternoon Stack', items: afternoonSchedule },
              { time: 'evening', label: 'Evening Stack', items: eveningSchedule },
            ].map(({ time, label, items }) => {
              const taken = items.filter(s => s.takenToday).length;
              return (
                <div key={time} className="bg-background rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">{label}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {taken}/{items.length} taken
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No supplements scheduled</p>
                    ) : (
                      items.map((supp) => (
                        <button
                          key={supp.id}
                          className="flex items-center justify-between w-full"
                          onClick={() => toggleSupplementMutation.mutate(supp.id)}
                          disabled={toggleSupplementMutation.isPending}
                        >
                          <div className={`text-left ${supp.takenToday ? 'line-through text-muted-foreground' : ''}`}>
                            <span className="text-sm">{supp.name}</span>
                            {supp.dosage && (
                              <span className="text-xs text-muted-foreground ml-1">({supp.dosage})</span>
                            )}
                          </div>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            supp.takenToday
                              ? 'bg-[#0cc9a9] border-[#0cc9a9]'
                              : 'border-muted-foreground'
                          }`}>
                            {supp.takenToday && <Check className="h-3 w-3 text-black" />}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>

      {/* Section 2: Manage Supplements */}
      <Card className="bg-card">
        <CardHeader className="cursor-pointer" onClick={() => toggleSection('manage')}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-base">
              <Sparkles className="h-5 w-5 text-primary mr-2" />
              Manage Supplements
            </CardTitle>
            {expandedSections.manage ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CardHeader>
        {expandedSections.manage && (
          <CardContent className="space-y-4">
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
              <div className="mt-2">
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
            </div>

            {[
              { time: 'morning', label: 'Morning Stack', items: morningAll },
              { time: 'afternoon', label: 'Afternoon Stack', items: afternoonAll },
              { time: 'evening', label: 'Evening Stack', items: eveningAll },
            ].map(({ time, label, items }) => (
              <div key={time} className="bg-muted/30 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-2">{label}</h4>
                <div className="space-y-1">
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No supplements added</p>
                  ) : (
                    items.map((supp) => (
                      <div key={supp.id} className="flex items-center justify-between gap-2 p-2 bg-background rounded">
                        <div className="min-w-0 flex-1 truncate">
                          <span className="text-sm">{supp.name}</span>
                          {supp.dosage && (
                            <span className="text-xs text-muted-foreground ml-2">({supp.dosage})</span>
                          )}
                          {supp.frequency && supp.frequency > 1 && (
                            <span className="text-xs text-primary ml-2 whitespace-nowrap">
                              {getFrequencyLabel(supp.frequency)}
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
                    ))
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
                      onClick={() => { sessionStorage.setItem('nutrition-returning-from-subpage', 'true'); navigate(`/supplement-detail/${encodeURIComponent(supp.name)}`); }}
                    >
                      <p className="font-medium text-sm text-primary flex items-center gap-1">
                        {supp.name}
                        <Info className="h-3 w-3" />
                      </p>
                      <p className="text-xs text-muted-foreground">{supp.category} - {supp.recommendedDose}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Section 3: AI Stack Recommendations */}
      <Card className="bg-card">
        <CardHeader className="cursor-pointer" onClick={() => toggleSection('ai')}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-base">
              <Brain className="h-5 w-5 text-primary mr-2" />
              AI Stack Recommendations
            </CardTitle>
            {expandedSections.ai ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CardHeader>
        {expandedSections.ai && (
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Get personalised AI analysis of your current supplement stack based on your goals, training, and body map data.
            </p>
            <Button
              className="w-full"
              onClick={() => aiRecommendationsMutation.mutate()}
              disabled={aiRecommendationsMutation.isPending}
            >
              {aiRecommendationsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Analyzing your stack...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Analyze My Stack
                </>
              )}
            </Button>
            {aiRecommendationsMutation.data && (
              <div className="bg-background rounded-lg p-4 border border-primary/20">
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {aiRecommendationsMutation.data.recommendations}
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Section 4: History & Adherence */}
      <Card className="bg-card">
        <CardHeader className="cursor-pointer" onClick={() => toggleSection('history')}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-base">
              <Calendar className="h-5 w-5 text-primary mr-2" />
              History & Adherence
            </CardTitle>
            {expandedSections.history ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CardHeader>
        {expandedSections.history && (
          <CardContent className="space-y-4">
            <div className="bg-background rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Today's Adherence</span>
                <span className="text-sm font-bold text-primary">{adherencePercentage}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 rounded-full"
                  style={{ width: `${adherencePercentage}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {takenCount} of {dueCount} supplements taken today
              </p>
            </div>

            <Tabs value={historyTab} onValueChange={(v) => setHistoryTab(v as "current" | "past")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger
                  value="current"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Current
                </TabsTrigger>
                <TabsTrigger
                  value="past"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Past
                </TabsTrigger>
              </TabsList>

              <TabsContent value="current" className="mt-4">
                {activeSupplements.length === 0 ? (
                  <div className="text-center py-6">
                    <Pill className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No active supplements</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeSupplements.map((supp) => (
                      <Card
                        key={supp.id}
                        className="bg-background hover:bg-background/80 transition-colors cursor-pointer"
                        onClick={() => { sessionStorage.setItem('nutrition-returning-from-subpage', 'true'); navigate(`/supplement-history/${supp.id}`); }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Pill className="w-4 h-4 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-medium text-sm text-foreground truncate">{supp.name}</h3>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {supp.dosage && <span className="truncate">{supp.dosage}</span>}
                                  <span className="flex items-center gap-1 flex-shrink-0">
                                    <Clock className="w-3 h-3" />
                                    {TIME_LABELS[supp.timeOfDay] || supp.timeOfDay}
                                  </span>
                                  {supp.frequency && supp.frequency > 1 && (
                                    <span className="flex-shrink-0">
                                      {FREQUENCY_LABELS[supp.frequency]}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="past" className="mt-4">
                {inactiveSupplements.length === 0 ? (
                  <div className="text-center py-6">
                    <Pill className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No past supplements</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {inactiveSupplements.map((supp) => (
                      <Card
                        key={supp.id}
                        className="bg-background hover:bg-background/80 transition-colors cursor-pointer"
                        onClick={() => { sessionStorage.setItem('nutrition-returning-from-subpage', 'true'); navigate(`/supplement-history/${supp.id}`); }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                <Pill className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-medium text-sm text-foreground truncate">{supp.name}</h3>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {supp.dosage && <span className="truncate">{supp.dosage}</span>}
                                  <span className="flex items-center gap-1 flex-shrink-0">
                                    <Clock className="w-3 h-3" />
                                    {TIME_LABELS[supp.timeOfDay] || supp.timeOfDay}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  permanentDeleteMutation.mutate(supp.id);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        )}
      </Card>

      {/* Section 5: Interaction Warnings */}
      {warnings.length > 0 && (
        <Card className="bg-card border-[#0cc9a9]/30">
          <CardHeader className="cursor-pointer" onClick={() => toggleSection('interactions')}>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-base">
                <AlertTriangle className="h-5 w-5 text-[#0cc9a9] mr-2" />
                Interaction Warnings
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs bg-[#0cc9a9]/10 text-[#0cc9a9]">
                  {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
                </Badge>
                {expandedSections.interactions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
          {expandedSections.interactions && (
            <CardContent className="space-y-3">
              {warnings.map((warning, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg p-3 border-l-4 ${
                    warning.severity === 'high'
                      ? 'bg-red-500/5 border-l-red-500'
                      : warning.severity === 'medium'
                      ? 'bg-[#0cc9a9]/5 border-l-[#0cc9a9]'
                      : 'bg-[#0cc9a9]/5 border-l-[#0cc9a9]'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                      warning.severity === 'high' ? 'text-red-500' :
                      warning.severity === 'medium' ? 'text-[#0cc9a9]' : 'text-[#0cc9a9]'
                    }`} />
                    <div>
                      <p className="text-sm font-medium">{warning.supplements.join(' + ')}</p>
                      <p className="text-xs text-muted-foreground mt-1">{warning.warning}</p>
                      <Badge
                        variant="secondary"
                        className={`mt-2 text-xs ${
                          warning.severity === 'high'
                            ? 'bg-red-500/10 text-red-500'
                            : warning.severity === 'medium'
                            ? 'bg-[#0cc9a9]/10 text-[#0cc9a9]'
                            : 'bg-[#0cc9a9]/10 text-[#0cc9a9]'
                        }`}
                      >
                        {warning.severity} risk
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Edit/Delete Drawer */}
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
                >
                  Remove supplement
                </button>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
