import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import {
  Sparkles, Save, Monitor, Brain, Cpu,
  UserCheck, Dumbbell, Apple, Activity, Heart,
  ThumbsUp, ThumbsDown, MessageSquare, ShieldAlert, Ban, PenLine,
} from "lucide-react";

interface AiCoachingSetting {
  id: number;
  feature: string;
  provider: string | null;
  model: string | null;
  coachingVoice: string | null;
  customGuidelines: string | null;
  priorityFactors: string[] | null;
  brandRecommendations: string | null;
  coachingRules: string | null;
  thingsToNeverDo: string | null;
  responseStyle: string | null;
  featureContext: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AIProvider {
  provider: string;
  models: string[];
}

interface FeatureField {
  key: string;
  label: string;
  description: string;
  placeholder: string;
  rows?: number;
}

interface FeatureConfig {
  id: string;
  label: string;
  icon: any;
  description: string;
  fields: FeatureField[];
  comingSoon?: boolean;
}

const FEATURES: FeatureConfig[] = [
  {
    id: 'onboarding_recommendations',
    label: 'Onboarding',
    icon: UserCheck,
    description: 'How the AI recommends programmes, goals, and habits for new users based on their coaching intake',
    fields: [
      {
        key: 'customGuidelines',
        label: 'Programme Matching Logic',
        description: 'How should the AI decide which programme suits a new user? Define your matching criteria.',
        placeholder: 'For beginners with no training history, always start with a foundational programme. If someone reports desk pain in their intake, prioritise corrective work before strength training. Never recommend advanced programmes to someone with less than 6 months experience. Match training environment (home vs gym) to programme equipment requirements.',
        rows: 5,
      },
      {
        key: 'featureContext',
        label: 'Assessment Interpretation Rules',
        description: 'How should the AI read and interpret coaching intake answers to make recommendations?',
        placeholder: 'If a user selects "weight loss" as their primary goal but also reports joint pain, weight loss is secondary — address the pain first with corrective programming. Experience level "beginner" means 0-6 months. "I want to get stronger" combined with "home training" should suggest bodyweight progressions, not barbell programmes.',
        rows: 5,
      },
      {
        key: 'thingsToNeverDo',
        label: 'Onboarding Boundaries',
        description: 'What should the AI never do or recommend during onboarding?',
        placeholder: 'Never recommend more than one programme at a time. Never suggest a programme that requires equipment the user doesn\'t have access to. Don\'t overwhelm new users with too many habits — start with one or two maximum.',
        rows: 4,
      },
    ],
  },
  {
    id: 'desk_scan',
    label: 'Desk Analyzer',
    icon: Monitor,
    description: 'How the AI analyzes desk setups and provides ergonomic feedback from photos',
    fields: [
      {
        key: 'customGuidelines',
        label: 'Ergonomic Standards',
        description: 'What does a correct desk setup look like? Define your ideal ergonomic standards.',
        placeholder: 'Monitor should be at eye level or slightly below, arm\'s length away. Chair should support lumbar curve with feet flat on the floor. Elbows at 90 degrees when typing. Screen brightness should match room lighting. Top of monitor at or slightly below eye level. Wrists neutral, not bent up or down.',
        rows: 5,
      },
      {
        key: 'featureContext',
        label: 'Common Issues to Flag',
        description: 'What are the most important problems to identify and call out in a desk photo?',
        placeholder: 'Forward head posture (monitor too low or too far). Rounded shoulders from chair height. No lumbar support visible. Screen glare from window placement. Wrists angled upward from keyboard position. Single monitor strain causing neck rotation. Laptop on flat desk without riser.',
        rows: 5,
      },
      {
        key: 'coachingRules',
        label: 'How to Deliver Feedback',
        description: 'How should the AI frame its desk analysis? What tone and approach?',
        placeholder: 'Lead with what they\'re doing well before corrections. Frame issues in terms of impact — "this position adds load to your neck equivalent to carrying a bowling ball." Connect desk posture to their work performance — focus, energy, headaches. Give one quick win they can fix in 30 seconds, then longer-term suggestions.',
        rows: 4,
      },
      {
        key: 'thingsToNeverDo',
        label: 'Desk Analysis Boundaries',
        description: 'What should the AI avoid when analyzing desk setups?',
        placeholder: 'Never recommend buying expensive equipment as the first solution — suggest adjustments with what they have first. Don\'t diagnose medical conditions from a desk photo. Never criticise the user\'s workspace or make them feel judged.',
        rows: 3,
      },
    ],
  },
  {
    id: 'recovery_coach',
    label: 'Recovery Coach',
    icon: Heart,
    description: 'How the AI explains recovery plans and answers follow-up questions after body map assessments',
    fields: [
      {
        key: 'customGuidelines',
        label: 'Recovery Philosophy',
        description: 'Your approach to pain, recovery, and injury management. How should the AI think about recovery?',
        placeholder: 'Movement is medicine — the goal is always to keep people moving within pain-free ranges. Never tell someone to just "rest" without giving them something active they CAN do. Explain the WHY behind every exercise recommendation. Severity 7+ should always include a suggestion to see a professional alongside the plan.',
        rows: 5,
      },
      {
        key: 'featureContext',
        label: 'Pain Education Approach',
        description: 'How should the AI educate users about their pain and body? What frameworks do you use?',
        placeholder: 'Use the "threat vs damage" model — pain doesn\'t always equal tissue damage. Explain that the body adapts to positions you hold most often. Chronic pain often has neurological and stress components. Help users understand that a severity 4-5 doesn\'t mean they\'re broken — it means their body is asking for attention. Frame recovery as "loading the tissue correctly" not "protecting the tissue."',
        rows: 5,
      },
      {
        key: 'coachingRules',
        label: 'Recovery Coaching Rules',
        description: 'Specific rules the AI must follow when coaching recovery.',
        placeholder: 'Always reference what their body map data shows before giving advice. If they have an active programme, suggest how to modify it rather than stopping training. Connect recovery to their daily habits — sleep quality, stress levels, hydration. Ask reflective questions like "How does it feel first thing in the morning vs end of day?"',
        rows: 4,
      },
      {
        key: 'thingsToNeverDo',
        label: 'Recovery Boundaries',
        description: 'What should the AI never say or do when discussing pain and recovery?',
        placeholder: 'Never diagnose a condition — use phrases like "this could suggest" or "this pattern is common with." Never tell someone to push through pain. Don\'t use fear-inducing language like "damage," "wear and tear," or "degeneration." Never contradict the body map outcome guidance — build on it.',
        rows: 4,
      },
    ],
  },
  {
    id: 'nutrition',
    label: 'Nutrition',
    icon: Apple,
    description: 'How the AI suggests meals and adjustments based on macro goals and eating history',
    fields: [
      {
        key: 'customGuidelines',
        label: 'Nutrition Philosophy',
        description: 'Your approach to nutrition coaching and meal guidance.',
        placeholder: 'Focus on practical, quick meals for busy schedules. Emphasise protein and hydration above everything else. Food quality matters but consistency matters more.',
        rows: 4,
      },
      {
        key: 'thingsToNeverDo',
        label: 'Nutrition Boundaries',
        description: 'What the AI should never recommend.',
        placeholder: 'Never suggest restrictive diets or extreme calorie deficits. Don\'t shame eating choices. Never recommend supplements as a replacement for real food.',
        rows: 3,
      },
    ],
  },
  {
    id: 'workout_adaptation',
    label: 'Workout Adapt',
    icon: Dumbbell,
    description: 'How the AI suggests exercise substitutions when body map flags issues',
    fields: [
      {
        key: 'customGuidelines',
        label: 'Substitution Logic',
        description: 'How should the AI decide which exercises to swap and what to replace them with?',
        placeholder: 'When shoulder pain is flagged, replace overhead pressing with landmine press or floor press. Always maintain the training stimulus — swap for the closest movement pattern that avoids the affected area.',
        rows: 4,
      },
      {
        key: 'thingsToNeverDo',
        label: 'Substitution Boundaries',
        description: 'What the AI should never do when adapting workouts.',
        placeholder: 'Never remove an exercise without providing a replacement. Don\'t suggest skipping the workout entirely unless severity is 8+.',
        rows: 3,
      },
    ],
  },
  {
    id: 'check_in_insights',
    label: 'Check-in Insights',
    icon: Activity,
    description: 'How the AI spots patterns in daily check-in data and delivers nudges',
    fields: [
      {
        key: 'customGuidelines',
        label: 'Pattern Recognition Rules',
        description: 'How should the AI interpret check-in trends and communicate insights?',
        placeholder: 'Be encouraging, not alarming. Frame patterns as observations, not diagnoses. Always include one actionable suggestion per insight.',
        rows: 4,
      },
      {
        key: 'thingsToNeverDo',
        label: 'Insight Boundaries',
        description: 'What the AI should avoid when delivering check-in insights.',
        placeholder: 'Never sound like a medical diagnosis. Don\'t catastrophise trends — a few bad days aren\'t a crisis.',
        rows: 3,
      },
    ],
  },
  {
    id: 'burnout_insight',
    label: 'Burnout Index',
    icon: ShieldAlert,
    description: 'How the AI interprets burnout scores, explains levels, and delivers performance insights',
    fields: [
      {
        key: 'customGuidelines',
        label: 'Interpretation Guidelines',
        description: 'How should the AI interpret and communicate burnout index data to users?',
        placeholder: 'Frame everything as patterns and opportunities, never as diagnoses. Reference specific data points (sleep trends, stress patterns, energy levels) rather than making general statements. Always end with one practical micro-suggestion suited to a busy executive.',
        rows: 5,
      },
      {
        key: 'featureContext',
        label: 'Burnout Science Context',
        description: 'Background knowledge the AI should use when interpreting burnout data.',
        placeholder: 'The burnout index is based on the Maslach Burnout Inventory framework. Emotional exhaustion (mapped to stress) is the core dimension. Scores reflect chronic patterns over weeks, not single-day snapshots. Higher scores indicate greater sustained load relative to recovery capacity.',
        rows: 4,
      },
      {
        key: 'coachingRules',
        label: 'Language & Tone Rules',
        description: 'Specific rules for how the AI should speak about burnout-related topics.',
        placeholder: 'Use "load" instead of "burnout". Say "recovery capacity" instead of "risk". Frame scores as "your current trajectory" not "your burnout level". Always suggest what to do, never just flag what is wrong.',
        rows: 4,
      },
      {
        key: 'thingsToNeverDo',
        label: 'Strict Boundaries',
        description: 'What the AI must never do when discussing burnout topics.',
        placeholder: 'Never use the words: burnout, burned out, crisis, critical, danger, alarming, severe, at-risk, diagnosis. Never label the user. Never suggest they are failing. Never use clinical or medical terminology. Never imply they should stop working or take leave.',
        rows: 4,
      },
    ],
  },
];

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (GPT)',
};

