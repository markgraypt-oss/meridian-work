import { cn } from "@/lib/utils";
import { useRef, useEffect } from "react";

interface SeveritySliderProps {
  value: number[] | number;
  onValueChange: (value: number[] | number) => void;
  className?: string;
}

export function SeveritySlider({ value, onValueChange, className }: SeveritySliderProps) {
  const severity = Array.isArray(value) ? value[0] || 1 : value || 1;
  const sliderRef = useRef<HTMLInputElement>(null);

  const getHexColor = (s: number) => {
    if (s >= 7) return '#ef4444';
    if (s >= 4) return '#0cc9a9';
    return '#22c55e';
  };

  const getTextColor = (s: number) => {
    if (s >= 7) return "text-red-500";
    if (s >= 4) return "text-[#0cc9a9]";
    return "text-green-500";
  };

  const getDescription = (s: number) => {
    if (s >= 7) return "High";
    if (s >= 4) return "Moderate";
    return "Mild";
  };

  const color = getHexColor(severity);
  const pct = ((severity - 1) / 9) * 100;

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    el.style.setProperty('--severity-color', color);
    el.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #d1d5db ${pct}%, #d1d5db 100%)`;
  }, [severity, color, pct]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="text-center">
        <span className={cn("text-3xl font-bold", getTextColor(severity))}>
          {severity}
        </span>
        <span className="text-muted-foreground text-sm">/10</span>
      </div>
      <div className={cn("text-center text-sm font-medium", getTextColor(severity))}>
        {getDescription(severity)}
      </div>

      <input
        ref={sliderRef}
        type="range"
        value={severity}
        onChange={(e) => {
          const newValue = parseInt(e.target.value);
          if (Array.isArray(value)) {
            onValueChange([newValue]);
          } else {
            onValueChange(newValue);
          }
        }}
        max={10}
        min={1}
        step={1}
        className="severity-slider w-full"
      />

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>1-3 Mild</span>
        <span>4-6 Moderate</span>
        <span>7-10 High</span>
      </div>
    </div>
  );
}
