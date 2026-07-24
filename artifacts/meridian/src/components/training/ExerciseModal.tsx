import { useState, useEffect, Component, ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import MuxPlayer from "@mux/mux-player-react";
import { getMuxThumbnailUrl } from "@/lib/mux";

class MuxPlayerErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: false };
  }
  componentDidCatch() {}
  render() {
    return this.props.children;
  }
}

interface ExerciseModalProps {
  exercise: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function ExerciseModal({ exercise, isOpen, onClose }: ExerciseModalProps) {
  const [showModal, setShowModal] = useState(isOpen);

  useEffect(() => {
    setShowModal(isOpen);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!showModal || !exercise) return null;

  // Parse instructions into numbered list
  const instructionsList = exercise.instructions
    ? exercise.instructions.split(/\n/).filter((line: string) => line.trim())
    : [];

  // Parse tags
  const tags = [];
  if (exercise.mainMuscle && exercise.mainMuscle.length > 0) {
    tags.push(...exercise.mainMuscle);
  }
  if (exercise.equipment && exercise.equipment.length > 0) {
    tags.push(...exercise.equipment);
  }
  if (exercise.level) {
    tags.push(exercise.level);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 overflow-y-auto pt-12">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 sticky top-0 bg-black/90 z-50">
        <button
          onClick={onClose}
          className="text-white hover:text-gray-300 transition-colors"
          data-testid="button-close-exercise-modal"
        >
          <X className="h-6 w-6" />
        </button>
        <button
          className="text-white hover:text-gray-300 transition-colors"
          data-testid="button-exercise-modal-menu"
        >
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="pb-20">
        {/* Video Section */}
        <div className="relative bg-black">
          {exercise.muxPlaybackId && exercise.muxPlaybackId.length >= 10 ? (
            <div className="relative aspect-video bg-black overflow-hidden">
              <MuxPlayerErrorBoundary>
                <MuxPlayer
                  playbackId={exercise.muxPlaybackId}
                  streamType="on-demand"
                  style={{ width: '100%', height: '100%' }}
                  poster={getMuxThumbnailUrl(exercise.muxPlaybackId) || undefined}
                  data-testid="mux-player-exercise-modal"
                />
              </MuxPlayerErrorBoundary>
            </div>
          ) : (
            <div className="aspect-video bg-gray-800 flex items-center justify-center">
              <p className="text-gray-400">No video available</p>
            </div>
          )}
        </div>

        {/* Exercise Info - Overlay on Image */}
        <div className="px-4 py-6 bg-background">
          <div className="text-white text-sm font-semibold tracking-wide mb-2">
            {exercise.level || "EXERCISE"}
          </div>
          <h1 className="text-white text-2xl font-bold uppercase leading-tight mb-4">
            {exercise.name}
          </h1>

          {/* Category/Movement Type */}
          {exercise.movement && exercise.movement.length > 0 && (
            <p className="text-gray-400 text-sm mb-6">
              {exercise.movement[0]}
            </p>
          )}

          {/* Instructions Section */}
          {instructionsList.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Text Instructions (optional)</h2>
                <button className="text-primary text-sm font-semibold">Edit</button>
              </div>
              <ol className="space-y-3">
                {instructionsList.map((instruction: string, idx: number) => (
                  <li key={idx} className="flex gap-3">
                    <span className="flex-shrink-0 font-bold text-foreground text-sm">{idx + 1}.</span>
                    <span className="text-sm text-foreground leading-relaxed">{instruction}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Tags Section */}
          {tags.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Tags (optional)</h3>
                <button className="text-primary text-sm font-semibold">Edit</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-gray-700 text-gray-200 rounded-full text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
