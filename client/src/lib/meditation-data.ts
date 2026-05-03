import {
  Headphones,
  Brain,
  Leaf,
  Eye,
  Moon,
  Heart,
} from "lucide-react";

export interface MeditationItem {
  id: number;
  title: string;
  durationMin: number;
  category: string;
  description: string | null;
}

export const meditationCategories = ["All", "Focus", "Relaxation", "Awareness", "Sleep", "Emotional"];

export function getCategoryIcon(category: string) {
  switch (category) {
    case "Focus": return Brain;
    case "Relaxation": return Leaf;
    case "Awareness": return Eye;
    case "Sleep": return Moon;
    case "Emotional": return Heart;
    default: return Headphones;
  }
}

export function getCategoryStyle(category: string) {
  switch (category) {
    case "Focus": return { color: "#818cf8", bg: "rgba(129, 140, 248, 0.1)" };
    case "Relaxation": return { color: "#2dd4bf", bg: "rgba(45, 212, 191, 0.1)" };
    case "Awareness": return { color: "#fbbf24", bg: "rgba(251, 191, 36, 0.1)" };
    case "Sleep": return { color: "#a78bfa", bg: "rgba(167, 139, 250, 0.1)" };
    case "Emotional": return { color: "#fb7185", bg: "rgba(251, 113, 133, 0.1)" };
    default: return { color: "#94a3b8", bg: "rgba(148, 163, 184, 0.1)" };
  }
}
