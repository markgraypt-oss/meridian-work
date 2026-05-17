import { Link, useLocation } from "wouter";
import { Home, Dumbbell, Heart, Zap, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useTodayBriefing } from "@/hooks/useTodayBriefing";

interface BottomNavigationProps {
  onCoachOpen?: () => void;
}

export default function BottomNavigation({ onCoachOpen }: BottomNavigationProps) {
  const [location] = useLocation();
  const [tappedIndex, setTappedIndex] = useState<number | null>(null);
  const [coachTapped, setCoachTapped] = useState(false);
  const { briefing, isUnread } = useTodayBriefing(!!onCoachOpen);
  const tooltipKey = briefing ? `coach-briefing-tooltip-${briefing.id}` : null;
  const [showTooltip, setShowTooltip] = useState(false);
  const isHome = location === '/';

  useEffect(() => {
    if (!isUnread || !tooltipKey || !isHome || !briefingTooltipRelevant) {
      setShowTooltip(false);
      return;
    }
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(tooltipKey) === 'seen') return;
    // Small delay so the tooltip appears after the home view settles.
    const open = window.setTimeout(() => setShowTooltip(true), 400);
    const dismiss = () => {
      setShowTooltip(false);
      try { window.localStorage.setItem(tooltipKey, 'seen'); } catch {}
    };
    const t = window.setTimeout(dismiss, 6000);
    window.addEventListener('scroll', dismiss, { once: true, passive: true });
    window.addEventListener('touchstart', dismiss, { once: true, passive: true });
    return () => {
      window.clearTimeout(open);
      window.clearTimeout(t);
      window.removeEventListener('scroll', dismiss);
      window.removeEventListener('touchstart', dismiss);
    };
  }, [isUnread, tooltipKey, isHome, briefingTooltipRelevant]);

  const isMorning = briefing?.type === 'morning';
  const currentHour = new Date().getHours();
  // Morning tooltip only before noon; evening tooltip only from 20:00 (matches when the briefing is generated)
  const briefingTooltipRelevant = isMorning ? currentHour < 12 : currentHour >= 20;
  const tooltipGreeting = isMorning ? 'Good morning ☀️' : 'Evening check-in 🌙';
  const tooltipCta = isMorning
    ? "Your briefing is ready — tap to start the day."
    : "Let's wrap up the day — tap for your debrief.";
  const ariaLabel = isUnread
    ? `${tooltipGreeting}. ${tooltipCta}`
    : 'Open Coach';

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
    if (tooltipKey) {
      setShowTooltip(false);
      try { window.localStorage.setItem(tooltipKey, 'seen'); } catch {}
    }
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
          <div className="relative shrink-0" style={{ pointerEvents: 'auto' }}>
            {isUnread && (
              <span
                className="absolute inset-0 rounded-full animate-ping"
                style={{ background: 'rgba(12, 201, 169, 0.45)' }}
                aria-hidden
              />
            )}
            <button
              onClick={handleCoachTap}
              className="relative flex items-center justify-center rounded-full transition-all duration-150"
              data-testid="button-coach-fab"
              aria-label={ariaLabel}
              style={{
                width: '52px',
                height: '52px',
                background: 'linear-gradient(135deg, #0cc9a9 0%, #0ab393 100%)',
                boxShadow: '0 4px 20px rgba(12, 201, 169, 0.35), 0 2px 8px rgba(0, 0, 0, 0.3)',
                transform: coachTapped ? 'scale(0.9)' : 'scale(1)',
                transition: 'transform 150ms ease',
              }}
            >
              <Sparkles className="h-5 w-5 text-white" />
              {isUnread && (
                <span
                  className="absolute top-0.5 right-0.5 block h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500"
                  data-testid="badge-coach-unread"
                  aria-hidden
                />
              )}
            </button>
            {showTooltip && (
              <div
                className="absolute bottom-full right-0 mb-2.5 w-[230px] px-3.5 py-2.5 rounded-2xl rounded-br-sm text-white shadow-xl text-left"
                style={{ background: '#1f2937', animation: 'fadeSlideIn 220ms ease-out' }}
                role="tooltip"
                data-testid="tooltip-coach-briefing"
                onClick={handleCoachTap}
              >
                <div className="text-[11px] font-semibold tracking-wide text-[#0cc9a9] mb-0.5">
                  {tooltipGreeting}
                </div>
                <div className="text-[12px] leading-snug text-white/95">
                  {tooltipCta}
                </div>
                <span
                  className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 rounded-sm"
                  style={{ background: '#1f2937' }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
