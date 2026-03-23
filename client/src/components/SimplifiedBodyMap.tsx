import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { SeveritySlider } from "@/components/SeveritySlider";
import { ArrowLeft, Zap, Dumbbell, Calendar } from "lucide-react";
import regionData from "@/data/bodymap_regions.json";

interface BodyRegion {
  id: string;
  label: string;
  group: string;
  region: string;
  side: string | null;
  position: {
    front: RegionPosition | null;
    back: RegionPosition | null;
  };
  screeningQuestions: ScreeningQuestion[];
  suggestions: RegionSuggestions;
}

interface RegionPosition {
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  type: "ellipse" | "rect";
}

interface ScreeningQuestion {
  id: string;
  question: string;
  type: "radio";
  options: string[];
}

interface RegionSuggestions {
  stretches: string[];
  modifications: string[];
  recoveryPlan: string[];
}

const bodyRegions: BodyRegion[] = regionData.regions as BodyRegion[];

export default function SimplifiedBodyMap() {
  const [selectedRegion, setSelectedRegion] = useState<BodyRegion | null>(null);
  const [selectedSide, setSelectedSide] = useState<'left' | 'right' | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [severity, setSeverity] = useState([5]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [bodyView, setBodyView] = useState<'front' | 'back'>('front');

  const handleRegionClick = (regionId: string) => {
    const region = bodyRegions.find(r => r.id === regionId);
    if (region) {
      setSelectedRegion(region);
      setSelectedSide(region.side as 'left' | 'right' | null);
      setIsZoomed(true);
      setResponses({});
      setShowSuggestions(false);
    }
  };

  const handleBackToFullView = () => {
    setIsZoomed(false);
    setSelectedRegion(null);
    setSelectedSide(null);
    setShowSuggestions(false);
  };

  const handleResponseChange = (questionId: string, value: string) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  const handleGetSuggestions = () => {
    setShowSuggestions(true);
  };

  const getSeverityColor = (severity: number) => {
    if (severity >= 7) return "text-red-600";
    if (severity >= 4) return "text-[#0cc9a9]";
    return "text-green-600";
  };

  const getSeverityDescription = (severity: number) => {
    if (severity >= 7) return "Severe";
    if (severity >= 4) return "Moderate";
    return "Mild";
  };

  const renderRegionShape = (region: BodyRegion, view: 'front' | 'back') => {
    const position = region.position[view];
    if (!position) return null;

    const commonProps = {
      fill: "rgba(59, 130, 246, 0.0)",
      stroke: "rgba(59, 130, 246, 0.3)",
      strokeWidth: "1",
      className: "cursor-pointer transition-all duration-200 hover:fill-blue-200/50 hover:stroke-blue-500",
      onClick: () => handleRegionClick(region.id),
      key: region.id
    };

    if (position.type === "ellipse") {
      return (
        <ellipse
          cx={position.cx}
          cy={position.cy}
          rx={position.rx}
          ry={position.ry}
          {...commonProps}
        >
          <title>Click to assess {region.label}</title>
        </ellipse>
      );
    } else if (position.type === "rect") {
      return (
        <rect
          x={position.x}
          y={position.y}
          width={position.width}
          height={position.height}
          rx={position.rx || 0}
          {...commonProps}
        >
          <title>Click to assess {region.label}</title>
        </rect>
      );
    }
    return null;
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Body Map Card */}
        <Card>
          <CardHeader>
            <CardTitle>
              Body Map
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative w-full max-w-sm mx-auto bg-gray-50 rounded-lg p-4">
              {/* Front/Back Toggle */}
              {!isZoomed && (
                <div className="flex justify-center mb-4">
                  <div className="flex rounded-lg bg-white border p-1">
                    <Button
                      variant={bodyView === 'front' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setBodyView('front')}
                      className="text-xs px-3"
                    >
                      Front
                    </Button>
                    <Button
                      variant={bodyView === 'back' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setBodyView('back')}
                      className="text-xs px-3"
                    >
                      Back
                    </Button>
                  </div>
                </div>
              )}
              
              <svg
                viewBox="0 0 200 350"
                className={`w-full h-auto transition-transform duration-500 ${
                  isZoomed ? 'scale-110' : 'scale-100'
                }`}
              >
                <defs>
                  <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#93C5FD" />
                    <stop offset="50%" stopColor="#60A5FA" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                  <filter id="bodyGlow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge> 
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                {/* Clean anatomical human figure */}
                <g filter="url(#bodyGlow)" opacity="0.9">
                  {/* Head */}
                  <ellipse cx="100" cy="30" rx="18" ry="22" fill="url(#bodyGradient)" />
                  
                  {/* Neck */}
                  <rect x="92" y="52" width="16" height="15" rx="8" fill="url(#bodyGradient)" />
                  
                  {/* Torso */}
                  <path d="M 75 67 Q 100 65 125 67 L 125 130 Q 125 140 115 145 L 85 145 Q 75 140 75 130 Z" fill="url(#bodyGradient)" />
                  
                  {/* Arms */}
                  <ellipse cx="60" cy="85" rx="12" ry="35" fill="url(#bodyGradient)" />
                  <ellipse cx="140" cy="85" rx="12" ry="35" fill="url(#bodyGradient)" />
                  <ellipse cx="50" cy="135" rx="8" ry="25" fill="url(#bodyGradient)" />
                  <ellipse cx="150" cy="135" rx="8" ry="25" fill="url(#bodyGradient)" />
                  
                  {/* Hands */}
                  <ellipse cx="50" cy="165" rx="6" ry="12" fill="url(#bodyGradient)" />
                  <ellipse cx="150" cy="165" rx="6" ry="12" fill="url(#bodyGradient)" />
                  
                  {/* Hips/Pelvis */}
                  <ellipse cx="100" cy="165" rx="25" ry="20" fill="url(#bodyGradient)" />
                  
                  {/* Thighs */}
                  <ellipse cx="85" cy="210" rx="12" ry="35" fill="url(#bodyGradient)" />
                  <ellipse cx="115" cy="210" rx="12" ry="35" fill="url(#bodyGradient)" />
                  
                  {/* Calves */}
                  <ellipse cx="85" cy="270" rx="10" ry="30" fill="url(#bodyGradient)" />
                  <ellipse cx="115" cy="270" rx="10" ry="30" fill="url(#bodyGradient)" />
                  
                  {/* Feet */}
                  <ellipse cx="85" cy="310" rx="8" ry="10" fill="url(#bodyGradient)" />
                  <ellipse cx="115" cy="310" rx="8" ry="10" fill="url(#bodyGradient)" />
                </g>

                {/* Clickable regions from JSON */}
                {bodyRegions
                  .filter(region => region.position[bodyView] !== null)
                  .map(region => renderRegionShape(region, bodyView))
                }
              </svg>
              
              {/* Pain Scale Reference */}
              {!isZoomed && (
                <div className="mt-4 text-center">
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="font-medium mb-2">Pain Scale</div>
                    <div className="flex justify-center gap-4 text-xs">
                      <span className="text-green-600">1-3: Mild</span>
                      <span className="text-[#0cc9a9]">4-6: Moderate</span>
                      <span className="text-red-600">7-10: Severe</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Screening Questions Panel */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedRegion ? 
                `${selectedRegion.label} Assessment` : 
                "Select a region"
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedRegion ? (
              <div className="text-center text-gray-500 py-8">
                <p className="mb-4">Click on a body region to start your assessment</p>
                <div className="grid grid-cols-2 gap-2">
                  {bodyRegions.map((region) => (
                    <Badge
                      key={region.id}
                      variant="outline"
                      className="cursor-pointer hover:bg-blue-50"
                      onClick={() => handleRegionClick(region.id)}
                    >
                      {region.label}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Severity Assessment */}
                <div>
                  <Label className="text-base font-medium mb-4 block">
                    How would you rate your current discomfort level?
                  </Label>
                  <SeveritySlider
                    value={severity}
                    onValueChange={(value: number[] | number) => {
                      setSeverity(Array.isArray(value) ? value : [value]);
                    }}
                    className="mb-2"
                  />
                  <p className={`text-sm font-medium ${getSeverityColor(severity[0])}`}>
                    {severity[0]}/10 - {getSeverityDescription(severity[0])} discomfort
                  </p>
                  
                  {/* Pain Scale Reference */}
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-700 mb-2">Pain Scale Reference:</p>
                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span className="text-green-600 font-medium">1-3: Mild</span>
                        <span>Minor discomfort, doesn't interfere with activities</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#0cc9a9] font-medium">4-6: Moderate</span>
                        <span>Noticeable pain, some interference with activities</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-red-600 font-medium">7-10: Severe</span>
                        <span>Significant pain, major interference with activities</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Screening Questions */}
                <div className="space-y-4">
                  {selectedRegion.screeningQuestions.map((question) => (
                    <div key={question.id}>
                      <Label className="text-sm font-medium mb-3 block">
                        {question.question}
                      </Label>
                      <RadioGroup
                        onValueChange={(value) => handleResponseChange(question.id, value)}
                        value={responses[question.id] || ""}
                      >
                        {question.options.map((option) => (
                          <div key={option} className="flex items-center space-x-2">
                            <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                            <Label 
                              htmlFor={`${question.id}-${option}`}
                              className="text-sm cursor-pointer"
                            >
                              {option}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button 
                    onClick={handleBackToFullView}
                    variant="outline"
                    className="flex-1"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Map
                  </Button>
                  <Button 
                    onClick={handleGetSuggestions}
                    className="flex-1"
                    disabled={Object.keys(responses).length === 0}
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Get Suggestions
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Suggestions Dialog */}
      <Dialog open={showSuggestions} onOpenChange={setShowSuggestions}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Recovery Plan for {selectedRegion?.label}
            </DialogTitle>
          </DialogHeader>
          
          {selectedRegion && (
            <div className="space-y-6">
              {/* Severity Badge */}
              <div className="flex items-center gap-2">
                <Badge 
                  variant="secondary" 
                  className={`${getSeverityColor(severity[0])} border-current`}
                >
                  {severity[0]}/10 - {getSeverityDescription(severity[0])} Discomfort
                </Badge>
              </div>

              {/* Stretches Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <Zap className="w-5 h-5 mr-2 text-blue-600" />
                  Recommended Stretches
                </h3>
                <ul className="space-y-2">
                  {selectedRegion.suggestions.stretches.map((stretch, index) => (
                    <li key={index} className="flex items-start">
                      <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      {stretch}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Training Modifications */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <Dumbbell className="w-5 h-5 mr-2 text-orange-600" />
                  Training Modifications
                </h3>
                <ul className="space-y-2">
                  {selectedRegion.suggestions.modifications.map((modification, index) => (
                    <li key={index} className="flex items-start">
                      <span className="w-2 h-2 bg-orange-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      {modification}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 6-Week Recovery Plan */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-green-600" />
                  6-Week Recovery Plan
                </h3>
                <ul className="space-y-2">
                  {selectedRegion.suggestions.recoveryPlan.map((week, index) => (
                    <li key={index} className="flex items-start">
                      <span className="w-2 h-2 bg-green-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      {week}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}