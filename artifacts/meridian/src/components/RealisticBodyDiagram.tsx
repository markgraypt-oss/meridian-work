import { useState } from "react";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BodyMapLog } from "@shared/schema";

interface RealisticBodyDiagramProps {
  view: "front" | "back";
  onBodyPartClick: (bodyPart: string, x: number, y: number, view: "front" | "back") => void;
  existingLogs: BodyMapLog[];
  onViewToggle: () => void;
}

export default function RealisticBodyDiagram({ 
  view, 
  onBodyPartClick, 
  existingLogs, 
  onViewToggle 
}: RealisticBodyDiagramProps) {
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const getPainColor = (severity: number) => {
    if (severity >= 7) return "#dc2626"; // red-600
    if (severity >= 4) return "#0cc9a9"; // yellow-500
    return "#16a34a"; // green-600
  };

  const getBodyPartLogs = (bodyPart: string) => {
    return existingLogs.filter(log => 
      log.bodyPart === bodyPart && log.view === view
    ).sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  };

  const getBodyPartColor = (bodyPart: string) => {
    const logs = getBodyPartLogs(bodyPart);
    if (logs.length === 0) return "rgba(59, 130, 246, 0.15)"; // blue-500 with low opacity
    return getPainColor(logs[0].severity);
  };

  const handleBodyPartClick = (bodyPart: string, event: React.MouseEvent<SVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const svg = event.currentTarget.closest('svg')!;
    const svgRect = svg.getBoundingClientRect();
    
    const x = ((event.clientX - svgRect.left) / svgRect.width) * 100;
    const y = ((event.clientY - svgRect.top) / svgRect.height) * 100;
    
    onBodyPartClick(bodyPart, x, y, view);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.2, 2.5));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.2, 0.5));
  };

  const resetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Natural human body parts with soft, organic curves
  const bodyParts = {
    front: [
      // Head with natural curves
      { 
        name: "Head", 
        path: "M200,30 Q215,22 235,20 Q255,22 270,30 Q280,40 282,55 Q281,70 275,80 Q265,88 250,92 Q235,94 220,92 Q205,88 195,80 Q189,70 188,55 Q190,40 200,30 Z",
        x: 235, y: 55 
      },
      { 
        name: "Jaw", 
        path: "M208,78 Q225,83 242,83 Q258,83 262,78 Q264,85 258,90 Q250,93 235,94 Q220,93 212,90 Q206,85 208,78 Z",
        x: 235, y: 86 
      },
      // Neck with natural taper
      { 
        name: "Neck", 
        path: "M220,92 Q235,95 250,92 Q252,100 250,108 Q248,115 245,118 Q235,122 225,118 Q222,115 220,108 Q218,100 220,92 Z",
        x: 235, y: 105 
      },
      // Torso with natural body shape
      { 
        name: "Chest", 
        path: "M180,118 Q200,112 235,110 Q270,112 290,118 Q295,135 292,155 Q288,170 285,180 Q275,185 260,186 Q235,187 210,186 Q195,185 185,180 Q182,170 178,155 Q175,135 180,118 Z",
        x: 235, y: 150 
      },
      { 
        name: "Abdomen", 
        path: "M185,180 Q210,178 235,179 Q260,178 285,180 Q287,195 285,210 Q282,225 278,238 Q270,245 255,247 Q235,248 215,247 Q200,245 192,238 Q188,225 185,210 Q183,195 185,180 Z",
        x: 235, y: 214 
      },
      { 
        name: "Lower Back", 
        path: "M200,238 Q218,235 235,236 Q252,235 270,238 Q272,250 270,262 Q267,275 263,285 Q255,290 240,291 Q235,291 230,291 Q215,290 207,285 Q203,275 200,262 Q198,250 200,238 Z",
        x: 235, y: 264 
      },
      // Arms with natural muscle curves
      { 
        name: "Left Shoulder", 
        path: "M155,118 Q165,115 175,118 Q182,125 180,135 Q178,145 175,152 Q170,158 165,155 Q158,150 155,142 Q152,130 155,118 Z",
        x: 167, y: 135 
      },
      { 
        name: "Right Shoulder", 
        path: "M295,118 Q305,115 315,118 Q318,130 315,142 Q312,150 305,155 Q300,158 295,152 Q292,145 290,135 Q288,125 295,118 Z",
        x: 303, y: 135 
      },
      { 
        name: "Left Upper Arm", 
        path: "M165,155 Q170,152 175,155 Q178,165 176,180 Q174,195 170,205 Q165,210 158,205 Q155,195 153,180 Q155,165 165,155 Z",
        x: 165, y: 180 
      },
      { 
        name: "Right Upper Arm", 
        path: "M295,155 Q305,152 315,155 Q315,165 317,180 Q315,195 312,205 Q305,210 298,205 Q295,195 296,180 Q294,165 295,155 Z",
        x: 305, y: 180 
      },
      { 
        name: "Left Elbow", 
        path: "M158,205 Q165,202 170,205 Q172,210 170,215 Q168,220 165,222 Q160,224 155,222 Q152,220 150,215 Q152,210 158,205 Z",
        x: 161, y: 213 
      },
      { 
        name: "Right Elbow", 
        path: "M298,205 Q305,202 312,205 Q318,210 320,215 Q318,220 315,222 Q310,224 305,222 Q302,220 298,215 Q296,210 298,205 Z",
        x: 309, y: 213 
      },
      { 
        name: "Left Forearm", 
        path: "M155,222 Q160,220 165,222 Q167,235 165,250 Q163,265 160,275 Q155,280 150,275 Q147,265 145,250 Q147,235 155,222 Z",
        x: 156, y: 251 
      },
      { 
        name: "Right Forearm", 
        path: "M305,222 Q310,220 315,222 Q323,235 325,250 Q323,265 320,275 Q315,280 310,275 Q307,265 305,250 Q303,235 305,222 Z",
        x: 314, y: 251 
      },
      { 
        name: "Left Wrist", 
        path: "M150,275 Q155,272 160,275 Q162,280 160,285 Q158,290 155,292 Q150,294 145,292 Q142,290 140,285 Q142,280 150,275 Z",
        x: 151, y: 283 
      },
      { 
        name: "Right Wrist", 
        path: "M310,275 Q315,272 320,275 Q328,280 330,285 Q328,290 325,292 Q320,294 315,292 Q312,290 310,285 Q308,280 310,275 Z",
        x: 319, y: 283 
      },
      { 
        name: "Left Hand", 
        path: "M145,292 Q150,290 155,292 Q157,300 155,308 Q153,316 150,320 Q145,322 140,320 Q137,316 135,308 Q137,300 145,292 Z",
        x: 146, y: 306 
      },
      { 
        name: "Right Hand", 
        path: "M315,292 Q320,290 325,292 Q333,300 335,308 Q333,316 330,320 Q325,322 320,320 Q317,316 315,308 Q313,300 315,292 Z",
        x: 324, y: 306 
      },
      // Hips with natural curves
      { 
        name: "Left Hip", 
        path: "M207,285 Q218,280 230,285 Q235,295 233,308 Q230,320 225,330 Q218,335 210,330 Q205,320 202,308 Q200,295 207,285 Z",
        x: 217, y: 308 
      },
      { 
        name: "Right Hip", 
        path: "M240,285 Q252,280 263,285 Q270,295 268,308 Q265,320 260,330 Q252,335 245,330 Q240,320 237,308 Q235,295 240,285 Z",
        x: 252, y: 308 
      },
      // Legs with natural muscle definition
      { 
        name: "Left Upper Leg", 
        path: "M210,330 Q218,325 225,330 Q228,350 226,375 Q224,400 220,420 Q215,425 208,420 Q205,400 203,375 Q205,350 210,330 Z",
        x: 216, y: 375 
      },
      { 
        name: "Right Upper Leg", 
        path: "M245,330 Q252,325 260,330 Q265,350 267,375 Q265,400 262,420 Q255,425 248,420 Q245,400 243,375 Q245,350 245,330 Z",
        x: 254, y: 375 
      },
      { 
        name: "Left Knee", 
        path: "M208,420 Q215,415 220,420 Q222,428 220,436 Q218,444 215,448 Q210,450 205,448 Q202,444 200,436 Q202,428 208,420 Z",
        x: 211, y: 434 
      },
      { 
        name: "Right Knee", 
        path: "M248,420 Q255,415 262,420 Q268,428 270,436 Q268,444 265,448 Q260,450 255,448 Q252,444 248,436 Q246,428 248,420 Z",
        x: 257, y: 434 
      },
      { 
        name: "Left Lower Leg", 
        path: "M205,448 Q210,445 215,448 Q217,465 215,485 Q213,505 210,520 Q205,525 198,520 Q195,505 193,485 Q195,465 205,448 Z",
        x: 206, y: 484 
      },
      { 
        name: "Right Lower Leg", 
        path: "M255,448 Q260,445 265,448 Q275,465 277,485 Q275,505 272,520 Q265,525 258,520 Q255,505 253,485 Q255,465 255,448 Z",
        x: 264, y: 484 
      },
      { 
        name: "Left Ankle", 
        path: "M198,520 Q205,517 210,520 Q212,525 210,530 Q208,535 205,537 Q200,539 195,537 Q192,535 190,530 Q192,525 198,520 Z",
        x: 201, y: 528 
      },
      { 
        name: "Right Ankle", 
        path: "M258,520 Q265,517 272,520 Q278,525 280,530 Q278,535 275,537 Q270,539 265,537 Q262,535 258,530 Q256,525 258,520 Z",
        x: 268, y: 528 
      },
      { 
        name: "Left Foot", 
        path: "M190,537 Q200,532 210,537 Q215,542 213,548 Q210,554 205,557 Q195,560 185,557 Q180,554 177,548 Q180,542 190,537 Z",
        x: 196, y: 548 
      },
      { 
        name: "Right Foot", 
        path: "M265,537 Q275,532 285,537 Q293,542 295,548 Q293,554 290,557 Q280,560 270,557 Q265,554 262,548 Q265,542 265,537 Z",
        x: 279, y: 548 
      }
    ],
    back: [
      // Head (back view) - natural curve
      { 
        name: "Head", 
        path: "M200,30 Q215,22 235,20 Q255,22 270,30 Q280,40 282,55 Q281,70 275,80 Q265,88 250,92 Q235,94 220,92 Q205,88 195,80 Q189,70 188,55 Q190,40 200,30 Z",
        x: 235, y: 55 
      },
      // Neck with natural taper
      { 
        name: "Neck", 
        path: "M220,92 Q235,95 250,92 Q252,100 250,108 Q248,115 245,118 Q235,122 225,118 Q222,115 220,108 Q218,100 220,92 Z",
        x: 235, y: 105 
      },
      // Back
      { 
        name: "Upper Back", 
        path: "M185,115 Q235,110 285,115 L285,180 Q235,185 185,180 Z",
        x: 235, y: 147 
      },
      { 
        name: "Middle Back", 
        path: "M195,185 Q235,180 275,185 L275,220 Q235,225 195,220 Z",
        x: 235, y: 202 
      },
      { 
        name: "Lower Back", 
        path: "M200,225 Q235,220 270,225 L270,260 Q235,265 200,260 Z",
        x: 235, y: 242 
      },
      // Arms (back view)
      { 
        name: "Left Shoulder", 
        path: "M160,115 Q175,110 185,115 L185,140 Q175,145 160,140 Z",
        x: 172, y: 127 
      },
      { 
        name: "Right Shoulder", 
        path: "M285,115 Q300,110 315,115 L315,140 Q300,145 285,140 Z",
        x: 300, y: 127 
      },
      { 
        name: "Left Upper Arm", 
        path: "M155,140 Q170,135 175,140 L170,190 Q165,195 155,190 Z",
        x: 165, y: 165 
      },
      { 
        name: "Right Upper Arm", 
        path: "M295,140 Q310,135 320,140 L320,190 Q310,195 295,190 Z",
        x: 307, y: 165 
      },
      { 
        name: "Left Elbow", 
        path: "M155,190 Q165,185 170,190 L165,205 Q160,210 155,205 Z",
        x: 162, y: 197 
      },
      { 
        name: "Right Elbow", 
        path: "M295,190 Q305,185 320,190 L320,205 Q305,210 295,205 Z",
        x: 307, y: 197 
      },
      { 
        name: "Left Forearm", 
        path: "M155,205 Q165,200 170,205 L165,250 Q160,255 155,250 Z",
        x: 162, y: 227 
      },
      { 
        name: "Right Forearm", 
        path: "M295,205 Q305,200 320,205 L320,250 Q305,255 295,250 Z",
        x: 307, y: 227 
      },
      { 
        name: "Left Wrist", 
        path: "M155,250 Q165,245 170,250 L165,265 Q160,270 155,265 Z",
        x: 162, y: 257 
      },
      { 
        name: "Right Wrist", 
        path: "M295,250 Q305,245 320,250 L320,265 Q305,270 295,265 Z",
        x: 307, y: 257 
      },
      { 
        name: "Left Hand", 
        path: "M155,265 Q165,260 170,265 L165,285 Q160,290 155,285 Z",
        x: 162, y: 275 
      },
      { 
        name: "Right Hand", 
        path: "M295,265 Q305,260 320,265 L320,285 Q305,290 295,285 Z",
        x: 307, y: 275 
      },
      // Glutes and Lower Back
      { 
        name: "Left Glute", 
        path: "M200,260 Q217,255 235,260 L235,290 Q217,295 200,290 Z",
        x: 217, y: 275 
      },
      { 
        name: "Right Glute", 
        path: "M235,260 Q252,255 270,260 L270,290 Q252,295 235,290 Z",
        x: 252, y: 275 
      },
      // Legs (back view)
      { 
        name: "Left Upper Leg", 
        path: "M200,290 Q217,285 225,290 L220,360 Q212,365 200,360 Z",
        x: 212, y: 325 
      },
      { 
        name: "Right Upper Leg", 
        path: "M245,290 Q252,285 270,290 L270,360 Q262,365 245,360 Z",
        x: 257, y: 325 
      },
      { 
        name: "Left Knee", 
        path: "M200,360 Q212,355 220,360 L215,380 Q207,385 200,380 Z",
        x: 210, y: 370 
      },
      { 
        name: "Right Knee", 
        path: "M245,360 Q257,355 270,360 L270,380 Q262,385 245,380 Z",
        x: 257, y: 370 
      },
      { 
        name: "Left Calf", 
        path: "M200,380 Q210,375 215,380 L210,450 Q205,455 200,450 Z",
        x: 207, y: 415 
      },
      { 
        name: "Right Calf", 
        path: "M245,380 Q255,375 270,380 L270,450 Q260,455 245,450 Z",
        x: 257, y: 415 
      },
      { 
        name: "Left Ankle", 
        path: "M200,450 Q207,445 210,450 L205,465 Q202,470 200,465 Z",
        x: 205, y: 457 
      },
      { 
        name: "Right Ankle", 
        path: "M245,450 Q257,445 270,450 L270,465 Q262,470 245,465 Z",
        x: 257, y: 457 
      },
      { 
        name: "Left Foot", 
        path: "M195,465 Q210,460 215,465 L210,485 Q200,490 195,485 Z",
        x: 205, y: 475 
      },
      { 
        name: "Right Foot", 
        path: "M245,465 Q260,460 275,465 L275,485 Q265,490 245,485 Z",
        x: 260, y: 475 
      }
    ]
  };

  const currentBodyParts = bodyParts[view];

  return (
    <div className="relative bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border border-gray-200 overflow-hidden">
      {/* Control Panel */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
          <div className="flex gap-2">
            <Button
              onClick={onViewToggle}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              {view === "front" ? "Switch to Back View" : "Switch to Front View"}
            </Button>
          </div>
        </div>
        
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
          <div className="flex gap-2">
            <Button onClick={handleZoomOut} variant="outline" size="sm">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button onClick={resetView} variant="outline" size="sm">
              Reset
            </Button>
            <Button onClick={handleZoomIn} variant="outline" size="sm">
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-10">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <h4 className="text-sm font-semibold mb-2">Pain Scale</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-600"></div>
              <span>1-3: Mild</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#0cc9a9]"></div>
              <span>4-6: Moderate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-600"></div>
              <span>7-10: Severe</span>
            </div>
          </div>
        </div>
      </div>

      {/* SVG Body Diagram */}
      <div className="flex justify-center items-center min-h-[600px] p-8">
        <div 
          className="relative"
          style={{
            transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
            transition: 'transform 0.2s ease-out'
          }}
        >
          <svg 
            width="480" 
            height="520" 
            viewBox="0 0 480 520" 
            className="drop-shadow-lg"
          >
            {/* Background */}
            <defs>
              <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Natural body outline background */}
            <path
              d="M200,30 Q235,20 270,30 Q290,45 295,118 Q320,135 335,155 Q340,180 338,220 Q335,280 330,330 Q325,380 320,420 Q315,460 310,500 Q305,540 300,560 Q290,565 280,560 Q275,540 270,500 Q265,460 260,420 Q255,380 250,330 Q245,280 240,220 Q235,180 230,155 Q225,135 220,118 Q215,155 210,220 Q205,280 200,330 Q195,380 190,420 Q185,460 180,500 Q175,540 170,560 Q160,565 150,560 Q145,540 140,500 Q135,460 130,420 Q125,380 120,330 Q115,280 112,220 Q110,180 115,155 Q140,135 165,118 Q170,45 200,30 Z"
              fill="url(#bodyGradient)"
              stroke="#3b82f6"
              strokeWidth="2"
              opacity="0.2"
            />

            {/* Render body parts */}
            {currentBodyParts.map((part) => {
              const isHovered = hoveredPart === part.name;
              const bodyPartColor = getBodyPartColor(part.name);
              const logs = getBodyPartLogs(part.name);
              const hasLogs = logs.length > 0;
              
              return (
                <g key={part.name}>
                  <path
                    d={part.path}
                    fill={bodyPartColor}
                    stroke={isHovered ? "#1d4ed8" : hasLogs ? "#2563eb" : "#3b82f6"}
                    strokeWidth={isHovered ? "3" : hasLogs ? "2" : "1.5"}
                    className="cursor-pointer transition-all duration-200 hover:drop-shadow-lg"
                    filter={isHovered ? "url(#glow)" : undefined}
                    opacity={isHovered ? 0.9 : hasLogs ? 0.8 : 0.7}
                    onClick={(e) => handleBodyPartClick(part.name, e)}
                    onMouseEnter={() => setHoveredPart(part.name)}
                    onMouseLeave={() => setHoveredPart(null)}
                  />
                  
                  {/* Permanent mini-labels for logged parts */}
                  {hasLogs && !isHovered && (
                    <g>
                      <circle
                        cx={part.x}
                        cy={part.y}
                        r="12"
                        fill="rgba(20,30,50,0.9)"
                        stroke={getPainColor(logs[0].severity)}
                        strokeWidth="2"
                      />
                      <text
                        x={part.x}
                        y={part.y + 1}
                        textAnchor="middle"
                        className="text-xs font-bold"
                        fill="white"
                        style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }}
                      >
                        {logs[0].severity}
                      </text>
                    </g>
                  )}
                  
                  {/* Enhanced label for hovered parts */}
                  {isHovered && (
                    <g>
                      {/* Drop shadow for label */}
                      <rect
                        x={part.x - 35 + 2}
                        y={part.y - 35 + 2}
                        width="70"
                        height={logs.length > 0 ? "35" : "25"}
                        fill="rgba(0,0,0,0.3)"
                        rx="6"
                      />
                      {/* Main label background */}
                      <rect
                        x={part.x - 35}
                        y={part.y - 35}
                        width="70"
                        height={logs.length > 0 ? "35" : "25"}
                        fill="rgba(20,30,50,0.95)"
                        stroke="rgba(59,130,246,0.8)"
                        strokeWidth="1.5"
                        rx="6"
                      />
                      {/* Body part name */}
                      <text
                        x={part.x}
                        y={part.y - 20}
                        textAnchor="middle"
                        className="text-sm font-semibold"
                        fill="white"
                        style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }}
                      >
                        {part.name}
                      </text>
                      {/* Severity level if exists */}
                      {logs.length > 0 && (
                        <text
                          x={part.x}
                          y={part.y - 6}
                          textAnchor="middle"
                          className="text-xs font-medium"
                          fill={getPainColor(logs[0].severity)}
                          style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }}
                        >
                          Level {logs[0].severity} • {logs[0].type}
                        </text>
                      )}
                      {/* Instruction text for non-logged parts */}
                      {logs.length === 0 && (
                        <text
                          x={part.x}
                          y={part.y - 6}
                          textAnchor="middle"
                          className="text-xs"
                          fill="rgba(255,255,255,0.7)"
                          style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }}
                        >
                          Click to log
                        </text>
                      )}
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}