import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, User, Plus } from "lucide-react";

type Workout = {
  id: number;
  title: string;
  category: string;
  difficulty: string;
  duration: number;
  imageUrl?: string | null;
  routineType: string;
  workoutType: string;
  estimatedDuration?: number;
  createdAt?: string;
  sourceType?: string;
  userId?: string;
};

type SectionConfig = {
  key: string;
  title: string;
  gradient: string;
  color: string;
  routineType: string;
};

const sections: SectionConfig[] = [
  {
    key: "workouts",
    title: "Workouts",
    gradient: "from-blue-500 to-cyan-500",
    color: "bg-blue-500/20 text-blue-400",
    routineType: "workout",
  },
  {
    key: "stretching",
    title: "Stretching & Mobility",
    gradient: "from-emerald-500 to-teal-500",
    color: "bg-emerald-500/20 text-emerald-400",
    routineType: "stretching",
  },
  {
    key: "yoga",
    title: "Yoga",
    gradient: "from-purple-500 to-pink-500",
    color: "bg-purple-500/20 text-purple-400",
    routineType: "yoga",
  },
  {
    key: "corrective",
    title: "Corrective Exercise",
    gradient: "from-[#0cc9a9] to-teal-600",
    color: "bg-[#0cc9a9]/20 text-[#0cc9a9]",
    routineType: "corrective",
  },
];

const categoryLabels: Record<string, string> = {
  strength: "Strength",
  cardio: "Cardio",
  hiit: "HIIT",
  mobility: "Mobility",
  recovery: "Recovery",
  full_body: "Full Body",
  lower_body: "Lower Body",
  upper_body: "Upper Body",
  core: "Core",
  home_workout: "Home",
  bodyweight: "Bodyweight",
  morning: "Morning",
  post_workout: "Post-Workout",
  hip_mobility: "Hip Mobility",
  spine: "Spine & Back",
  beginner: "Beginner",
  power: "Power",
  restorative: "Restorative",
  flexibility: "Flexibility",
  mindfulness: "Mindfulness",
  posture: "Posture",
  shoulder: "Shoulder",
  knee: "Knee & Ankle",
  lower_back: "Lower Back",
  balance: "Balance",
};

const difficultyLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function WorkoutsTab() {
  const [, navigate] = useLocation();

  const { data: workouts = [], isLoading } = useQuery<Workout[]>({
    queryKey: ["/api/workouts"],
    retry: false,
  });

  const { data: myWorkouts = [] } = useQuery<Workout[]>({
    queryKey: ["/api/workouts/mine"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workouts...</p>
        </div>
      </div>
    );
  }

  const workoutCategories = [
    { key: "workout", label: "Workout", gradient: "from-blue-500 to-cyan-500" },
    { key: "stretching", label: "Stretching", gradient: "from-emerald-500 to-teal-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Create Workout Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">Create a Workout</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {workoutCategories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => navigate(`/build-wod?category=${cat.key}&from=/training`)}
                className={`flex items-center justify-center p-3 rounded-xl bg-gradient-to-br ${cat.gradient} text-white hover:scale-[1.03] active:scale-[0.97] transition-transform shadow-sm`}
              >
                <span className="text-[11px] font-semibold leading-tight text-center">{cat.label}</span>
              </button>
          ))}
        </div>
      </div>

      {sections.map((section) => {
        const sectionWorkouts = workouts
          .filter((w) => w.routineType === section.routineType)
          .slice(0, 9);

        const sectionMyWorkouts = myWorkouts.filter(
          (w) => w.routineType === section.routineType
        );

        const hasUserWorkouts = sectionMyWorkouts.length > 0;

        return (
          <div key={section.key} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-foreground">{section.title}</h3>
              </div>
              {sectionWorkouts.length > 4 && (
                <button
                  onClick={() => navigate(`/training/workouts/${section.routineType}`)}
                  className="text-xs text-[#0cc9a9] font-medium flex items-center gap-0.5"
                >
                  See All <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {hasUserWorkouts && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">My Workouts</p>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {sectionMyWorkouts.map((workout) => (
                    <div
                      key={workout.id}
                      className="flex-shrink-0 w-[45vw] max-w-[220px] cursor-pointer group relative"
                      onClick={() => navigate(`/training/workout/${workout.id}`)}
                    >
                      <div className="relative rounded-xl overflow-hidden h-[280px] bg-muted group-hover:scale-[1.02] transition-transform duration-200 shadow-sm">
                        <div className={`w-full h-full bg-gradient-to-br ${section.gradient}`} />
                        <div className="absolute top-3 left-3">
                          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <h4 className="text-white font-bold text-base leading-tight line-clamp-2 mb-1">
                            {workout.title}
                          </h4>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${section.color}`}>
                              {categoryLabels[workout.category] || workout.category}
                            </span>
                            <span className="text-white/40">·</span>
                            <span className="text-xs text-white/70">
                              {difficultyLabels[workout.difficulty] || workout.difficulty}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {hasUserWorkouts && sectionWorkouts.length > 0 && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Library Workouts</p>
            )}

            {sectionWorkouts.length === 0 && !hasUserWorkouts ? (
              <div className="flex items-center justify-center h-[120px] rounded-xl border border-dashed border-border/50 bg-muted/20">
                <p className="text-sm text-muted-foreground">Coming soon</p>
              </div>
            ) : sectionWorkouts.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {sectionWorkouts.map((workout) => (
                  <div
                    key={workout.id}
                    className="flex-shrink-0 w-[45vw] max-w-[220px] cursor-pointer group"
                    onClick={() => navigate(`/training/workout/${workout.id}`)}
                  >
                    <div className="relative rounded-xl overflow-hidden h-[280px] bg-muted group-hover:scale-[1.02] transition-transform duration-200 shadow-sm">
                      <div className={`w-full h-full bg-gradient-to-br ${section.gradient}`} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h4 className="text-white font-bold text-base leading-tight line-clamp-2 mb-1">
                          {workout.title}
                        </h4>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${section.color}`}>
                            {categoryLabels[workout.category] || workout.category}
                          </span>
                          <span className="text-white/40">·</span>
                          <span className="text-xs text-white/70">
                            {difficultyLabels[workout.difficulty] || workout.difficulty}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {sectionWorkouts.length >= 9 && (
                  <div
                    className="flex-shrink-0 w-[30vw] max-w-[140px] cursor-pointer group"
                    onClick={() => navigate(`/training/workouts/${section.routineType}`)}
                  >
                    <div className="relative rounded-xl overflow-hidden h-[280px] bg-muted/50 border border-border/50 flex flex-col items-center justify-center gap-2 group-hover:bg-muted transition-colors">
                      <div className="w-10 h-10 rounded-full bg-[#0cc9a9]/10 flex items-center justify-center">
                        <ChevronRight className="w-5 h-5 text-[#0cc9a9]" />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">View All</span>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
