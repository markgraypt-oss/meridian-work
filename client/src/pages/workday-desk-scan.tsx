import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Camera, 
  Upload, 
  Loader2, 
  Sparkles,
  Monitor,
  Armchair,
  ArrowUpDown,
  Check,
  ImageIcon,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Target
} from "lucide-react";

type PositionType = "seated" | "standing" | "alternative";

interface AnalysisIssue {
  category: string;
  status: "good" | "needs_improvement" | "critical";
  observation: string;
  recommendation: string;
}

interface AnalysisResult {
  score: number;
  summary: string;
  issues: AnalysisIssue[];
  priorityFixes: string[];
  rawResponse?: string;
}

function getStatusColor(status: string) {
  switch (status) {
    case "critical": return { dot: "bg-red-500", border: "border-red-500/40", badge: "bg-red-500/15 text-red-400 border-red-500/30", label: "High" };
    case "needs_improvement": return { dot: "bg-[#0cc9a9]", border: "border-[#0cc9a9]/40", badge: "bg-[#0cc9a9]/15 text-[#0cc9a9] border-[#0cc9a9]/30", label: "Medium" };
    case "good": return { dot: "bg-emerald-500", border: "border-emerald-500/40", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Good" };
    default: return { dot: "bg-gray-500", border: "border-gray-500/40", badge: "bg-gray-500/15 text-gray-400 border-gray-500/30", label: "Info" };
  }
}

function ScoreRing({ score }: { score: number }) {
  const [animatedOffset, setAnimatedOffset] = useState<number | null>(null);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (score / 10) * circumference;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setAnimatedOffset(targetOffset);
    });
    return () => cancelAnimationFrame(frame);
  }, [targetOffset]);

  const getStrokeColor = () => {
    if (score >= 8) return "#10b981";
    if (score >= 5) return "#0cc9a9";
    return "#ef4444";
  };

  return (
    <div className="relative w-[100px] h-[100px] flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={radius} fill="none"
          stroke={getStrokeColor()}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animatedOffset === null ? circumference : animatedOffset}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-3xl font-bold text-foreground">{score}</span>
      </div>
    </div>
  );
}

