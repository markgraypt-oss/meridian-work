import {
  Headphones,
  Brain,
  Leaf,
  Eye,
  Moon,
  Heart,
} from "lucide-react";

export const placeholderMeditations = [
  { id: 1, title: "Morning Calm", durationMin: 5, category: "Focus", description: "Start your day with clarity and intention" },
  { id: 2, title: "Stress Relief", durationMin: 10, category: "Relaxation", description: "Release tension and find your center" },
  { id: 3, title: "Body Scan", durationMin: 15, category: "Awareness", description: "Connect with your body from head to toe" },
  { id: 4, title: "Evening Wind Down", durationMin: 8, category: "Sleep", description: "Prepare your mind for restful sleep" },
  { id: 5, title: "Focus Boost", durationMin: 7, category: "Focus", description: "Sharpen concentration before deep work" },
  { id: 6, title: "Compassion Practice", durationMin: 12, category: "Emotional", description: "Cultivate kindness toward yourself and others" },
];

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
