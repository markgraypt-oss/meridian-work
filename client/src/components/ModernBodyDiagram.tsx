import { useState } from "react";
import type { BodyMapLog } from "@shared/schema";

interface ModernBodyDiagramProps {
  view: "front" | "back";
  onBodyPartClick: (bodyPart: string, x: number, y: number, view: "front" | "back") => void;
  existingLogs: BodyMapLog[];
}

export default function ModernBodyDiagram({ view, onBodyPartClick, existingLogs }: ModernBodyDiagramProps) {
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);

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
    if (logs.length === 0) return "rgba(59, 130, 246, 0.1)"; // blue-500 with low opacity
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

  // Modern 3D-style body parts with accurate anatomical positioning
  const bodyParts = {
    front: [
      // Head and Neck
      { 
        name: "Head", 
        path: "M200,40 Q230,35 260,40 Q275,55 270,80 Q260,95 230,100 Q200,95 190,80 Q185,55 200,40 Z",
        x: 230, y: 65 
      },
      { 
        name: "Neck", 
        path: "M215,100 Q230,98 245,100 L250,130 L210,130 Z",
        x: 230, y: 115 
      },
      
      // Shoulders and Arms
      { 
        name: "Left Shoulder", 
        path: "M160,130 Q175,125 190,130 Q195,150 190,170 Q175,175 160,170 Q155,150 160,130",
        x: 175, y: 150 
      },
      { 
        name: "Right Shoulder", 
        path: "M270,130 Q285,125 300,130 Q305,150 300,170 Q285,175 270,170 Q265,150 270,130",
        x: 285, y: 150 
      },
      { 
        name: "Left Arm", 
        path: "M140,170 Q155,165 170,170 Q165,220 160,270 Q155,275 140,270 Q135,220 140,170",
        x: 155, y: 220 
      },
      { 
        name: "Right Arm", 
        path: "M290,170 Q305,165 320,170 Q325,220 320,270 Q305,275 290,270 Q285,220 290,170",
        x: 305, y: 220 
      },
      
      // Torso
      { 
        name: "Chest", 
        path: "M190,130 Q230,125 270,130 L270,200 Q230,205 190,200 Z",
        x: 230, y: 165 
      },
      { 
        name: "Abdomen", 
        path: "M195,200 Q230,195 265,200 L265,260 Q230,265 195,260 Z",
        x: 230, y: 230 
      },
      
      // Hips and Pelvis
      { 
        name: "Left Hip", 
        path: "M195,260 Q215,255 235,260 Q235,290 215,300 Q195,295 195,275 Z",
        x: 215, y: 280 
      },
      { 
        name: "Right Hip", 
        path: "M225,260 Q245,255 265,260 Q265,290 245,300 Q225,295 225,275 Z",
        x: 245, y: 280 
      },
      
      // Legs
      { 
        name: "Left Thigh", 
        path: "M190,300 Q210,295 230,300 Q235,380 230,460 Q210,465 190,460 Q185,380 190,300",
        x: 210, y: 380 
      },
      { 
        name: "Right Thigh", 
        path: "M230,300 Q250,295 270,300 Q275,380 270,460 Q250,465 230,460 Q225,380 230,300",
        x: 250, y: 380 
      },
      { 
        name: "Left Knee", 
        path: "M195,460 Q210,455 225,460 Q225,490 210,500 Q195,495 195,475 Z",
        x: 210, y: 480 
      },
      { 
        name: "Right Knee", 
        path: "M235,460 Q250,455 265,460 Q265,490 250,500 Q235,495 235,475 Z",
        x: 250, y: 480 
      },
      { 
        name: "Left Shin", 
        path: "M197,500 Q212,495 227,500 Q227,580 212,590 Q197,585 197,540 Z",
        x: 212, y: 545 
      },
      { 
        name: "Right Shin", 
        path: "M233,500 Q248,495 263,500 Q263,580 248,590 Q233,585 233,540 Z",
        x: 248, y: 545 
      },
      { 
        name: "Left Foot", 
        path: "M195,590 Q210,585 225,590 Q225,610 210,615 Q195,610 195,595 Z",
        x: 210, y: 600 
      },
      { 
        name: "Right Foot", 
        path: "M235,590 Q250,585 265,590 Q265,610 250,615 Q235,610 235,595 Z",
        x: 250, y: 600 
      }
    ],
    back: [
      // Head and Neck
      { 
        name: "Head", 
        path: "M200,40 Q230,35 260,40 Q275,55 270,80 Q260,95 230,100 Q200,95 190,80 Q185,55 200,40 Z",
        x: 230, y: 65 
      },
      { 
        name: "Neck", 
        path: "M215,100 Q230,98 245,100 L250,130 L210,130 Z",
        x: 230, y: 115 
      },
      
      // Shoulders and Arms
      { 
        name: "Left Shoulder", 
        path: "M160,130 Q175,125 190,130 Q195,150 190,170 Q175,175 160,170 Q155,150 160,130",
        x: 175, y: 150 
      },
      { 
        name: "Right Shoulder", 
        path: "M270,130 Q285,125 300,130 Q305,150 300,170 Q285,175 270,170 Q265,150 270,130",
        x: 285, y: 150 
      },
      { 
        name: "Left Arm", 
        path: "M140,170 Q155,165 170,170 Q165,220 160,270 Q155,275 140,270 Q135,220 140,170",
        x: 155, y: 220 
      },
      { 
        name: "Right Arm", 
        path: "M290,170 Q305,165 320,170 Q325,220 320,270 Q305,275 290,270 Q285,220 290,170",
        x: 305, y: 220 
      },
      
      // Back
      { 
        name: "Upper Back", 
        path: "M190,130 Q230,125 270,130 L270,200 Q230,205 190,200 Z",
        x: 230, y: 165 
      },
      { 
        name: "Lower Back", 
        path: "M195,200 Q230,195 265,200 L265,260 Q230,265 195,260 Z",
        x: 230, y: 230 
      },
      
      // Glutes
      { 
        name: "Left Glute", 
        path: "M195,260 Q215,255 235,260 Q235,290 215,300 Q195,295 195,275 Z",
        x: 215, y: 280 
      },
      { 
        name: "Right Glute", 
        path: "M225,260 Q245,255 265,260 Q265,290 245,300 Q225,295 225,275 Z",
        x: 245, y: 280 
      },
      
      // Legs (back view)
      { 
        name: "Left Hamstring", 
        path: "M190,300 Q210,295 230,300 Q235,380 230,460 Q210,465 190,460 Q185,380 190,300",
        x: 210, y: 380 
      },
      { 
        name: "Right Hamstring", 
        path: "M230,300 Q250,295 270,300 Q275,380 270,460 Q250,465 230,460 Q225,380 230,300",
        x: 250, y: 380 
      },
      { 
        name: "Left Knee", 
        path: "M195,460 Q210,455 225,460 Q225,490 210,500 Q195,495 195,475 Z",
        x: 210, y: 480 
      },
      { 
        name: "Right Knee", 
        path: "M235,460 Q250,455 265,460 Q265,490 250,500 Q235,495 235,475 Z",
        x: 250, y: 480 
      },
      { 
        name: "Left Calf", 
        path: "M197,500 Q212,495 227,500 Q227,580 212,590 Q197,585 197,540 Z",
        x: 212, y: 545 
      },
      { 
        name: "Right Calf", 
        path: "M233,500 Q248,495 263,500 Q263,580 248,590 Q233,585 233,540 Z",
        x: 248, y: 545 
      },
      { 
        name: "Left Foot", 
        path: "M195,590 Q210,585 225,590 Q225,610 210,615 Q195,610 195,595 Z",
        x: 210, y: 600 
      },
      { 
        name: "Right Foot", 
        path: "M235,590 Q250,585 265,590 Q265,610 250,615 Q235,610 235,595 Z",
        x: 250, y: 600 
      }
    ]
  };

  const renderBodyPart = (part: { name: string; path: string; x: number; y: number }) => {
    const logs = getBodyPartLogs(part.name);
    const colour = getBodyPartColor(part.name);
    const isHovered = hoveredPart === part.name;
    const hasLog = logs.length > 0;

    return (
      <g key={part.name}>
        {/* Base body part with 3D gradient effect */}
        <defs>
          <linearGradient id={`gradient-${part.name}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: hasLog ? colour : "#3b82f6", stopOpacity: hasLog ? 0.8 : 0.6 }} />
            <stop offset="50%" style={{ stopColor: hasLog ? colour : "#60a5fa", stopOpacity: hasLog ? 0.6 : 0.4 }} />
            <stop offset="100%" style={{ stopColor: hasLog ? colour : "#93c5fd", stopOpacity: hasLog ? 0.4 : 0.2 }} />
          </linearGradient>
          <radialGradient id={`glow-${part.name}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" style={{ stopColor: colour, stopOpacity: 0.8 }} />
            <stop offset="70%" style={{ stopColor: colour, stopOpacity: 0.4 }} />
            <stop offset="100%" style={{ stopColor: colour, stopOpacity: 0 }} />
          </radialGradient>
        </defs>
        
        {/* Glow effect for active areas */}
        {hasLog && (
          <path
            d={part.path}
            fill={`url(#glow-${part.name})`}
            className="pointer-events-none"
            style={{
              filter: "blur(8px)",
              transform: "scale(1.1)",
              transformOrigin: `${part.x}px ${part.y}px`
            }}
          />
        )}
        
        {/* Main body part */}
        <path
          d={part.path}
          fill={`url(#gradient-${part.name})`}
          stroke={hasLog ? colour : "#1e40af"}
          strokeWidth={isHovered ? "3" : hasLog ? "2" : "1"}
          className="cursor-pointer transition-all duration-300"
          style={{
            filter: isHovered ? "brightness(1.2) drop-shadow(0 4px 8px rgba(0,0,0,0.3))" : 
                    hasLog ? "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" : "none",
            transform: isHovered ? "scale(1.05)" : "scale(1)",
            transformOrigin: `${part.x}px ${part.y}px`
          }}
          onClick={(e) => handleBodyPartClick(part.name, e)}
          onMouseEnter={() => setHoveredPart(part.name)}
          onMouseLeave={() => setHoveredPart(null)}
        />
        
        {/* Severity indicator for active areas */}
        {hasLog && (
          <circle
            cx={part.x}
            cy={part.y}
            r="6"
            fill="white"
            stroke={color}
            strokeWidth="3"
            className="pointer-events-none drop-shadow-sm"
          />
        )}
        
        {/* Hover tooltip */}
        {isHovered && (
          <g className="pointer-events-none">
            <rect
              x={part.x + 15}
              y={part.y - 35}
              width={logs.length > 0 ? "140" : "80"}
              height={logs.length > 0 ? "50" : "30"}
              fill="rgba(0,0,0,0.9)"
              rx="6"
              className="drop-shadow-lg"
            />
            <text
              x={part.x + 20}
              y={part.y - 20}
              fill="white"
              fontSize="12"
              fontWeight="600"
            >
              {part.name}
            </text>
            {logs.length > 0 && (
              <text
                x={part.x + 20}
                y={part.y - 8}
                fill="white"
                fontSize="10"
              >
                {logs[0].type} • {logs[0].severity}/10
              </text>
            )}
          </g>
        )}
      </g>
    );
  };

  return (
    <div className="relative">
      <svg
        viewBox="0 0 460 650"
        className="w-full h-auto max-w-sm mx-auto drop-shadow-xl"
        style={{ maxHeight: "600px" }}
      >
        {/* 3D Background with modern gradient */}
        <defs>
          <linearGradient id="modernBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#0f172a", stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: "#1e293b", stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: "#334155", stopOpacity: 1 }} />
          </linearGradient>
          
          {/* Body outline gradient */}
          <linearGradient id="bodyOutline" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#3b82f6", stopOpacity: 0.3 }} />
            <stop offset="50%" style={{ stopColor: "#60a5fa", stopOpacity: 0.2 }} />
            <stop offset="100%" style={{ stopColor: "#93c5fd", stopOpacity: 0.1 }} />
          </linearGradient>
        </defs>
        
        {/* Modern background */}
        <rect
          x="0"
          y="0"
          width="460"
          height="650"
          fill="url(#modernBg)"
          rx="20"
        />
        
        {/* Body outline for context */}
        <path
          d="M200,40 Q280,35 260,40 Q275,55 270,80 Q260,100 250,130 Q300,125 305,170 Q325,220 320,270 Q285,275 270,270 Q275,300 275,460 Q275,500 263,580 Q248,590 235,590 Q225,610 195,610 Q195,590 197,580 Q185,500 185,460 Q185,300 190,270 Q175,275 140,270 Q135,220 155,170 Q160,125 210,130 Q200,100 190,80 Q185,55 200,40 Z"
          fill="url(#bodyOutline)"
          stroke="#60a5fa"
          strokeWidth="2"
          opacity="0.3"
          className="pointer-events-none"
        />
        
        {/* Render all body parts */}
        {bodyParts[view].map(renderBodyPart)}
        
        {/* Modern view label */}
        <text
          x="230"
          y="25"
          textAnchor="middle"
          fontSize="16"
          fontWeight="700"
          fill="#f1f5f9"
          className="drop-shadow-sm"
        >
          {view === "front" ? "FRONT VIEW" : "BACK VIEW"}
        </text>
        
        {/* Subtle grid pattern for tech aesthetic */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#334155" strokeWidth="0.5" opacity="0.3"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" className="pointer-events-none" />
      </svg>
    </div>
  );
}