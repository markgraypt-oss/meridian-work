import { useEffect, useState, useRef, useCallback, lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useSearch } from "wouter";
import { MyTrainingTab } from "@/components/training/MyTrainingTab";
import { ProgrammesTab } from "@/components/training/ProgramsTab";
import { WorkoutsTab } from "@/components/training/WorkoutsTab";
import { ChevronRight } from "lucide-react";

const LazyBodyMap = lazy(() => import("@/pages/body-map-unified"));
const LazyExerciseLibrary = lazy(() => import("@/pages/training-exercise-library"));

const TABS = [
  { id: "my-programme", label: "My Programme" },
  { id: "programmes", label: "Programmes" },
  { id: "workouts", label: "Workouts" },
  { id: "body-map", label: "Body Map" },
  { id: "exercise-library", label: "Exercise Library" },
];

export default function Training() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const urlTab = new URLSearchParams(searchString).get("tab");
  const [activeTab, setActiveTab] = useState(
    urlTab && TABS.some(t => t.id === urlTab) ? urlTab : "my-programme"
  );
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollArrow, setShowScrollArrow] = useState(false);

  const checkScrollOverflow = useCallback(() => {
    const container = tabsContainerRef.current;
    if (container) {
      const hasOverflow = container.scrollWidth > container.clientWidth;
      const isAtEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 4;
      setShowScrollArrow(hasOverflow && !isAtEnd);
    }
  }, []);

  useEffect(() => {
    if (urlTab && TABS.some(t => t.id === urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  useEffect(() => {
    checkScrollOverflow();
    window.addEventListener("resize", checkScrollOverflow);
    return () => window.removeEventListener("resize", checkScrollOverflow);
  }, [checkScrollOverflow]);

  useEffect(() => {
    const container = tabsContainerRef.current;
    if (container) {
      container.addEventListener("scroll", checkScrollOverflow);
      return () => container.removeEventListener("scroll", checkScrollOverflow);
    }
  }, [checkScrollOverflow]);

  const scrollTabsRight = () => {
    const container = tabsContainerRef.current;
    if (container) {
      container.scrollBy({ left: 120, behavior: "smooth" });
    }
  };

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    window.scrollTo({ top: 0 });

    const container = tabsContainerRef.current;
    if (container) {
      const tabEl = container.querySelector(`[data-tab-id="${tabId}"]`);
      if (tabEl) {
        tabEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const tabLoadingFallback = (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border/40">
        <div className="px-5 pt-4 pb-0">
          <h1 className="text-[28px] font-bold text-[#0cc9a9] tracking-tight">
            Movement
          </h1>
        </div>

        <div className="relative">
          <div
            ref={tabsContainerRef}
            className="flex gap-5 overflow-x-auto scrollbar-hide px-5 pt-3"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                data-tab-id={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`relative whitespace-nowrap pb-3 text-sm font-medium transition-colors flex-shrink-0 ${
                  activeTab === tab.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground/80"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#0cc9a9] rounded-full" />
                )}
              </button>
            ))}
          </div>

          {showScrollArrow && (
            <button
              onClick={scrollTabsRight}
              className="absolute right-0 top-0 bottom-0 flex items-center pl-4 pr-2 bg-gradient-to-l from-background via-background to-transparent"
              aria-label="Scroll tabs"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </header>

      <div className="pt-[88px]">
        <div className="px-5">
          <div className="max-w-7xl mx-auto">
            {activeTab === "my-programme" && <MyTrainingTab />}
            {activeTab === "programmes" && <ProgrammesTab />}
            {activeTab === "workouts" && <WorkoutsTab />}
            {activeTab === "body-map" && (
              <Suspense fallback={tabLoadingFallback}>
                <LazyBodyMap embedded />
              </Suspense>
            )}
            {activeTab === "exercise-library" && (
              <Suspense fallback={tabLoadingFallback}>
                <LazyExerciseLibrary embedded />
              </Suspense>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
