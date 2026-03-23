import { useState } from "react";
import type { BodyMapLog } from "@shared/schema";

interface BodyDiagramProps {
  view: "front" | "back";
  onBodyPartClick: (bodyPart: string, x: number, y: number, view: "front" | "back") => void;
  existingLogs: BodyMapLog[];
}

export default function BodyDiagram({ view, onBodyPartClick, existingLogs }: BodyDiagramProps) {
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);

  const getPainColor = (painLevel: number) => {
    if (painLevel >= 8) return "#dc2626"; // red-600
    if (painLevel >= 6) return "#ea580c"; // orange-600
    if (painLevel >= 4) return "#0cc9a9"; // amber-600
    if (painLevel >= 2) return "#0cc9a9"; // yellow-600
    return "#16a34a"; // green-600
  };

  const getBodyPartLogs = (bodyPart: string) => {
    return existingLogs.filter(log => 
      log.bodyPart === bodyPart && log.view === view
    ).sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  };

  const getBodyPartColor = (bodyPart: string) => {
    const logs = getBodyPartLogs(bodyPart);
    if (logs.length === 0) return "#e5e7eb"; // gray-200
    return getPainColor(logs[0].painLevel);
  };

  const handleBodyPartClick = (bodyPart: string, event: React.MouseEvent<SVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const svg = event.currentTarget.closest('svg')!;
    const svgRect = svg.getBoundingClientRect();
    
    const x = ((event.clientX - svgRect.left) / svgRect.width) * 100;
    const y = ((event.clientY - svgRect.top) / svgRect.height) * 100;
    
    onBodyPartClick(bodyPart, x, y, view);
  };

  const bodyParts = {
    front: [
      { name: "Head", path: "M150,30 Q170,20 190,30 Q200,50 190,70 Q170,80 150,70 Q140,50 150,30", x: 170, y: 45 },
      { name: "Neck", path: "M160,70 Q170,75 180,70 L180,90 L160,90 Z", x: 170, y: 80 },
      { name: "Left Shoulder", path: "M120,90 Q130,85 140,90 Q145,110 140,130 Q130,135 120,130 Q115,110 120,90", x: 130, y: 110 },
      { name: "Right Shoulder", path: "M200,90 Q210,85 220,90 Q225,110 220,130 Q210,135 200,130 Q195,110 200,90", x: 210, y: 110 },
      { name: "Chest", path: "M140,90 Q170,85 200,90 L200,140 Q170,145 140,140 Z", x: 170, y: 115 },
      { name: "Left Arm", path: "M120,130 Q115,150 120,170 Q115,190 120,210 Q125,215 130,210 Q135,190 130,170 Q135,150 130,130", x: 125, y: 170 },
      { name: "Right Arm", path: "M210,130 Q215,150 210,170 Q215,190 210,210 Q205,215 200,210 Q195,190 200,170 Q195,150 200,130", x: 205, y: 170 },
      { name: "Abdomen", path: "M145,140 Q170,135 195,140 L195,180 Q170,185 145,180 Z", x: 170, y: 160 },
      { name: "Left Hip", path: "M145,180 Q155,175 165,180 Q165,200 155,210 Q145,205 145,190 Z", x: 155, y: 195 },
      { name: "Right Hip", path: "M175,180 Q185,175 195,180 Q195,200 185,210 Q175,205 175,190 Z", x: 185, y: 195 },
      { name: "Left Thigh", path: "M140,210 Q150,205 160,210 Q165,250 160,290 Q150,295 140,290 Q135,250 140,210", x: 150, y: 250 },
      { name: "Right Thigh", path: "M180,210 Q190,205 200,210 Q205,250 200,290 Q190,295 180,290 Q175,250 180,210", x: 190, y: 250 },
      { name: "Left Knee", path: "M145,290 Q155,285 165,290 Q165,310 155,320 Q145,315 145,300 Z", x: 155, y: 305 },
      { name: "Right Knee", path: "M175,290 Q185,285 195,290 Q195,310 185,320 Q175,315 175,300 Z", x: 185, y: 305 },
      { name: "Left Shin", path: "M147,320 Q157,315 167,320 Q167,370 157,380 Q147,375 147,350 Z", x: 157, y: 350 },
      { name: "Right Shin", path: "M173,320 Q183,315 193,320 Q193,370 183,380 Q173,375 173,350 Z", x: 183, y: 350 },
      { name: "Left Foot", path: "M145,380 Q155,375 165,380 Q165,395 155,400 Q145,395 145,385 Z", x: 155, y: 390 },
      { name: "Right Foot", path: "M175,380 Q185,375 195,380 Q195,395 185,400 Q175,395 175,385 Z", x: 185, y: 390 }
    ],
    back: [
      { name: "Head", path: "M150,30 Q170,20 190,30 Q200,50 190,70 Q170,80 150,70 Q140,50 150,30", x: 170, y: 45 },
      { name: "Neck", path: "M160,70 Q170,75 180,70 L180,90 L160,90 Z", x: 170, y: 80 },
      { name: "Left Shoulder", path: "M120,90 Q130,85 140,90 Q145,110 140,130 Q130,135 120,130 Q115,110 120,90", x: 130, y: 110 },
      { name: "Right Shoulder", path: "M200,90 Q210,85 220,90 Q225,110 220,130 Q210,135 200,130 Q195,110 200,90", x: 210, y: 110 },
      { name: "Upper Back", path: "M140,90 Q170,85 200,90 L200,140 Q170,145 140,140 Z", x: 170, y: 115 },
      { name: "Left Arm", path: "M120,130 Q115,150 120,170 Q115,190 120,210 Q125,215 130,210 Q135,190 130,170 Q135,150 130,130", x: 125, y: 170 },
      { name: "Right Arm", path: "M210,130 Q215,150 210,170 Q215,190 210,210 Q205,215 200,210 Q195,190 200,170 Q195,150 200,130", x: 205, y: 170 },
      { name: "Lower Back", path: "M145,140 Q170,135 195,140 L195,180 Q170,185 145,180 Z", x: 170, y: 160 },
      { name: "Left Glute", path: "M145,180 Q155,175 165,180 Q165,200 155,210 Q145,205 145,190 Z", x: 155, y: 195 },
      { name: "Right Glute", path: "M175,180 Q185,175 195,180 Q195,200 185,210 Q175,205 175,190 Z", x: 185, y: 195 },
      { name: "Left Hamstring", path: "M140,210 Q150,205 160,210 Q165,250 160,290 Q150,295 140,290 Q135,250 140,210", x: 150, y: 250 },
      { name: "Right Hamstring", path: "M180,210 Q190,205 200,210 Q205,250 200,290 Q190,295 180,290 Q175,250 180,210", x: 190, y: 250 },
      { name: "Left Knee", path: "M145,290 Q155,285 165,290 Q165,310 155,320 Q145,315 145,300 Z", x: 155, y: 305 },
      { name: "Right Knee", path: "M175,290 Q185,285 195,290 Q195,310 185,320 Q175,315 175,300 Z", x: 185, y: 305 },
      { name: "Left Calf", path: "M147,320 Q157,315 167,320 Q167,370 157,380 Q147,375 147,350 Z", x: 157, y: 350 },
      { name: "Right Calf", path: "M173,320 Q183,315 193,320 Q193,370 183,380 Q173,375 173,350 Z", x: 183, y: 350 },
      { name: "Left Foot", path: "M145,380 Q155,375 165,380 Q165,395 155,400 Q145,395 145,385 Z", x: 155, y: 390 },
      { name: "Right Foot", path: "M175,380 Q185,375 195,380 Q195,395 185,400 Q175,395 175,385 Z", x: 185, y: 390 }
    ]
  };

  const renderBodyPart = (part: { name: string; path: string; x: number; y: number }) => {
    const logs = getBodyPartLogs(part.name);
    const colour = getBodyPartColor(part.name);
    const isHovered = hoveredPart === part.name;

    return (
      <g key={part.name}>
        <path
          d={part.path}
          fill={color}
          stroke="#374151"
          strokeWidth="1"
          className="cursor-pointer transition-all duration-200"
          style={{
            filter: isHovered ? "brightness(1.1)" : "none",
            strokeWidth: isHovered ? "2" : "1"
          }}
          onClick={(e) => handleBodyPartClick(part.name, e)}
          onMouseEnter={() => setHoveredPart(part.name)}
          onMouseLeave={() => setHoveredPart(null)}
        />
        {logs.length > 0 && (
          <circle
            cx={part.x}
            cy={part.y}
            r="3"
            fill="#ffffff"
            stroke={color}
            strokeWidth="2"
            className="pointer-events-none"
          />
        )}
        {isHovered && logs.length > 0 && (
          <g>
            <rect
              x={part.x + 10}
              y={part.y - 25}
              width="120"
              height="40"
              fill="rgba(0,0,0,0.8)"
              rx="4"
              className="pointer-events-none"
            />
            <text
              x={part.x + 15}
              y={part.y - 15}
              fill="white"
              fontSize="10"
              className="pointer-events-none"
            >
              {part.name}
            </text>
            <text
              x={part.x + 15}
              y={part.y - 5}
              fill="white"
              fontSize="8"
              className="pointer-events-none"
            >
              Pain: {logs[0].painLevel}/10 • {logs[0].injuryType}
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div className="relative">
      <svg
        viewBox="0 0 340 420"
        className="w-full h-auto max-w-sm mx-auto"
        style={{ maxHeight: "500px" }}
      >
        {/* Body outline */}
        <rect
          x="0"
          y="0"
          width="340"
          height="420"
          fill="transparent"
          stroke="none"
        />
        
        {/* Render body parts */}
        {bodyParts[view].map(renderBodyPart)}
        
        {/* View label */}
        <text
          x="170"
          y="15"
          textAnchor="middle"
          fontSize="14"
          fontWeight="bold"
          fill="#374151"
        >
          {view === "front" ? "Front View" : "Back View"}
        </text>
      </svg>
    </div>
  );
}