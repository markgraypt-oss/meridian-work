import { Link, useLocation } from "wouter";
import { Home, Dumbbell, Heart, Zap, Sparkles } from "lucide-react";
import { useState } from "react";

interface BottomNavigationProps {
  onCoachOpen?: () => void;
}

export default function BottomNavigation({ onCoachOpen }: BottomNavigationProps) {
  const [location] = useLocation();
  const [tappedIndex, setTappedIndex] = useState<number | null>(null);
  const [coachTapped, setCoachTapped] = useState(false);

  const navItems = [
    { 
      href: "/", 
      icon: Home, 
      label: "Home",
      active: location === "/"
    },
    { 
      href: "/training", 
      icon: Dumbbell, 
      label: "Movement",
      active: location === "/training" || location.startsWith("/training/") || location.startsWith("/program")
    },
    { 
      href: "/recovery", 
      icon: Heart, 
      label: "Recovery",
      active: location === "/recovery" || location.startsWith("/recovery/")
    },
    { 
      href: "/perform", 
      icon: Zap, 
      label: "Perform",
      active: location === "/perform" || location === "/nutrition" || location === "/goals" || location.startsWith("/habit") || location === "/education-lab" || location.startsWith("/education-lab/")
    },
  ];

  const handleTap = (index: number) => {
    setTappedIndex(index);
    setTimeout(() => setTappedIndex(null), 150);
  };

  const handleCoachTap = () => {
    setCoachTapped(true);
    setTimeout(() => setCoachTapped(false), 150);
    onCoachOpen?.();
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-40 px-3"
      data-testid="bottom-navigation"
      style={{ 
        pointerEvents: 'none',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
      }}
    >
      <div className="mx-auto max-w-md flex items-center gap-2">
        <div 
          className="flex-1 rounded-2xl backdrop-blur-xl border border-black/[0.06]"
          style={{ 
            pointerEvents: 'auto',
            background: 'rgba(255, 255, 255, 0.78)',
            boxShadow: '0 -2px 20px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
          }}
        >
          <div className="grid grid-cols-4 h-[60px]">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isTapped = tappedIndex === index;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => handleTap(index)}
                  className="flex flex-col items-center justify-center gap-0.5 transition-all duration-150 relative"
                  data-testid={`nav-${item.label.toLowerCase()}`}
                  style={{
                    transform: isTapped ? 'scale(0.92)' : 'scale(1)',
                    transition: 'transform 150ms ease',
                  }}
                >
                  <Icon 
                    className="h-5 w-5 relative z-10 transition-colors duration-150"
                    style={{
                      color: item.active ? '#0cc9a9' : 'rgba(60, 65, 75, 0.7)',
                      strokeWidth: item.active ? 2.5 : 2,
                    }}
                  />
                  <span 
                    className="text-[10px] font-medium relative z-10 transition-colors duration-150"
                    style={{
                      color: item.active ? '#0cc9a9' : 'rgba(60, 65, 75, 0.55)',
                    }}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {onCoachOpen && (
          <button
            onClick={handleCoachTap}
            className="flex items-center justify-center rounded-full shrink-0 transition-all duration-150"
            style={{
              pointerEvents: 'auto',
              width: '52px',
              height: '52px',
              background: 'linear-gradient(135deg, #0cc9a9 0%, #0ab393 100%)',
              boxShadow: '0 4px 20px rgba(12, 201, 169, 0.35), 0 2px 8px rgba(0, 0, 0, 0.3)',
              transform: coachTapped ? 'scale(0.9)' : 'scale(1)',
              transition: 'transform 150ms ease',
            }}
          >
            <Sparkles className="h-5 w-5 text-white" />
          </button>
        )}
      </div>
    </nav>
  );
}
