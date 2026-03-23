import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Pill } from "lucide-react";
import TopHeader from "@/components/TopHeader";

const FREQUENCY_OPTIONS = [
  { value: "1", label: "Daily" },
  { value: "2", label: "Every 2 days" },
  { value: "3", label: "Every 3 days" },
  { value: "4", label: "Every 4 days" },
  { value: "5", label: "Every 5 days" },
  { value: "6", label: "Every 6 days" },
  { value: "7", label: "Once per week" },
];

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

export default function SupplementDetail() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const params = useParams<{ name: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [dosageMode, setDosageMode] = useState<'recommended' | 'custom'>('recommended');
  const [customDosageInput, setCustomDosageInput] = useState('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedFrequency, setSelectedFrequency] = useState('1');

  const supplementName = decodeURIComponent(params.name || '');
  const supplement = RECOMMENDED_SUPPLEMENTS.find(s => s.name === supplementName);
  
  useEffect(() => {
    if (supplement && !selectedTime) {
      setSelectedTime(supplement.timeOfDay);
    }
  }, [supplement, selectedTime]);

  const addSupplementMutation = useMutation({
    mutationFn: async (data: { name: string; timeOfDay: string; dosage?: string; frequency?: number }) => {
      const res = await apiRequest('POST', '/api/supplements', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supplements'] });
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

  const handleAddSupplement = (time: string) => {
    if (!supplement) return;
    
    const finalDosage = dosageMode === 'recommended' 
      ? supplement.recommendedDose 
      : customDosageInput;
    
    if (dosageMode === 'custom' && !customDosageInput.trim()) {
      toast({
        title: "Please enter a dosage",
        variant: "destructive",
      });
      return;
    }
    
    addSupplementMutation.mutate(
      { name: supplement.name, timeOfDay: time, dosage: finalDosage, frequency: parseInt(selectedFrequency) },
      {
        onSuccess: () => {
          toast({
            title: "Supplement added",
            description: `${supplement.name} added to your ${time} stack`,
          });
          navigate('/supplement-stacks');
        }
      }
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!supplement) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <TopHeader 
          title="Supplement Details" 
          onBack={() => window.history.back()} 
        />
        <div className="p-4">
          <p className="text-muted-foreground">Supplement not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader 
        title={supplement.name} 
        onBack={() => window.history.back()} 
      />
      
      <div className="p-4 space-y-4">
        <Card className="bg-card">
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Pill className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">{supplement.name}</h2>
                <p className="text-xs text-muted-foreground">{supplement.category}</p>
              </div>
            </div>
            
            <p className="text-muted-foreground text-sm">{supplement.description}</p>
            
            <div>
              <h5 className="font-medium text-sm mb-2">Benefits</h5>
              <ul className="text-sm text-muted-foreground space-y-1">
                {supplement.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h5 className="font-medium text-sm mb-1">Recommended Dose</h5>
              <p className="text-sm text-muted-foreground">{supplement.recommendedDose}</p>
            </div>
            
            <div>
              <h5 className="font-medium text-sm mb-1">Best Time</h5>
              <p className="text-sm text-muted-foreground capitalize">{supplement.timeOfDay}</p>
            </div>
            
            <div>
              <h5 className="font-medium text-sm mb-2">Suitable For</h5>
              <ul className="text-sm text-muted-foreground space-y-1">
                {supplement.suitableFor.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h5 className="font-medium text-sm mb-2">Cautions</h5>
              <ul className="text-sm text-muted-foreground space-y-1">
                {supplement.notSuitableFor.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0cc9a9]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card">
          <CardContent className="pt-4 space-y-4">
            <h5 className="font-medium text-sm">Select Dosage</h5>
            <div className="space-y-2">
              <button
                className={`w-full p-3 rounded-lg border text-left transition-colors ${
                  dosageMode === 'recommended' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-muted-foreground'
                }`}
                onClick={() => setDosageMode('recommended')}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Recommended</p>
                    <p className="text-xs text-muted-foreground">{supplement.recommendedDose}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    dosageMode === 'recommended' ? 'border-primary' : 'border-muted-foreground'
                  }`}>
                    {dosageMode === 'recommended' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    )}
                  </div>
                </div>
              </button>
              
              <button
                className={`w-full p-3 rounded-lg border text-left transition-colors ${
                  dosageMode === 'custom' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-muted-foreground'
                }`}
                onClick={() => setDosageMode('custom')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">Custom</p>
                    {dosageMode === 'custom' ? (
                      <Input
                        placeholder="e.g., 20g or 4000 IU"
                        value={customDosageInput}
                        onChange={(e) => setCustomDosageInput(e.target.value)}
                        className="mt-1 h-8 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">Enter your own dosage</p>
                    )}
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ml-2 ${
                    dosageMode === 'custom' ? 'border-primary' : 'border-muted-foreground'
                  }`}>
                    {dosageMode === 'custom' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    )}
                  </div>
                </div>
              </button>
            </div>
            
            <div className="space-y-3 pt-2">
              <h5 className="font-medium text-sm">Select Time</h5>
              <div className="grid grid-cols-3 gap-2">
                {['morning', 'afternoon', 'evening'].map((time) => (
                  <button
                    key={time}
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      selectedTime === time 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-muted-foreground'
                    }`}
                    onClick={() => setSelectedTime(time)}
                  >
                    <p className="font-medium text-sm capitalize">{time}</p>
                  </button>
                ))}
              </div>
              
              <div className="space-y-2 pt-2">
                <h5 className="font-medium text-sm">Frequency</h5>
                <Select value={selectedFrequency} onValueChange={setSelectedFrequency}>
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
              
              <Button
                className="w-full mt-4"
                onClick={() => handleAddSupplement(selectedTime)}
                disabled={addSupplementMutation.isPending || !selectedTime}
              >
                {addSupplementMutation.isPending ? 'Adding...' : 'Confirm & Add to Stack'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