export default function AdminAiCoaching() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeFeature, setActiveFeature] = useState('onboarding_recommendations');
  const [feedbackFilter, setFeedbackFilter] = useState<{ feature: string; rating: string }>({ feature: 'all', rating: 'all' });

  const [globalData, setGlobalData] = useState({
    coachingVoice: '',
    customGuidelines: '',
    coachingRules: '',
    thingsToNeverDo: '',
    responseStyle: '',
  });

  const [featureData, setFeatureData] = useState<Record<string, string | boolean>>({
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    customGuidelines: '',
    featureContext: '',
    coachingRules: '',
    thingsToNeverDo: '',
    isActive: true,
  });

  const { data: settings, isLoading } = useQuery<AiCoachingSetting[]>({
    queryKey: ['/api/admin/ai-coaching-settings'],
  });

  const { data: providers } = useQuery<AIProvider[]>({
    queryKey: ['/api/admin/ai-providers'],
  });

  const feedbackUrl = (() => {
    const params = new URLSearchParams();
    if (feedbackFilter.feature !== 'all') params.set('feature', feedbackFilter.feature);
    if (feedbackFilter.rating !== 'all') params.set('rating', feedbackFilter.rating);
    params.set('limit', '50');
    return `/api/admin/ai-feedback?${params.toString()}`;
  })();

  const { data: feedbackData, isLoading: feedbackLoading } = useQuery<Array<{
    id: number; userId: string; feature: string; rating: string;
    aiMessage: string; userMessage: string | null; context: any; createdAt: string;
  }>>({
    queryKey: [feedbackUrl],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/admin/ai-coaching-settings', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-coaching-settings'] });
      toast({ title: "Settings saved" });
    },
    onError: (error: any) => {
      toast({ title: "Error saving settings", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (settings) {
      const globalSetting = settings.find(s => s.feature === 'global');
      if (globalSetting) {
        setGlobalData({
          coachingVoice: globalSetting.coachingVoice || '',
          customGuidelines: globalSetting.customGuidelines || '',
          coachingRules: globalSetting.coachingRules || '',
          thingsToNeverDo: globalSetting.thingsToNeverDo || '',
          responseStyle: globalSetting.responseStyle || '',
        });
      }
    }
  }, [settings]);

  useEffect(() => {
    if (settings) {
      const featureSetting = settings.find(s => s.feature === activeFeature);
      if (featureSetting) {
        setFeatureData({
          provider: featureSetting.provider || 'anthropic',
          model: featureSetting.model || 'claude-sonnet-4-5',
          customGuidelines: featureSetting.customGuidelines || '',
          featureContext: featureSetting.featureContext || '',
          coachingRules: featureSetting.coachingRules || '',
          thingsToNeverDo: featureSetting.thingsToNeverDo || '',
          isActive: featureSetting.isActive ?? true,
        });
      } else {
        setFeatureData({
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
          customGuidelines: '',
          featureContext: '',
          coachingRules: '',
          thingsToNeverDo: '',
          isActive: true,
        });
      }
    }
  }, [settings, activeFeature]);

  const handleProviderChange = (newProvider: string) => {
    const providerConfig = providers?.find(p => p.provider === newProvider);
    const defaultModel = providerConfig?.models[0] || '';
    setFeatureData(prev => ({ ...prev, provider: newProvider, model: defaultModel }));
  };

  const handleSaveGlobal = () => {
    saveMutation.mutate({
      feature: 'global',
      coachingVoice: globalData.coachingVoice,
      customGuidelines: globalData.customGuidelines,
      coachingRules: globalData.coachingRules,
      thingsToNeverDo: globalData.thingsToNeverDo,
      responseStyle: globalData.responseStyle,
      isActive: true,
    });
  };

  const handleSaveFeature = () => {
    saveMutation.mutate({
      feature: activeFeature,
      ...featureData,
    });
  };

  const activeFeatureConfig = FEATURES.find(f => f.id === activeFeature);
  const currentProviderModels = providers?.find(p => p.provider === (featureData.provider as string))?.models || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const positiveCount = feedbackData?.filter(f => f.rating === 'positive').length || 0;
  const negativeCount = feedbackData?.filter(f => f.rating === 'negative').length || 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopHeader
        title="AI Coach"
        onBack={() => navigate("/admin")}
      />

      <main className="p-4 pt-16 space-y-6">
        <Card className="bg-gradient-to-br from-purple-500/20 to-[#0cc9a9]/20 border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Brain className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Train Your AI Coach</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Teach the AI to coach like you. Set your identity, rules, and boundaries globally, then add specific expertise per feature. User feedback automatically shapes future responses.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              <CardTitle className="text-lg">Your Coaching Identity</CardTitle>
            </div>
            <CardDescription>
              This applies to every AI interaction across the platform. The more detail you provide, the more the AI sounds like you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="globalVoice" className="font-medium flex items-center gap-2">
                <PenLine className="h-4 w-4 text-muted-foreground" />
                Voice & Persona
              </Label>
              <p className="text-xs text-muted-foreground">
                How do you talk to clients? Your tone, personality, typical phrases. The AI will mirror this in every response.
              </p>
              <Textarea
                id="globalVoice"
                placeholder="I'm a direct but supportive performance coach. I speak in plain terms, avoid jargon, and always explain the 'why' behind my recommendations. I often say things like 'Your body adapts to positions you hold most often' and 'Small changes compound over time.' I'm encouraging but honest — I won't sugarcoat things."
                value={globalData.coachingVoice}
                onChange={(e) => setGlobalData(prev => ({ ...prev, coachingVoice: e.target.value }))}
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="globalGuidelines" className="font-medium flex items-center gap-2">
                <Brain className="h-4 w-4 text-muted-foreground" />
                Core Philosophy & Methodology
              </Label>
              <p className="text-xs text-muted-foreground">
                What do you believe in? Your coaching methodology, values, and the principles that guide every recommendation.
              </p>
              <Textarea
                id="globalGuidelines"
                placeholder="Movement is medicine. Every recommendation should consider the whole person — their stress, sleep, workload, and goals. I never use shame or guilt as motivators. Safety comes first, then performance. For busy executives, I prioritise efficiency and sustainability over intensity. I believe in minimum effective dose — do just enough to progress, don't overload."
                value={globalData.customGuidelines}
                onChange={(e) => setGlobalData(prev => ({ ...prev, customGuidelines: e.target.value }))}
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="globalRules" className="font-medium flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                Rules & Constraints
              </Label>
              <p className="text-xs text-muted-foreground">
                Non-negotiable rules the AI must always follow. These override everything else.
              </p>
              <Textarea
                id="globalRules"
                placeholder="Always prioritise pain-free movement over performance goals. If someone reports severity 7+ pain, suggest seeing a professional. Never give specific medical advice or diagnose conditions. Always ask at least one reflective question to help the user think. Reference their actual data (sleep, check-ins, body map) when giving advice — don't be generic. Keep responses concise — busy executives don't read essays."
                value={globalData.coachingRules}
                onChange={(e) => setGlobalData(prev => ({ ...prev, coachingRules: e.target.value }))}
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="globalNever" className="font-medium flex items-center gap-2">
                <Ban className="h-4 w-4 text-red-400" />
                Things to Never Do
              </Label>
              <p className="text-xs text-muted-foreground">
                Hard boundaries. The AI will never cross these lines regardless of what the user asks.
              </p>
              <Textarea
                id="globalNever"
                placeholder="Never diagnose medical conditions. Never use fear-based language like 'damage,' 'wear and tear,' or 'degeneration.' Never recommend extreme diets or fasting protocols. Never shame someone for missing workouts or poor habits. Never give advice outside your scope — always redirect to a professional. Never make up data or reference things that aren't in the user's actual records."
                value={globalData.thingsToNeverDo}
                onChange={(e) => setGlobalData(prev => ({ ...prev, thingsToNeverDo: e.target.value }))}
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="globalStyle" className="font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Response Style & Format
              </Label>
              <p className="text-xs text-muted-foreground">
                How should responses be structured? Length, formatting, use of bullet points, emojis, etc.
              </p>
              <Textarea
                id="globalStyle"
                placeholder="Keep responses conversational and under 200 words unless the topic needs depth. Use bullet points for action items. Lead with empathy or acknowledgement before giving advice. End with a question or clear next step. No emojis. Use bold for key takeaways. Break long responses into short paragraphs — no walls of text."
                value={globalData.responseStyle}
                onChange={(e) => setGlobalData(prev => ({ ...prev, responseStyle: e.target.value }))}
                rows={4}
              />
            </div>

            <Button
              onClick={handleSaveGlobal}
              disabled={saveMutation.isPending}
              className="w-full"
              variant="outline"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? 'Saving...' : 'Save Coaching Identity'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-[#0cc9a9]" />
            <h2 className="text-lg font-semibold text-foreground">Feature-Specific Expertise</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Each AI feature needs different knowledge. Add the specific expertise, rules, and context for each area below.
          </p>
        </div>

        <Tabs value={activeFeature} onValueChange={setActiveFeature}>
          <div className="overflow-x-auto -mx-4 px-4">
            <TabsList className="w-max gap-1">
              {FEATURES.map(feature => (
                <TabsTrigger key={feature.id} value={feature.id} className="flex items-center gap-1.5 text-xs whitespace-nowrap" disabled={feature.comingSoon}>
                  <feature.icon className="h-3.5 w-3.5" />
                  {feature.label}
                  {feature.comingSoon && <span className="text-[9px] opacity-50">Soon</span>}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {FEATURES.filter(f => !f.comingSoon).map(feature => (
            <TabsContent key={feature.id} value={feature.id} className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <feature.icon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{feature.label}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`active-${feature.id}`} className="text-xs text-muted-foreground">Active</Label>
                      <Switch
                        id={`active-${feature.id}`}
                        checked={featureData.isActive as boolean}
                        onCheckedChange={(checked) => setFeatureData(prev => ({ ...prev, isActive: checked }))}
                      />
                    </div>
                  </div>
                  <CardDescription className="text-xs">{feature.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Card className="bg-muted/50 border-border">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-[#0cc9a9]" />
                        <Label className="font-medium text-sm">AI Provider & Model</Label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Provider</Label>
                          <Select value={featureData.provider as string} onValueChange={handleProviderChange}>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {providers?.map(p => (
                                <SelectItem key={p.provider} value={p.provider}>
                                  {PROVIDER_LABELS[p.provider] || p.provider}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Model</Label>
                          <Select value={featureData.model as string} onValueChange={(val) => setFeatureData(prev => ({ ...prev, model: val }))}>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {currentProviderModels.map(m => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {feature.fields.map(field => (
                    <div key={field.key} className="space-y-2">
                      <Label className="font-medium">{field.label}</Label>
                      <p className="text-xs text-muted-foreground">{field.description}</p>
                      <Textarea
                        placeholder={field.placeholder}
                        value={(featureData[field.key] as string) || ''}
                        onChange={(e) => setFeatureData(prev => ({ ...prev, [field.key]: e.target.value }))}
                        rows={field.rows || 4}
                      />
                    </div>
                  ))}

                  <Button
                    onClick={handleSaveFeature}
                    className="w-full"
                    disabled={saveMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saveMutation.isPending ? 'Saving...' : `Save ${feature.label} Settings`}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">AI Self-Learning</CardTitle>
            </div>
            <CardDescription>
              User feedback is automatically fed back into the AI. Thumbs up responses become examples to follow. Thumbs down responses become patterns to avoid. The AI learns and improves with every rating.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-foreground">How it works</p>
              <p className="text-xs text-muted-foreground">
                When users rate responses, the AI automatically sees recent feedback examples in its next conversation. Positive-rated responses become "do more of this" examples. Negative-rated responses become "avoid this" examples. No manual action needed — the AI coaches itself based on real user reactions.
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Select
                value={feedbackFilter.feature}
                onValueChange={(v) => setFeedbackFilter(prev => ({ ...prev, feature: v }))}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All features" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Features</SelectItem>
                  <SelectItem value="recovery_coach">Recovery Coach</SelectItem>
                  <SelectItem value="coach_chat">Coach Chat</SelectItem>
                  <SelectItem value="desk_analyzer">Desk Analyzer</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={feedbackFilter.rating}
                onValueChange={(v) => setFeedbackFilter(prev => ({ ...prev, rating: v }))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All ratings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ratings</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {feedbackLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : feedbackData && feedbackData.length > 0 ? (
              <div className="space-y-3">
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-3.5 w-3.5 text-green-500" />
                    {positiveCount} liked
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsDown className="h-3.5 w-3.5 text-red-500" />
                    {negativeCount} disliked
                  </span>
                  <span className="text-xs text-muted-foreground/70">
                    AI is learning from these
                  </span>
                </div>
                {feedbackData.map((fb) => (
                  <div key={fb.id} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {fb.rating === 'positive' ? (
                          <ThumbsUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <ThumbsDown className="h-4 w-4 text-red-500" />
                        )}
                        <Badge variant="outline" className="text-xs capitalize">
                          {fb.feature.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {fb.createdAt ? new Date(fb.createdAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                    {fb.userMessage && (
                      <div className="text-xs">
                        <span className="text-muted-foreground font-medium">User asked: </span>
                        <span className="text-foreground">{fb.userMessage}</span>
                      </div>
                    )}
                    <div className="text-xs">
                      <span className="text-muted-foreground font-medium">AI responded: </span>
                      <span className="text-foreground/80 line-clamp-3">{fb.aiMessage}</span>
                    </div>
                    {fb.context && typeof fb.context === 'object' && (
                      <div className="text-xs text-muted-foreground/70">
                        {(fb.context as any).bodyArea && (
                          <span>Area: {(fb.context as any).bodyArea}</span>
                        )}
                        {(fb.context as any).severity && (
                          <span className="ml-2">Severity: {(fb.context as any).severity}/10</span>
                        )}
                        {(fb.context as any).score && (
                          <span className="ml-2">Score: {(fb.context as any).score}/10</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No feedback yet. Once users rate AI responses, the AI will start learning from their reactions automatically.
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
