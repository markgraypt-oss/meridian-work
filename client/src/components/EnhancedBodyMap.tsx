import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BodyMapLog } from "@shared/schema";

interface EnhancedBodyMapProps {
  view: "front" | "back";
  onBodyPartClick: (bodyPart: string, x: number, y: number, view: "front" | "back") => void;
  existingLogs: BodyMapLog[];
  onViewToggle: () => void;
}

export default function EnhancedBodyMap({ 
  view, 
  onBodyPartClick, 
  existingLogs, 
  onViewToggle 
}: EnhancedBodyMapProps) {
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);

  const getPainColor = (severity: number) => {
    if (severity >= 7) return "#dc2626";
    if (severity >= 4) return "#0cc9a9";
    return "#16a34a";
  };

  const getBodyPartLogs = (bodyPart: string) => {
    return existingLogs.filter(log => 
      log.bodyPart === bodyPart && log.view === view
    ).sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  };

  const getBodyPartColor = (bodyPart: string) => {
    const logs = getBodyPartLogs(bodyPart);
    if (logs.length === 0) return "rgba(59, 130, 246, 0.15)";
    return getPainColor(logs[0].severity);
  };

  const mainBodyParts = {
    front: [
      { name: "Head", path: "M200,30 Q215,22 235,20 Q255,22 270,30 Q280,40 282,55 Q281,70 275,80 Q265,88 250,92 Q235,94 220,92 Q205,88 195,80 Q189,70 188,55 Q190,40 200,30 Z", x: 235, y: 55 },
      { name: "Neck", path: "M220,92 Q235,95 250,92 Q252,100 250,108 Q248,115 245,118 Q235,122 225,118 Q222,115 220,108 Q218,100 220,92 Z", x: 235, y: 105 },
      { name: "Chest", path: "M180,118 Q200,112 235,110 Q270,112 290,118 Q295,135 292,155 Q288,170 285,180 Q275,185 260,186 Q235,187 210,186 Q195,185 185,180 Q182,170 178,155 Q175,135 180,118 Z", x: 235, y: 150 },
      { name: "Left Shoulder", path: "M145,120 Q165,115 180,125 Q185,140 182,155 Q175,170 165,175 Q150,172 140,160 Q135,145 140,130 Q142,125 145,120 Z", x: 162, y: 147 },
      { name: "Right Shoulder", path: "M290,125 Q310,120 325,130 Q330,145 325,160 Q320,172 305,175 Q290,170 285,155 Q282,140 287,125 Q289,120 290,125 Z", x: 307, y: 147 },
      { name: "Left Arm", path: "M140,160 Q155,155 165,165 Q170,180 168,195 Q165,210 160,220 Q150,225 140,220 Q130,210 128,195 Q130,180 135,165 Q137,160 140,160 Z", x: 149, y: 190 },
      { name: "Right Arm", path: "M325,160 Q340,155 350,165 Q355,180 353,195 Q350,210 345,220 Q335,225 325,220 Q315,210 313,195 Q315,180 320,165 Q322,160 325,160 Z", x: 334, y: 190 },
      { name: "Left Elbow", path: "M128,195 Q138,193 148,200 Q150,210 148,220 Q145,230 138,234 Q128,232 121,225 Q119,215 121,205 Q124,197 128,195 Z", x: 134, y: 214 },
      { name: "Right Elbow", path: "M313,195 Q323,193 333,200 Q335,210 333,220 Q330,230 323,234 Q313,232 306,225 Q304,215 306,205 Q309,197 313,195 Z", x: 319, y: 214 },
      { name: "Left Forearm", path: "M135,220 Q145,218 155,225 Q158,240 155,255 Q152,270 145,282 Q135,285 125,280 Q118,268 117,255 Q119,240 125,225 Q130,220 135,220 Z", x: 140, y: 251 },
      { name: "Right Forearm", path: "M315,225 Q325,223 335,230 Q338,245 335,260 Q332,275 325,287 Q315,290 305,285 Q298,273 297,260 Q299,245 305,230 Q310,225 315,225 Z", x: 320, y: 256 },
      { name: "Left Wrist", path: "M117,282 Q127,280 137,287 Q139,295 137,303 Q134,311 127,315 Q117,313 110,306 Q108,298 110,290 Q113,284 117,282 Z", x: 123, y: 298 },
      { name: "Right Wrist", path: "M333,287 Q343,285 353,292 Q355,300 353,308 Q350,316 343,320 Q333,318 326,311 Q324,303 326,295 Q329,289 333,287 Z", x: 339, y: 303 },
      { name: "Abdomen", path: "M185,180 Q210,178 235,179 Q260,178 285,180 Q287,195 285,210 Q282,225 278,238 Q270,245 255,247 Q235,248 215,247 Q200,245 192,238 Q188,225 185,210 Q183,195 185,180 Z", x: 235, y: 214 },
      { name: "Lower Back", path: "M200,238 Q218,235 235,236 Q252,235 270,238 Q272,250 270,262 Q267,275 263,285 Q255,290 240,291 Q235,291 230,291 Q215,290 207,285 Q203,275 200,262 Q198,250 200,238 Z", x: 235, y: 264 },
      { name: "Left Hip", path: "M185,285 Q205,280 220,290 Q225,305 222,320 Q218,335 210,345 Q200,350 185,345 Q170,335 168,320 Q170,305 175,290 Q180,285 185,285 Z", x: 196, y: 315 },
      { name: "Right Hip", path: "M250,290 Q270,285 285,295 Q295,305 300,320 Q302,335 295,345 Q285,350 270,345 Q255,335 252,320 Q250,305 255,295 Q248,290 250,290 Z", x: 274, y: 315 },
      { name: "Left Thigh", path: "M170,345 Q190,340 210,350 Q215,370 212,390 Q208,410 200,425 Q185,430 170,425 Q155,410 152,390 Q155,370 160,350 Q165,345 170,345 Z", x: 183, y: 387 },
      { name: "Right Thigh", path: "M260,350 Q280,345 300,355 Q305,375 302,395 Q298,415 290,430 Q275,435 260,430 Q245,415 242,395 Q245,375 250,355 Q255,350 260,350 Z", x: 273, y: 392 },
      { name: "Left Knee", path: "M152,425 Q172,420 192,430 Q195,440 192,450 Q188,460 180,465 Q170,467 160,465 Q150,460 148,450 Q150,440 152,430 Q152,425 152,425 Z", x: 171, y: 445 },
      { name: "Right Knee", path: "M242,430 Q262,425 282,435 Q285,445 282,455 Q278,465 270,470 Q260,472 250,470 Q240,465 238,455 Q240,445 242,435 Q242,430 242,430 Z", x: 261, y: 450 },
      { name: "Left Ankle", path: "M148,465 Q158,463 168,470 Q170,478 168,486 Q165,494 158,498 Q148,496 141,489 Q139,481 141,473 Q144,467 148,465 Z", x: 155, y: 481 },
      { name: "Right Ankle", path: "M238,470 Q248,468 258,475 Q260,483 258,491 Q255,499 248,503 Q238,501 231,494 Q229,486 231,478 Q234,472 238,470 Z", x: 245, y: 486 },
      { name: "Left Foot", path: "M139,498 Q149,496 159,503 Q161,511 159,519 Q156,527 149,531 Q139,529 132,522 Q130,514 132,506 Q135,500 139,498 Z", x: 146, y: 514 },
      { name: "Right Foot", path: "M229,503 Q239,501 249,508 Q251,516 249,524 Q246,532 239,536 Q229,534 222,527 Q220,519 222,511 Q225,505 229,503 Z", x: 236, y: 519 }
    ],
    back: [
      { name: "Head", path: "M200,30 Q215,22 235,20 Q255,22 270,30 Q280,40 282,55 Q281,70 275,80 Q265,88 250,92 Q235,94 220,92 Q205,88 195,80 Q189,70 188,55 Q190,40 200,30 Z", x: 235, y: 55 },
      { name: "Neck", path: "M220,92 Q235,95 250,92 Q252,100 250,108 Q248,115 245,118 Q235,122 225,118 Q222,115 220,108 Q218,100 220,92 Z", x: 235, y: 105 },
      { name: "Upper Back", path: "M180,118 Q200,112 235,110 Q270,112 290,118 Q295,135 292,155 Q288,170 285,180 Q275,185 260,186 Q235,187 210,186 Q195,185 185,180 Q182,170 178,155 Q175,135 180,118 Z", x: 235, y: 150 },
      { name: "Left Shoulder", path: "M145,120 Q165,115 180,125 Q185,140 182,155 Q175,170 165,175 Q150,172 140,160 Q135,145 140,130 Q142,125 145,120 Z", x: 162, y: 147 },
      { name: "Right Shoulder", path: "M290,125 Q310,120 325,130 Q330,145 325,160 Q320,172 305,175 Q290,170 285,155 Q282,140 287,125 Q289,120 290,125 Z", x: 307, y: 147 },
      { name: "Left Elbow", path: "M128,195 Q138,193 148,200 Q150,210 148,220 Q145,230 138,234 Q128,232 121,225 Q119,215 121,205 Q124,197 128,195 Z", x: 134, y: 214 },
      { name: "Right Elbow", path: "M313,195 Q323,193 333,200 Q335,210 333,220 Q330,230 323,234 Q313,232 306,225 Q304,215 306,205 Q309,197 313,195 Z", x: 319, y: 214 },
      { name: "Left Forearm", path: "M135,220 Q145,218 155,225 Q158,240 155,255 Q152,270 145,282 Q135,285 125,280 Q118,268 117,255 Q119,240 125,225 Q130,220 135,220 Z", x: 140, y: 251 },
      { name: "Right Forearm", path: "M315,225 Q325,223 335,230 Q338,245 335,260 Q332,275 325,287 Q315,290 305,285 Q298,273 297,260 Q299,245 305,230 Q310,225 315,225 Z", x: 320, y: 256 },
      { name: "Left Wrist", path: "M117,282 Q127,280 137,287 Q139,295 137,303 Q134,311 127,315 Q117,313 110,306 Q108,298 110,290 Q113,284 117,282 Z", x: 123, y: 298 },
      { name: "Right Wrist", path: "M333,287 Q343,285 353,292 Q355,300 353,308 Q350,316 343,320 Q333,318 326,311 Q324,303 326,295 Q329,289 333,287 Z", x: 339, y: 303 },
      { name: "Middle Back", path: "M185,180 Q210,178 235,179 Q260,178 285,180 Q287,195 285,210 Q282,225 278,238 Q270,245 255,247 Q235,248 215,247 Q200,245 192,238 Q188,225 185,210 Q183,195 185,180 Z", x: 235, y: 214 },
      { name: "Lower Back", path: "M200,238 Q218,235 235,236 Q252,235 270,238 Q272,250 270,262 Q267,275 263,285 Q255,290 240,291 Q235,291 230,291 Q215,290 207,285 Q203,275 200,262 Q198,250 200,238 Z", x: 235, y: 264 },
      { name: "Left Glute", path: "M185,285 Q205,280 220,285 Q225,300 222,315 Q218,330 210,340 Q200,345 185,340 Q175,330 172,315 Q175,300 180,285 Q182,280 185,285 Z", x: 203, y: 315 },
      { name: "Right Glute", path: "M250,285 Q265,280 285,285 Q290,300 287,315 Q283,330 275,340 Q265,345 250,340 Q240,330 237,315 Q240,300 245,285 Q247,280 250,285 Z", x: 267, y: 315 },
      { name: "Left Hamstring", path: "M170,345 Q190,340 210,350 Q215,370 212,390 Q208,410 200,425 Q185,430 170,425 Q155,410 152,390 Q155,370 160,350 Q165,345 170,345 Z", x: 183, y: 387 },
      { name: "Right Hamstring", path: "M260,350 Q280,345 300,355 Q305,375 302,395 Q298,415 290,430 Q275,435 260,430 Q245,415 242,395 Q245,375 250,355 Q255,350 260,350 Z", x: 273, y: 392 },
      { name: "Left Ankle", path: "M148,465 Q158,463 168,470 Q170,478 168,486 Q165,494 158,498 Q148,496 141,489 Q139,481 141,473 Q144,467 148,465 Z", x: 155, y: 481 },
      { name: "Right Ankle", path: "M238,470 Q248,468 258,475 Q260,483 258,491 Q255,499 248,503 Q238,501 231,494 Q229,486 231,478 Q234,472 238,470 Z", x: 245, y: 486 },
      { name: "Left Foot", path: "M139,498 Q149,496 159,503 Q161,511 159,519 Q156,527 149,531 Q139,529 132,522 Q130,514 132,506 Q135,500 139,498 Z", x: 146, y: 514 },
      { name: "Right Foot", path: "M229,503 Q239,501 249,508 Q251,516 249,524 Q246,532 239,536 Q229,534 222,527 Q220,519 222,511 Q225,505 229,503 Z", x: 236, y: 519 }
    ]
  };

  const handleRegionClick = (regionName: string, event: React.MouseEvent<SVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const svg = event.currentTarget.closest('svg')!;
    const svgRect = svg.getBoundingClientRect();
    
    const x = ((event.clientX - svgRect.left) / svgRect.width) * 100;
    const y = ((event.clientY - svgRect.top) / svgRect.height) * 100;
    
    onBodyPartClick(regionName, x, y, view);
  };

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-4 right-4 z-10 flex space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onViewToggle}
          className="bg-background/90 dark:bg-background/90 backdrop-blur-sm"
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          {view === "front" ? "Back" : "Front"}
        </Button>
      </div>

      <div className="flex justify-center items-center min-h-[600px] bg-background dark:bg-background">
        <div className="relative">
          <svg
            width="470"
            height="600"
            viewBox="0 0 470 600"
            className="drop-shadow-lg"
          >
            {/* Main body outline */}
            <path
              d="M235,20 Q280,25 320,60 Q350,100 355,150 Q360,200 350,250 Q345,300 335,350 Q325,400 315,450 Q305,500 295,540 L175,540 Q165,500 155,450 Q145,400 135,350 Q125,300 120,250 Q110,200 115,150 Q120,100 150,60 Q190,25 235,20 Z"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="2"
              opacity="0.3"
            />

            {/* Body parts */}
            {mainBodyParts[view].map((part) => (
              <g key={part.name}>
                <path
                  d={part.path}
                  fill={getBodyPartColor(part.name)}
                  stroke={hoveredPart === part.name ? "#3b82f6" : "#94a3b8"}
                  strokeWidth={hoveredPart === part.name ? "3" : "1.5"}
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => setHoveredPart(part.name)}
                  onMouseLeave={() => setHoveredPart(null)}
                  onClick={(e) => handleRegionClick(part.name, e)}
                  data-testid={`body-part-${part.name.toLowerCase().replace(/ /g, '-')}`}
                />
                {hoveredPart === part.name && (
                  <text
                    x={part.x}
                    y={part.y}
                    textAnchor="middle"
                    className="fill-white text-sm font-bold pointer-events-none"
                    style={{ textShadow: '0 0 4px rgba(0, 0, 0, 0.8)' }}
                  >
                    {part.name}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
