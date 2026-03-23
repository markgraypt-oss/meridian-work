import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface FloatingActionButtonProps {
  onClick: () => void;
  className?: string;
  isMenuOpen?: boolean;
}

export default function FloatingActionButton({ onClick, className = "", isMenuOpen = false }: FloatingActionButtonProps) {
  if (isMenuOpen) return null;
  
  return (
    <div className={`fixed bottom-28 right-5 z-40 ${className}`}>
      <Button
        className="rounded-full h-10 w-10 p-0 flex items-center justify-center"
        style={{ 
          background: '#0cc9a9',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15), 0 2px 6px rgba(0, 0, 0, 0.08)',
        }}
        onClick={onClick}
        data-testid="button-fab-add-activity"
      >
        <Plus className="h-5 w-5 text-black" />
      </Button>
    </div>
  );
}
