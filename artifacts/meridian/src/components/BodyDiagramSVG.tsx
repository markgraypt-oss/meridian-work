interface BodyDiagramProps {
  view: 'front' | 'back';
  onRegionClick: (regionId: string) => void;
  selectedRegion?: string | null;
}

interface BodyRegion {
  id: string;
  name: string;
  paths: {
    front?: string;
    back?: string;
  };
}

const bodyRegions: BodyRegion[] = [
  {
    id: "neck",
    name: "Neck",
    paths: {
      front: "M180 80 C190 75, 210 75, 220 80 L225 110 C220 115, 200 120, 200 120 C200 120, 180 115, 175 110 Z",
      back: "M180 80 C190 75, 210 75, 220 80 L225 110 C220 115, 200 120, 200 120 C200 120, 180 115, 175 110 Z"
    }
  },
  {
    id: "shoulders",
    name: "Shoulders",
    paths: {
      front: "M120 120 C110 115, 100 125, 105 140 L115 180 C120 185, 130 185, 135 180 L145 140 C150 125, 140 115, 130 120 Z M270 120 C280 115, 290 125, 285 140 L275 180 C270 185, 260 185, 255 180 L245 140 C240 125, 250 115, 260 120 Z",
      back: "M120 120 C110 115, 100 125, 105 140 L115 180 C120 185, 130 185, 135 180 L145 140 C150 125, 140 115, 130 120 Z M270 120 C280 115, 290 125, 285 140 L275 180 C270 185, 260 185, 255 180 L245 140 C240 125, 250 115, 260 120 Z"
    }
  },
  {
    id: "upper_back",
    name: "Upper Back",
    paths: {
      front: "",
      back: "M150 120 C160 115, 240 115, 250 120 L255 200 C250 205, 200 210, 200 210 C200 210, 150 205, 145 200 Z"
    }
  },
  {
    id: "lower_back",
    name: "Lower Back",
    paths: {
      front: "M160 210 C170 205, 230 205, 240 210 L245 280 C240 285, 200 290, 200 290 C200 290, 160 285, 155 280 Z",
      back: "M150 210 C160 205, 240 205, 250 210 L255 280 C250 285, 200 290, 200 290 C200 290, 150 285, 145 280 Z"
    }
  },
  {
    id: "hips",
    name: "Hips",
    paths: {
      front: "M155 280 C165 275, 235 275, 245 280 L250 330 C245 335, 200 340, 200 340 C200 340, 155 335, 150 330 Z",
      back: "M155 280 C165 275, 235 275, 245 280 L250 330 C245 335, 200 340, 200 340 C200 340, 155 335, 150 330 Z"
    }
  },
  {
    id: "knees",
    name: "Knees",
    paths: {
      front: "M170 420 C175 415, 185 415, 190 420 L195 450 C190 455, 180 455, 175 450 Z M210 420 C215 415, 225 415, 230 420 L235 450 C230 455, 220 455, 215 450 Z",
      back: "M170 420 C175 415, 185 415, 190 420 L195 450 C190 455, 180 455, 175 450 Z M210 420 C215 415, 225 415, 230 420 L235 450 C230 455, 220 455, 215 450 Z"
    }
  },
  {
    id: "ankles_feet",
    name: "Ankles & Feet",
    paths: {
      front: "M165 520 C170 515, 185 515, 190 520 L195 560 C190 565, 175 565, 170 560 Z M210 520 C215 515, 230 515, 235 520 L240 560 C235 565, 220 565, 215 560 Z",
      back: "M165 520 C170 515, 185 515, 190 520 L195 560 C190 565, 175 565, 170 560 Z M210 520 C215 515, 230 515, 235 520 L240 560 C235 565, 220 565, 215 560 Z"
    }
  }
];