export default function WorkdayDeskScan() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  
  const [positionType, setPositionType] = useState<PositionType>("seated");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showPhotoTips, setShowPhotoTips] = useState(false);
  const [pendingAction, setPendingAction] = useState<"camera" | "upload" | null>(null);
  const [deskFeedback, setDeskFeedback] = useState<'positive' | 'negative' | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitDeskFeedback = async (rating: 'positive' | 'negative') => {
    if (deskFeedback) return;
    setDeskFeedback(rating);
    try {
      await apiRequest('POST', '/api/ai-feedback', {
        feature: 'desk_analyzer',
        rating,
        aiMessage: analysis?.summary || '',
        context: { score: analysis?.score, positionType },
      });
    } catch {}
  };

  const analyzeMutation = useMutation({
    mutationFn: async (data: { imageBase64: string; positionType: string }): Promise<{ scanId: number; analysis: AnalysisResult }> => {
      const response = await apiRequest('POST', '/api/workday/analyze-desk', data);
      return response.json();
    },
    onSuccess: (data: { scanId: number; analysis: AnalysisResult }) => {
      setAnalysis(data.analysis);
      queryClient.invalidateQueries({ queryKey: ['/api/workday/scans'] });
      toast({ 
        title: "Analysis complete!", 
        description: `Your desk scored ${data.analysis.score || 'N/A'}/10` 
      });
    },
    onError: () => {
      toast({ 
        title: "Analysis failed", 
        description: "Please try again with a clearer image",
        variant: "destructive"
      });
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setImagePreview(base64);
        setAnalysis(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = () => {
    if (!imagePreview) {
      toast({ title: "Please upload an image first", variant: "destructive" });
      return;
    }
    analyzeMutation.mutate({ imageBase64: imagePreview, positionType });
  };

  const handleUploadClick = (action: "camera" | "upload") => {
    setPendingAction(action);
    setShowPhotoTips(true);
  };

  const handleProceedWithPhoto = () => {
    setShowPhotoTips(false);
    if (fileInputRef.current && pendingAction) {
      if (pendingAction === "camera") {
        fileInputRef.current.setAttribute('capture', 'environment');
      } else {
        fileInputRef.current.removeAttribute('capture');
      }
      fileInputRef.current.click();
    }
    setPendingAction(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0cc9a9]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopHeader 
        title="AI Desk Analyzer" 
        onBack={() => navigate("/recovery/desk-health")} 
      />
      
      <main className="px-4 pt-14 pb-4 space-y-6">
        <Card className="bg-gradient-to-br from-[#0cc9a9]/20 to-[#0cc9a9]/5 border-[#0cc9a9]/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="h-5 w-5 text-[#0cc9a9]" />
              <h2 className="font-semibold text-[#0cc9a9]">AI-Powered Analysis</h2>
            </div>
            <p className="text-sm text-foreground/80">
              Upload a photo of your desk setup and our AI will analyze your ergonomics, 
              providing personalized recommendations to reduce pain and improve productivity.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h3 className="font-medium text-foreground">Select Your Position</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { type: "seated" as PositionType, label: "Seated", icon: Armchair },
              { type: "standing" as PositionType, label: "Standing", icon: ArrowUpDown },
              { type: "alternative" as PositionType, label: "Other", icon: Monitor },
            ].map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => setPositionType(type)}
                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                  positionType === type
                    ? "border-[#0cc9a9] bg-[#0cc9a9]/10"
                    : "border-border bg-card hover:border-gray-600"
                }`}
              >
                <Icon className={`h-6 w-6 ${positionType === type ? "text-[#0cc9a9]" : "text-muted-foreground"}`} />
                <span className={`text-sm ${positionType === type ? "text-foreground" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {imagePreview ? (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden">
                  <img 
                    src={imagePreview} 
                    alt="Desk preview" 
                    className="w-full h-64 object-cover"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setImagePreview(null);
                      setAnalysis(null);
                    }}
                    className="absolute top-3 right-3"
                  >
                    Change
                  </Button>
                </div>
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzeMutation.isPending}
                  className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/80 text-black"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analyze My Setup
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-600 rounded-xl p-6 text-center">
                  <div className="flex flex-col items-center gap-3 mb-4">
                    <div className="p-4 rounded-full bg-[#0cc9a9]/10">
                      <Camera className="h-8 w-8 text-[#0cc9a9]" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Capture your full desk setup including monitor, chair, and keyboard
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 border-[#0cc9a9] text-[#0cc9a9] hover:bg-[#0cc9a9]/10"
                      onClick={() => handleUploadClick("upload")}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </Button>
                    <Button
                      className="flex-1 bg-[#0cc9a9] hover:bg-[#0cc9a9]/80 text-black"
                      onClick={() => handleUploadClick("camera")}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Take Photo
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {analysis && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="h-4 w-4 text-[#0cc9a9]" />
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">AI desk scan results</span>
                </div>

                <Card className="bg-background/50 border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <ScoreRing score={analysis.score || 0} />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-[#0cc9a9]">
                          Ergonomic score: {analysis.score || 0}/10
                        </h3>
                        <p className="text-sm text-foreground/70 mt-1">
                          {analysis.summary}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground mr-1">Was this helpful?</span>
                  <button
                    onClick={() => submitDeskFeedback('positive')}
                    className={`p-1.5 rounded-md transition-colors ${deskFeedback === 'positive' ? 'text-green-500 bg-green-500/10' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
                    disabled={!!deskFeedback}
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => submitDeskFeedback('negative')}
                    className={`p-1.5 rounded-md transition-colors ${deskFeedback === 'negative' ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
                    disabled={!!deskFeedback}
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>

            {analysis.issues && analysis.issues.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Priority Fixes
                </h3>
                {[...analysis.issues]
                  .sort((a, b) => {
                    const order = { critical: 0, needs_improvement: 1, good: 2 };
                    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
                  })
                  .map((issue, index) => {
                    const colors = getStatusColor(issue.status);
                    const isExpanded = expandedIssue === index;
                    const isExpandable = issue.status !== "good";
                    return (
                      <Card
                        key={index}
                        className={`bg-card border ${colors.border} transition-all`}
                      >
                        <CardContent className="p-0">
                          <div
                            role={isExpandable ? "button" : undefined}
                            tabIndex={isExpandable ? 0 : undefined}
                            onClick={() => isExpandable && setExpandedIssue(isExpanded ? null : index)}
                            onKeyDown={(e) => isExpandable && (e.key === "Enter" || e.key === " ") && setExpandedIssue(isExpanded ? null : index)}
                            className={`w-full p-4 text-left ${isExpandable ? "cursor-pointer" : ""}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-2.5 h-2.5 rounded-full ${colors.dot} mt-1.5 flex-shrink-0`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground/90 leading-relaxed">
                                  {issue.observation}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${colors.badge}`}>
                                  {colors.label}
                                </span>
                                {isExpandable && (
                                  isExpanded 
                                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </div>

                          {isExpanded && issue.status !== "good" && (
                            <div className="px-4 pb-4 pt-0 animate-in fade-in slide-in-from-top-2 duration-200">
                              <div className="ml-5 pl-3 border-l-2 border-[#0cc9a9]/30">
                                <p className="text-sm text-foreground/70 mb-3">
                                  {issue.recommendation}
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-[#0cc9a9]/50 text-[#0cc9a9] hover:bg-[#0cc9a9]/10 hover:text-[#0cc9a9]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate("/recovery/desk-health/positions");
                                  }}
                                >
                                  View fix
                                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            )}

            {analysis.rawResponse && !analysis.issues && (
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground mb-3">Analysis</h3>
                  <p className="text-foreground/80 whitespace-pre-wrap">{analysis.rawResponse}</p>
                </CardContent>
              </Card>
            )}

            <div className="pt-2">
              <Button
                className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/80 text-black h-12"
                onClick={() => navigate("/recovery/desk-health/positions")}
              >
                Explore Working Positions
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Set up your ideal position rotation to stay comfortable all day
              </p>
            </div>
          </div>
        )}
      </main>

      <Dialog open={showPhotoTips} onOpenChange={setShowPhotoTips}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-[#0cc9a9]" />
              Photo Tips
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-xl p-8 flex items-center justify-center border-2 border-dashed border-gray-600">
              <div className="text-center">
                <Monitor className="h-16 w-16 text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Example image placeholder</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-foreground">For the best analysis, include:</h4>
              <ul className="space-y-2">
                {[
                  "Your monitor at its normal position",
                  "Keyboard and mouse visible",
                  "Your chair (back and armrests)",
                  "Overall desk layout clearly framed",
                  "Good lighting (avoid glare)"
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-[#0cc9a9]/10 border border-[#0cc9a9] rounded-lg p-3">
              <p className="text-sm text-[#0cc9a9]">
                <strong>Tip:</strong> Stand back 3-4 feet to capture your entire setup in frame.
              </p>
            </div>

            <Button 
              className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/80 text-black"
              onClick={handleProceedWithPhoto}
            >
              {pendingAction === "camera" ? (
                <>
                  <Camera className="h-4 w-4 mr-2" />
                  Open Camera
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
