import { useState } from "react";
import type { BodyMapLog } from "@shared/schema";

interface BodyMapSVGProps {
  onBodyPartClick: (bodyPart: string, x: number, y: number) => void;
  existingLogs: BodyMapLog[];
}

export default function BodyMapSVG({ onBodyPartClick, existingLogs }: BodyMapSVGProps) {
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);

  const bodyParts = [
    { name: "Head", x: 128, y: 30, region: "head" },
    { name: "Neck", x: 128, y: 50, region: "neck" },
    { name: "Left Shoulder", x: 100, y: 70, region: "shoulder" },
    { name: "Right Shoulder", x: 156, y: 70, region: "shoulder" },
    { name: "Left Arm", x: 80, y: 100, region: "arm" },
    { name: "Right Arm", x: 176, y: 100, region: "arm" },
    { name: "Chest", x: 128, y: 90, region: "chest" },
    { name: "Upper Back", x: 128, y: 110, region: "back" },
    { name: "Lower Back", x: 128, y: 150, region: "back" },
    { name: "Left Hip", x: 110, y: 170, region: "hip" },
    { name: "Right Hip", x: 146, y: 170, region: "hip" },
    { name: "Left Thigh", x: 110, y: 200, region: "leg" },
    { name: "Right Thigh", x: 146, y: 200, region: "leg" },
    { name: "Left Knee", x: 110, y: 230, region: "knee" },
    { name: "Right Knee", x: 146, y: 230, region: "knee" },
    { name: "Left Calf", x: 110, y: 260, region: "leg" },
    { name: "Right Calf", x: 146, y: 260, region: "leg" },
    { name: "Left Foot", x: 110, y: 290, region: "foot" },
    { name: "Right Foot", x: 146, y: 290, region: "foot" },
  ];

  const getLogForBodyPart = (bodyPartName: string) => {
    return existingLogs.find(log => log.bodyPart === bodyPartName);
  };

  const getPainColor = (painLevel?: number) => {
    if (!painLevel) return "#10B981"; // Green for no pain
    if (painLevel >= 7) return "#EF4444"; // Red for high pain
    if (painLevel >= 4) return "#0cc9a9"; // Yellow for moderate pain
    return "#10B981"; // Green for mild pain
  };

  const handleBodyPartClick = (bodyPart: typeof bodyParts[0]) => {
    onBodyPartClick(bodyPart.name, bodyPart.x, bodyPart.y);
  };

  return (
    <div className="relative w-64 h-96 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
      <svg
        width="256"
        height="320"
        viewBox="0 0 256 320"
        className="w-full h-full"
      >
        {/* Body outline */}
        <g fill="none" stroke="#D1D5DB" strokeWidth="2">
          {/* Head */}
          <circle cx="128" cy="30" r="20" />
          
          {/* Neck */}
          <line x1="128" y1="50" x2="128" y2="70" />
          
          {/* Torso */}
          <rect x="108" y="70" width="40" height="80" rx="8" />
          
          {/* Arms */}
          <line x1="108" y1="80" x2="80" y2="120" strokeWidth="8" strokeLinecap="round" />
          <line x1="148" y1="80" x2="176" y2="120" strokeWidth="8" strokeLinecap="round" />
          
          {/* Legs */}
          <line x1="118" y1="150" x2="110" y2="220" strokeWidth="12" strokeLinecap="round" />
          <line x1="138" y1="150" x2="146" y2="220" strokeWidth="12" strokeLinecap="round" />
          
          {/* Lower legs */}
          <line x1="110" y1="220" x2="110" y2="280" strokeWidth="10" strokeLinecap="round" />
          <line x1="146" y1="220" x2="146" y2="280" strokeWidth="10" strokeLinecap="round" />
          
          {/* Feet */}
          <ellipse cx="110" cy="290" rx="8" ry="4" />
          <ellipse cx="146" cy="290" rx="8" ry="4" />
        </g>

        {/* Interactive body parts */}
        {bodyParts.map((bodyPart) => {
          const existingLog = getLogForBodyPart(bodyPart.name);
          const isHovered = hoveredPart === bodyPart.name;
          
          return (
            <circle
              key={bodyPart.name}
              cx={bodyPart.x}
              cy={bodyPart.y}
              r={isHovered ? "8" : "6"}
              fill={getPainColor(existingLog?.painLevel)}
              stroke="#FFFFFF"
              strokeWidth="2"
              className="cursor-pointer transition-all duration-200 hover:scale-110"
              onMouseEnter={() => setHoveredPart(bodyPart.name)}
              onMouseLeave={() => setHoveredPart(null)}
              onClick={() => handleBodyPartClick(bodyPart)}
            />
          );
        })}

        {/* Hover tooltip */}
        {hoveredPart && (
          <g>
            <rect
              x="10"
              y="10"
              width={hoveredPart.length * 6 + 20}
              height="25"
              rx="4"
              fill="#1F2937"
              fillOpacity="0.9"
            />
            <text
              x="20"
              y="27"
              fill="white"
              fontSize="12"
              fontFamily="Inter, sans-serif"
            >
              {hoveredPart}
            </text>
          </g>
        )}
      </svg>

      {/* Fallback text for when no SVG is supported */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 pointer-events-none">
        <div className="bg-white/80 rounded-lg p-4 backdrop-blur-sm">
          <div className="text-gray-600 text-sm mb-2">Interactive Body Map</div>
          <div className="text-gray-400 text-xs">Click on body parts to log symptoms</div>
        </div>
      </div>
    </div>
  );
}