export default function BodyDiagramSVG({ view, onRegionClick, selectedRegion }: BodyDiagramProps) {
  const handleRegionClick = (regionId: string) => {
    onRegionClick(regionId);
  };

  return (
    <div className="relative w-full max-w-sm mx-auto">
      <svg
        viewBox="0 0 400 600"
        className="w-full h-auto"
        style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))' }}
      >
        <defs>
          <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="selectedGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>

        {/* Main body outline - Medical style anatomical figure */}
        <path
          d="M200 50
             C190 50, 180 55, 175 65
             L175 90
             C170 95, 160 100, 150 110
             L140 140
             C135 145, 135 155, 140 160
             L145 200
             C140 205, 140 220, 145 225
             L150 270
             C145 275, 145 285, 150 290
             L155 320
             C150 325, 150 335, 155 340
             L160 380
             C155 385, 155 395, 160 400
             L165 440
             C160 445, 160 455, 165 460
             L170 500
             C165 505, 165 515, 170 520
             L175 550
             C170 555, 175 565, 185 560
             L190 545
             L190 520
             L195 500
             L200 460
             L205 500
             L210 520
             L210 545
             L215 560
             C225 565, 230 555, 225 550
             L230 520
             C235 515, 235 505, 230 500
             L235 460
             C240 455, 240 445, 235 440
             L240 400
             C245 395, 245 385, 240 380
             L245 340
             C250 335, 250 325, 245 320
             L250 290
             C255 285, 255 275, 250 270
             L255 225
             C260 220, 260 205, 255 200
             L260 160
             C265 155, 265 145, 260 140
             L250 110
             C240 100, 230 95, 225 90
             L225 65
             C220 55, 210 50, 200 50 Z"
          fill="url(#bodyGradient)"
          stroke="#64748b"
          strokeWidth="2"
        />

        {/* Clickable regions with realistic positioning */}
        {/* Neck */}
        <ellipse
          cx="200"
          cy="75"
          rx="15"
          ry="20"
          fill={selectedRegion === "neck" ? "url(#selectedGradient)" : "rgba(59, 130, 246, 0.1)"}
          stroke="#3b82f6"
          strokeWidth="2"
          strokeOpacity={selectedRegion === "neck" ? 1 : 0.3}
          className="cursor-pointer transition-all duration-200 hover:fill-blue-100 hover:stroke-blue-500 hover:stroke-opacity-100"
          onClick={() => handleRegionClick("neck")}
        >
          <title>Click to assess Neck</title>
        </ellipse>

        {/* Shoulders */}
        <ellipse
          cx="165"
          cy="125"
          rx="25"
          ry="20"
          fill={selectedRegion === "shoulders" ? "url(#selectedGradient)" : "rgba(59, 130, 246, 0.1)"}
          stroke="#3b82f6"
          strokeWidth="2"
          strokeOpacity={selectedRegion === "shoulders" ? 1 : 0.3}
          className="cursor-pointer transition-all duration-200 hover:fill-blue-100 hover:stroke-blue-500 hover:stroke-opacity-100"
          onClick={() => handleRegionClick("shoulders")}
        >
          <title>Click to assess Left Shoulder</title>
        </ellipse>
        <ellipse
          cx="235"
          cy="125"
          rx="25"
          ry="20"
          fill={selectedRegion === "shoulders" ? "url(#selectedGradient)" : "rgba(59, 130, 246, 0.1)"}
          stroke="#3b82f6"
          strokeWidth="2"
          strokeOpacity={selectedRegion === "shoulders" ? 1 : 0.3}
          className="cursor-pointer transition-all duration-200 hover:fill-blue-100 hover:stroke-blue-500 hover:stroke-opacity-100"
          onClick={() => handleRegionClick("shoulders")}
        >
          <title>Click to assess Right Shoulder</title>
        </ellipse>

        {/* Upper Back - Only visible on back view */}
        {view === 'back' && (
          <rect
            x="170"
            y="150"
            width="60"
            height="40"
            rx="10"
            fill={selectedRegion === "upper_back" ? "url(#selectedGradient)" : "rgba(59, 130, 246, 0.1)"}
            stroke="#3b82f6"
            strokeWidth="2"
            strokeOpacity={selectedRegion === "upper_back" ? 1 : 0.3}
            className="cursor-pointer transition-all duration-200 hover:fill-blue-100 hover:stroke-blue-500 hover:stroke-opacity-100"
            onClick={() => handleRegionClick("upper_back")}
          >
            <title>Click to assess Upper Back</title>
          </rect>
        )}

        {/* Lower Back */}
        <rect
          x="175"
          y="240"
          width="50"
          height="35"
          rx="8"
          fill={selectedRegion === "lower_back" ? "url(#selectedGradient)" : "rgba(59, 130, 246, 0.1)"}
          stroke="#3b82f6"
          strokeWidth="2"
          strokeOpacity={selectedRegion === "lower_back" ? 1 : 0.3}
          className="cursor-pointer transition-all duration-200 hover:fill-blue-100 hover:stroke-blue-500 hover:stroke-opacity-100"
          onClick={() => handleRegionClick("lower_back")}
        >
          <title>Click to assess Lower Back</title>
        </rect>

        {/* Hips */}
        <ellipse
          cx="200"
          cy="305"
          rx="35"
          ry="20"
          fill={selectedRegion === "hips" ? "url(#selectedGradient)" : "rgba(59, 130, 246, 0.1)"}
          stroke="#3b82f6"
          strokeWidth="2"
          strokeOpacity={selectedRegion === "hips" ? 1 : 0.3}
          className="cursor-pointer transition-all duration-200 hover:fill-blue-100 hover:stroke-blue-500 hover:stroke-opacity-100"
          onClick={() => handleRegionClick("hips")}
        >
          <title>Click to assess Hips</title>
        </ellipse>

        {/* Knees */}
        <ellipse
          cx="185"
          cy="420"
          rx="12"
          ry="18"
          fill={selectedRegion === "knees" ? "url(#selectedGradient)" : "rgba(59, 130, 246, 0.1)"}
          stroke="#3b82f6"
          strokeWidth="2"
          strokeOpacity={selectedRegion === "knees" ? 1 : 0.3}
          className="cursor-pointer transition-all duration-200 hover:fill-blue-100 hover:stroke-blue-500 hover:stroke-opacity-100"
          onClick={() => handleRegionClick("knees")}
        >
          <title>Click to assess Left Knee</title>
        </ellipse>
        <ellipse
          cx="215"
          cy="420"
          rx="12"
          ry="18"
          fill={selectedRegion === "knees" ? "url(#selectedGradient)" : "rgba(59, 130, 246, 0.1)"}
          stroke="#3b82f6"
          strokeWidth="2"
          strokeOpacity={selectedRegion === "knees" ? 1 : 0.3}
          className="cursor-pointer transition-all duration-200 hover:fill-blue-100 hover:stroke-blue-500 hover:stroke-opacity-100"
          onClick={() => handleRegionClick("knees")}
        >
          <title>Click to assess Right Knee</title>
        </ellipse>

        {/* Ankles & Feet */}
        <ellipse
          cx="185"
          cy="535"
          rx="15"
          ry="12"
          fill={selectedRegion === "ankles_feet" ? "url(#selectedGradient)" : "rgba(59, 130, 246, 0.1)"}
          stroke="#3b82f6"
          strokeWidth="2"
          strokeOpacity={selectedRegion === "ankles_feet" ? 1 : 0.3}
          className="cursor-pointer transition-all duration-200 hover:fill-blue-100 hover:stroke-blue-500 hover:stroke-opacity-100"
          onClick={() => handleRegionClick("ankles_feet")}
        >
          <title>Click to assess Left Ankle & Foot</title>
        </ellipse>
        <ellipse
          cx="215"
          cy="535"
          rx="15"
          ry="12"
          fill={selectedRegion === "ankles_feet" ? "url(#selectedGradient)" : "rgba(59, 130, 246, 0.1)"}
          stroke="#3b82f6"
          strokeWidth="2"
          strokeOpacity={selectedRegion === "ankles_feet" ? 1 : 0.3}
          className="cursor-pointer transition-all duration-200 hover:fill-blue-100 hover:stroke-blue-500 hover:stroke-opacity-100"
          onClick={() => handleRegionClick("ankles_feet")}
        >
          <title>Click to assess Right Ankle & Foot</title>
        </ellipse>
      </svg>
    </div>
  );
}