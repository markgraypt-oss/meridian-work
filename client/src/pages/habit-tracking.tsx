import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { X, MoreVertical, Check, Play } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Habit, HabitCompletion, HabitTemplate } from "@shared/schema";
import MuxPlayer from "@mux/mux-player-react";

const HABIT_MUX_PLAYBACK_IDS: Record<string, string> = {
  "Perform Office Stretches": "LaHVIlK5UzTTemhBlYBM1wxudsKb7faKhDUxTc6jQ4s",
  "Hydrate Before You Caffeinate": "M8NOteCjUCRdAcP3ToEo71gM5pCS01Y2zYIy81cjCwDU",
  "Avoid Painful Movements": "oE5NaQpiyQF01P3mTWq9txfqHW2mdlMFoJnrjyMf14qo",
  "Perform Corrective Exercises": "RgLfAMHlWDGHPb9Qf1HiMsB1vG7ujdz4jk6BLTWeNGQ",
  "Use Your Standing Desk": "m37avC2jlSO01UTCjKzWXk7AZlVIh3FU7mli9WLxfRj00",
  "Take the Active Route": "CqIcxxmrjdDNDsMLKoUliwT02o02qtQ3sxWdItvKl5xnw",
  "Stretch Before Bed": "MMTX00bYUTxYETe47vGxsrpdYqmoGg01BYPuxFa7nRxJM",
  "Wear Blue Light Glasses": "c8LksGDRLnhOcA7mJHu5ilaxA2lSIndcCg6fx8U7zKo",
  "Practise a Bedtime Ritual": "m51YhM24DUZvz9ykAisBaghC00jVlt6vaM14kodrcAe00",
  "Set a Consistent Wake Time": "bWS1hXuLRslS00XZOSMag0100dgFGwFCfWmhUF8U8EYICs",
  "Hit Your Protein Target": "RCHKDFmESaVE28usR6mjt3QtWfKL132B02zKVua2f3Qc",
  "Hit Your Fibre Target": "bvqAzwhYT01BCf02fA02O6vqM5Y2ggG8kPW02V1PrfnKpyc",
  "Prepare Your Own Meals": "xM4VZUGwvUEBeztoW1R02vDFOoeEelUuns237i9Yhdho",
  "Limit Alcohol": "JDdpSSzj9D02yx00eTYTHsqyeLxMsmmWErMABZOW4vGK8",
  "Avoided Alcohol": "XmvFYs02nR7k004x3zm6UCxKzL01f7NwjKUtSL7gQ8nxoY",
  "Track Your Meals": "fl3Ex6Z02YtmPkw5sDy4yDs99Lcp602HDydoSfV2x4MlU",
  "Push Your Comfort Zone": "ck6FKy02qtfpe8JFV00mZ65TFwsQb9pmFWwnGf6rMTsBE",
  "Take Radical Ownership": "bRJuVwqOuG9srgZXaaZu1XxadbFQis501008jRyTFfKM00",
  "Practise Mindfulness": "aPJQAAfvP4tlgrP6VSoSwwz026U02E5k2WkQVn02GRBZ98",
  "Complete Your Check-In": "ge01uwesD00D9xYipBOlj5Ayp2uDyCjS1zw1fvvrRhSjA",
  "Review Your Goals": "XDuTe1zKgAISX6xO6dFAd7ViXbNaPqVwWKLxTxm64Hg",
  "Perform Daily Maintenance": "KdRBvt7NCg7Ud3Eb5MUkg011tdm01mTHWl6gdjuclxdtM",
  "Manage Your Energy": "HWCWjd63rYgaB1T6upEcb02lrebjdfKoms2pOGia6cNA",
  "Eat protein": "l8w4mvh1ZoGjh02NClsKHNnXOFHt01exmMlL1Xm4WsnLE",
  "Eat complex carbs": "tvwVZy00s17S1K3kpjiDhZa01Vxh2piE1JjaDoUN600I2U",
  "Eat good fats": "Kk5hrwBsaeW6mMFc00wYDkaEV1FzpwYt45rd00b3801Azw",
  "Eat vegetables": "FIFFUt39rSRcFi3HE02XfDbtOWQlENvncpO6coxQ3R02w",
  "Follow portion guides": "OjMD7CF9SQu3wZffns2fRI1izGxJhigMhuw028S00VS14",
  "Take a Recovery Break": "q5WNb00w6YAo3xwGLTxotDzk7D01TDtuCF02ttY00jW02NNs",
};
import palmImage from "@assets/j5eyhrdf_1771947062076.png";
import eggImage from "@assets/utnhdbfg_1771950515053.png";
import thumbImage from "@assets/1_1771954180973.png";
import cuppedHandImage from "@assets/2_1771954180973.png";
import fistImage from "@assets/3_1771954180973.png";
import oliveOilIcon from "@assets/1_1771954955077.png";
import vegBasketIcon from "@assets/2_1771954955077.png";
import sweetPotatoIcon from "@assets/3_1771954955077.png";
import handIcon from "@assets/ecqvwfeg_b_1771966038873.png";

interface FoodItem {
  bold: string;
  detail: string;
}

interface HabitConfig {
  title: string;
  slideTitle: string;
  circleIcon: string;
  circleIconAlt: string;
  portionImage: string;
  portionImageAlt: string;
  portionUnit: string;
  defaultPortion: string;
  foods: FoodItem[];
}

const HABIT_CONFIGS: Record<string, HabitConfig> = {
  "Eat protein": {
    title: "Eat protein",
    slideTitle: "Protein",
    circleIcon: eggImage,
    circleIconAlt: "Protein",
    portionImage: palmImage,
    portionImageAlt: "Palm portion guide",
    portionUnit: "palms",
    defaultPortion: "2 palms",
    foods: [
      { bold: "Lean red meat", detail: "(e.g., beef, pork, wild game)" },
      { bold: "Poultry", detail: "(e.g., chicken, turkey, duck)" },
      { bold: "Fish & seafood", detail: "" },
      { bold: "Cottage cheese", detail: "" },
      { bold: "Eggs", detail: "" },
      { bold: "Tofu or tempeh", detail: "" },
    ],
  },
  "Eat good fats": {
    title: "Eat good fats",
    slideTitle: "Good Fats",
    circleIcon: oliveOilIcon,
    circleIconAlt: "Fats",
    portionImage: thumbImage,
    portionImageAlt: "Thumb portion guide",
    portionUnit: "thumbs",
    defaultPortion: "2 thumbs",
    foods: [
      { bold: "Avocado", detail: "" },
      { bold: "Nuts", detail: "(e.g., almonds, walnuts, cashews)" },
      { bold: "Extra virgin olive oil", detail: "" },
      { bold: "Seeds", detail: "(e.g., chia, flax, pumpkin)" },
      { bold: "Nut butters", detail: "(e.g., almond, peanut, cashew)" },
      { bold: "Oily fish", detail: "(e.g., salmon, mackerel, sardines)" },
      { bold: "Dark chocolate", detail: "(70%+ cocoa)" },
    ],
  },
  "Eat complex carbs": {
    title: "Eat complex carbs",
    slideTitle: "Complex Carbs",
    circleIcon: sweetPotatoIcon,
    circleIconAlt: "Carbs",
    portionImage: cuppedHandImage,
    portionImageAlt: "Cupped hand portion guide",
    portionUnit: "cupped hands",
    defaultPortion: "2 cupped hands",
    foods: [
      { bold: "Fruits", detail: "(e.g., berries, bananas, apples)" },
      { bold: "Sweet potato", detail: "" },
      { bold: "Brown rice", detail: "" },
      { bold: "Quinoa", detail: "" },
      { bold: "Whole grain bread", detail: "" },
      { bold: "Beans & lentils", detail: "" },
      { bold: "Oats", detail: "" },
    ],
  },
  "Eat vegetables": {
    title: "Eat vegetables",
    slideTitle: "Vegetables",
    circleIcon: vegBasketIcon,
    circleIconAlt: "Vegetables",
    portionImage: fistImage,
    portionImageAlt: "Fist portion guide",
    portionUnit: "fists",
    defaultPortion: "2 fists",
    foods: [
      { bold: "Leafy greens", detail: "(e.g., spinach, kale, rocket)" },
      { bold: "Cruciferous", detail: "(e.g., broccoli, cauliflower, cabbage)" },
      { bold: "Root vegetables", detail: "(e.g., carrots, beetroot, parsnips)" },
      { bold: "Peppers", detail: "(e.g., bell peppers, chilli)" },
      { bold: "Courgette & squash", detail: "" },
      { bold: "Tomatoes", detail: "" },
      { bold: "Mushrooms", detail: "" },
    ],
  },
};

const PORTION_GUIDE_SLIDES = [
  { key: "protein", config: HABIT_CONFIGS["Eat protein"], settingsKey: "proteinPortion" },
  { key: "carbs", config: HABIT_CONFIGS["Eat complex carbs"], settingsKey: "carbsPortion" },
  { key: "fat", config: HABIT_CONFIGS["Eat good fats"], settingsKey: "fatPortion" },
  { key: "veggies", config: HABIT_CONFIGS["Eat vegetables"], settingsKey: "veggiesPortion" },
];

const HABIT_ICONS: Record<string, string> = {
  "footprints": "👣",
  "moon": "🌙",
  "droplets": "💧",
  "brain": "🧠",
  "dumbbell": "💪",
  "heart": "❤️",
  "apple": "🍎",
  "sun": "☀️",
  "leaf": "🍃",
  "clock": "⏰",
  "target": "🎯",
  "flame": "🔥",
  "star": "⭐",
  "smile": "😊",
  "book": "📖",
  "music": "🎵",
  "shield": "🛡️",
  "zap": "⚡",
};

export default function HabitTracking() {
  const params = useParams();
  const habitId = parseInt(params.id as string);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const { data: habit, isLoading: habitLoading } = useQuery<Habit>({
    queryKey: [`/api/habits/${habitId}`],
  });

  const { data: template } = useQuery<HabitTemplate>({
    queryKey: ["/api/habit-templates", habit?.templateId],
    queryFn: async () => {
      const res = await fetch(`/api/habit-templates/${habit!.templateId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch template");
      return res.json();
    },
    enabled: !!habit?.templateId,
  });

  const { data: video } = useQuery<{ id: number; title: string; thumbnailUrl: string | null; muxPlaybackId: string | null }>({
    queryKey: ["/api/videos", template?.videoId],
    queryFn: async () => {
      const res = await fetch(`/api/videos/${template!.videoId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch video");
      return res.json();
    },
    enabled: !!template?.hasVideo && !!template?.videoId,
  });

  const { data: completions = [] } = useQuery<HabitCompletion[]>({
    queryKey: ["/api/habits", habitId, "completions"],
    queryFn: async () => {
      const res = await fetch(`/api/habits/${habitId}/completions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch completions");
      return res.json();
    },
  });

  const isCompletedToday = completions.some((c) => {
    const completionDate = format(new Date(c.completedDate), "yyyy-MM-dd");
    return completionDate === todayStr;
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/habits/${habitId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits", habitId, "completions"] });
      queryClient.invalidateQueries({ queryKey: [`/api/habits/${habitId}/completions`] });
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
      setShowCelebration(true);
    },
  });

  const uncompleteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/habits/${habitId}/complete?date=${todayStr}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits", habitId, "completions"] });
      queryClient.invalidateQueries({ queryKey: [`/api/habits/${habitId}/completions`] });
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
      toast({ title: "Reverted", description: "Habit marked as scheduled again." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/habits/${habitId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
      toast({ title: "Deleted", description: "Habit has been removed." });
      navigate("/habits");
    },
  });

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const slide = Math.round(el.scrollLeft / el.offsetWidth);
    setCurrentSlide(slide);
  };

  if (habitLoading || !habit) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isPortionGuidesHabit = habit.title === "Follow portion guides";
  const isPortionHabit = !!HABIT_CONFIGS[habit.title];
  const isStepHabit = habit.title === "Hit Your Step Count";
  const isGenericHabit = !isPortionGuidesHabit && !isPortionHabit;

  const config = HABIT_CONFIGS[habit.title] || HABIT_CONFIGS["Eat protein"];
  const settings = (habit.settings as any) || {};
  const portionSize = settings.portionSize || config.defaultPortion;
  const numberOfMeals = settings.numberOfMeals || "With each meal";
  const mealText = numberOfMeals === "With each meal" ? "with each meal" : numberOfMeals.toLowerCase();

  const allCompletionDates = completions.map((c) => format(new Date(c.completedDate), "yyyy-MM-dd"));
  const uniqueDates = new Set(allCompletionDates);
  let streakCount = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (uniqueDates.has(format(d, "yyyy-MM-dd"))) {
      streakCount++;
    } else if (i > 0) {
      break;
    }
  }

  const streakMessage = streakCount === 0
    ? "Start your streak!"
    : streakCount === 1
    ? "First day of the streak. Well done!"
    : `${streakCount} day streak! Keep it going!`;

  const totalSlides = isPortionGuidesHabit ? 5 : 2;
  const rawIcon = habit.icon || "";
  const habitIcon = HABIT_ICONS[rawIcon] || rawIcon || "⭐";
  const habitIconIsImage = habitIcon.startsWith("/") || habitIcon.startsWith("http");

  const videoThumbnail = video?.thumbnailUrl || (video?.muxPlaybackId ? `https://image.mux.com/${video.muxPlaybackId}/thumbnail.png?width=320&height=180` : null);
  const fallbackMuxId = !videoThumbnail && habit.title ? HABIT_MUX_PLAYBACK_IDS[habit.title] : null;
  const effectiveMuxId = video?.muxPlaybackId || fallbackMuxId;

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <div className="bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate("/")} className="p-1">
            <X className="h-5 w-5 text-foreground" />
          </button>
          <span className="text-base font-semibold text-foreground">Today</span>
          <button onClick={() => setShowActionSheet(true)} className="p-1">
            <MoreVertical className="h-5 w-5 text-foreground" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-hide"
        style={{ scrollBehavior: "smooth" }}
      >
        {isPortionGuidesHabit ? (
          <>
            <div className="min-w-full w-full flex-shrink-0 snap-center flex flex-col items-center px-6">
              <div className="w-full pt-2">
                <p className="text-base text-muted-foreground text-center pb-2">{streakMessage}</p>
                <div style={{ height: '1px', width: '100%', background: '#e0e0e0' }} />
              </div>
              <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
                <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-4 mt-4 ${
                  isCompletedToday
                    ? "bg-primary"
                    : "border-[3px] border-primary bg-transparent"
                }`}>
                  {isCompletedToday ? (
                    <Check className="w-16 h-16 text-white" strokeWidth={3} />
                  ) : (
                    <img src={handIcon} alt="Hand portion guide" className="w-28 h-28 object-contain" />
                  )}
                </div>
                <h2 className="text-[26px] font-medium text-foreground text-center leading-tight">
                  Follow portion guides<br />{mealText}
                </h2>
                <p className="text-lg text-muted-foreground font-normal mt-1.5">
                  {isCompletedToday ? "Completed" : "Scheduled"}
                </p>
              </div>

              <div className="mt-1" style={{ height: '1px', width: '90%', background: '#e0e0e0' }} />

              <div className="w-full max-w-sm grid grid-cols-2 gap-4 pt-6 pb-12">
                {PORTION_GUIDE_SLIDES.map((slide) => {
                  const portion = settings[slide.settingsKey] || slide.config.defaultPortion;
                  return (
                    <div key={slide.key} className="flex flex-col items-center">
                      <span className="text-sm font-medium text-foreground mb-0.5">{slide.config.slideTitle}</span>
                      <span className="text-xs text-black font-medium bg-primary rounded-full px-3 py-0.5 mb-2">{portion}</span>
                      <img src={slide.config.portionImage} alt={slide.config.portionImageAlt} className="w-[90px] h-auto" />
                    </div>
                  );
                })}
              </div>
            </div>

            {PORTION_GUIDE_SLIDES.map((slide) => {
              const portion = settings[slide.settingsKey] || slide.config.defaultPortion;
              const slideMuxId = HABIT_MUX_PLAYBACK_IDS[slide.config.title];
              return (
                <div key={slide.key} className="min-w-full w-full flex-shrink-0 snap-center flex flex-col px-6 pt-4">
                  <div className="w-full max-w-sm px-2 mx-auto">
                    <h3 className="text-xl font-semibold text-foreground text-center mb-1">{slide.config.slideTitle}</h3>
                    <p className="text-sm text-black font-medium bg-primary rounded-full px-4 py-1 mx-auto w-fit text-center mb-4">{portion}</p>
                    <div className="flex justify-center mb-5">
                      <img src={slide.config.portionImage} alt={slide.config.portionImageAlt} className="w-[144px] h-auto" />
                    </div>
                    <ul className="space-y-2.5">
                      {(() => {
                        const wrapAt = slideMuxId ? Math.max(slide.config.foods.length - 5, 2) : slide.config.foods.length;
                        const topFoods = slide.config.foods.slice(0, wrapAt);
                        const bottomFoods = slide.config.foods.slice(wrapAt);
                        return (
                          <>
                            {topFoods.map((food, idx) => (
                              <li key={idx} className="flex items-start gap-2.5 text-foreground">
                                <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-foreground flex-shrink-0" />
                                <span className="text-base">
                                  <strong>{food.bold}</strong>
                                  {food.detail && <span className="text-muted-foreground"> {food.detail}</span>}
                                </span>
                              </li>
                            ))}
                          </>
                        );
                      })()}
                    </ul>
                    {slideMuxId && (() => {
                      const bottomFoods = slide.config.foods.slice(Math.max(slide.config.foods.length - 5, 2));
                      return (
                        <div className="mt-2.5">
                          <button
                            onClick={() => {
                              const container = document.getElementById('habit-mux-fullscreen');
                              if (container) {
                                container.style.display = 'flex';
                                const player = container.querySelector('mux-player') as any;
                                if (player) {
                                  player.currentTime = 0;
                                  player.play();
                                }
                              }
                            }}
                            className="float-right w-[40%] ml-4 mb-2 rounded-xl overflow-hidden relative group"
                          >
                            <img
                              src={`https://image.mux.com/${slideMuxId}/thumbnail.png?width=400&height=700&fit_mode=smartcrop`}
                              alt={slide.config.slideTitle}
                              className="w-full object-cover rounded-xl"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                <Play className="w-6 h-6 text-primary-foreground ml-0.5" fill="currentColor" />
                              </div>
                            </div>
                          </button>
                          {bottomFoods.map((food, idx) => (
                            <p key={idx} className="text-foreground mb-2.5 text-base">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground mr-2.5 align-middle" />
                              <strong>{food.bold}</strong>
                              {food.detail && <span className="text-muted-foreground"> {food.detail}</span>}
                            </p>
                          ))}
                          <div style={{ clear: 'both' }} />
                        </div>
                      );
                    })()}
                    {!slideMuxId && (() => {
                      const bottomFoods = slide.config.foods.slice(Math.max(slide.config.foods.length - 5, 2));
                      return bottomFoods.length > 0 ? (
                        <ul className="space-y-2.5 mt-2.5">
                          {bottomFoods.map((food, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 text-foreground">
                              <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-foreground flex-shrink-0" />
                              <span className="text-base">
                                <strong>{food.bold}</strong>
                                {food.detail && <span className="text-muted-foreground"> {food.detail}</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null;
                    })()}
                  </div>
                </div>
              );
            })}
          </>
        ) : isPortionHabit ? (
          <>
            <div className="min-w-full w-full flex-shrink-0 snap-center flex flex-col items-center px-6">
              <div className="w-full pt-2">
                <p className="text-base text-muted-foreground text-center pb-2">{streakMessage}</p>
                <div style={{ height: '1px', width: '100%', background: '#e0e0e0' }} />
              </div>
              <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm -mt-10">
                <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-4 ${
                  isCompletedToday
                    ? "bg-primary"
                    : "border-[3px] border-primary bg-transparent"
                }`}>
                  {isCompletedToday ? (
                    <Check className="w-16 h-16 text-white" strokeWidth={3} />
                  ) : (
                    <img src={config.circleIcon} alt={config.circleIconAlt} className="w-28 h-28 object-contain" />
                  )}
                </div>
                <h2 className="text-[26px] font-medium text-foreground text-center leading-tight">
                  {config.title}<br />{mealText}
                </h2>
                <p className="text-lg text-muted-foreground font-normal mt-1.5">
                  {isCompletedToday ? "Completed" : "Scheduled"}
                </p>
              </div>
              <div className="-mt-16" style={{ height: '1px', width: '90%', background: '#e0e0e0' }} />
              <div className="w-full max-w-sm flex flex-col items-center pt-8 pb-12">
                <img src={config.portionImage} alt={config.portionImageAlt} className="w-[110px] h-auto mb-1" />
                <p className="text-lg text-foreground font-medium">{portionSize}</p>
              </div>
            </div>

            <div className="min-w-full w-full flex-shrink-0 snap-center flex flex-col px-6 pt-4">
              <div className="w-full max-w-sm px-2 mx-auto">
                <h3 className="text-xl font-semibold text-foreground text-center mb-3">{config.slideTitle}</h3>
                <div className="flex justify-center mb-4">
                  <img src={config.portionImage} alt={config.portionImageAlt} className="w-[144px] h-auto" />
                </div>
                {(() => {
                  const wrapAt = effectiveMuxId ? Math.max(config.foods.length - 5, 2) : config.foods.length;
                  const topFoods = config.foods.slice(0, wrapAt);
                  const bottomFoods = config.foods.slice(wrapAt);
                  return (
                    <>
                      <ul className="space-y-2.5">
                        {topFoods.map((food, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-foreground">
                            <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-foreground flex-shrink-0" />
                            <span className="text-base">
                              <strong>{food.bold}</strong>
                              {food.detail && <span className="text-muted-foreground"> {food.detail}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {effectiveMuxId && bottomFoods.length > 0 && (
                        <div className="mt-2.5">
                          <button
                            onClick={() => {
                              const container = document.getElementById('habit-mux-fullscreen');
                              if (container) {
                                container.style.display = 'flex';
                                const player = container.querySelector('mux-player') as any;
                                if (player) {
                                  player.currentTime = 0;
                                  player.play();
                                }
                              }
                            }}
                            className="float-right w-[40%] ml-4 mb-2 rounded-xl overflow-hidden relative group"
                          >
                            <img
                              src={`https://image.mux.com/${effectiveMuxId}/thumbnail.png?width=400&height=700&fit_mode=smartcrop`}
                              alt={config.slideTitle}
                              className="w-full object-cover rounded-xl"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                <Play className="w-6 h-6 text-primary-foreground ml-0.5" fill="currentColor" />
                              </div>
                            </div>
                          </button>
                          {bottomFoods.map((food, idx) => (
                            <p key={idx} className="text-foreground mb-2.5 text-base">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground mr-2.5 align-middle" />
                              <strong>{food.bold}</strong>
                              {food.detail && <span className="text-muted-foreground"> {food.detail}</span>}
                            </p>
                          ))}
                          <div style={{ clear: 'both' }} />
                        </div>
                      )}
                      {!effectiveMuxId && bottomFoods.length > 0 && (
                        <ul className="space-y-2.5 mt-2.5">
                          {bottomFoods.map((food, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 text-foreground">
                              <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-foreground flex-shrink-0" />
                              <span className="text-base">
                                <strong>{food.bold}</strong>
                                {food.detail && <span className="text-muted-foreground"> {food.detail}</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="min-w-full w-full flex-shrink-0 snap-center flex flex-col px-6">
              <div className="w-full pt-2">
                <p className="text-base text-muted-foreground text-center pb-2">{streakMessage}</p>
                <div style={{ height: '1px', width: '100%', background: '#e0e0e0' }} />
              </div>

              <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm mx-auto">
                <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-4 ${
                  isCompletedToday
                    ? "bg-primary"
                    : "border-[3px] border-primary bg-transparent"
                }`}>
                  {isCompletedToday ? (
                    <Check className="w-16 h-16 text-white" strokeWidth={3} />
                  ) : habitIconIsImage ? (
                    <img src={habitIcon} alt="" className="w-14 h-14 object-contain" />
                  ) : (
                    <span className="text-5xl">{habitIcon}</span>
                  )}
                </div>
                <h2 className="text-[26px] font-medium text-foreground text-center leading-tight">
                  {habit.title}
                </h2>
                {isStepHabit && settings.stepTarget != null && (
                  <span className="text-sm font-medium bg-primary text-primary-foreground rounded-full px-4 py-1 mt-2">
                    {settings.stepTarget.toLocaleString()} steps/day
                  </span>
                )}
                <p className="text-lg text-muted-foreground font-normal mt-1.5">
                  {isCompletedToday ? "Completed" : "Scheduled"}
                </p>
                {template?.shortDescription && (
                  <p className="text-sm text-muted-foreground text-center mt-14 px-6 leading-relaxed">
                    {template.shortDescription}
                  </p>
                )}
              </div>
            </div>

            <div className="min-w-full w-full flex-shrink-0 snap-center flex flex-col px-6 pt-4">
              <div className="w-full max-w-sm mx-auto text-sm text-muted-foreground leading-relaxed text-left">
                {(() => {
                  const desc = habit.description || "This habit helps you build a positive routine. Focus on consistency and celebrate each day you complete it.";
                  const paragraphs = desc.split(/\n\n+/);
                  const lastIdx = paragraphs.length - 1;
                  return paragraphs.map((p: string, i: number) => (
                    <div key={i} className={i < lastIdx ? "mb-4" : ""}>
                      {i === lastIdx && effectiveMuxId && (
                        <button
                          onClick={() => {
                            const container = document.getElementById('habit-mux-fullscreen');
                            if (container) {
                              container.style.display = 'flex';
                              const player = container.querySelector('mux-player') as any;
                              if (player) {
                                player.currentTime = 0;
                                player.play();
                              }
                            }
                          }}
                          className="float-right w-[40%] ml-8 mb-4 mt-1 rounded-xl overflow-hidden relative group"
                        >
                          <img
                            src={`https://image.mux.com/${effectiveMuxId}/thumbnail.png?width=400&height=700&fit_mode=smartcrop`}
                            alt={habit.title}
                            className="w-full object-cover rounded-xl"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                              <Play className="w-6 h-6 text-primary-foreground ml-0.5" fill="currentColor" />
                            </div>
                          </div>
                        </button>
                      )}
                      {i === lastIdx && !effectiveMuxId && videoThumbnail && (
                        <button
                          onClick={() => video?.id && navigate(`/videos/${video.id}`)}
                          className="float-right w-[40%] ml-3 mb-2 relative rounded-xl overflow-hidden group"
                          style={{ aspectRatio: '16/9' }}
                        >
                          <img src={videoThumbnail} alt="Habit video" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                              <Play className="w-7 h-7 text-primary-foreground ml-0.5" fill="currentColor" />
                            </div>
                          </div>
                        </button>
                      )}
                      {i === lastIdx && !effectiveMuxId && !videoThumbnail && (
                        <div className="float-right w-[40%] ml-3 mb-2 relative rounded-xl overflow-hidden flex items-center justify-center" style={{ aspectRatio: '16/9', backgroundColor: '#e8e8e8' }}>
                          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center">
                            <Play className="w-7 h-7 text-primary-foreground ml-0.5" fill="currentColor" />
                          </div>
                        </div>
                      )}
                      {p}
                    </div>
                  ));
                })()}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="pb-8 pt-2">
        {!isCompletedToday && (
          <div className="flex justify-center pb-2">
            <button
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              className="px-14 py-3 rounded-full bg-primary text-primary-foreground font-bold text-base uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {completeMutation.isPending ? "Completing..." : "Complete"}
            </button>
          </div>
        )}
        <div className="flex justify-center gap-3">
          {Array.from({ length: totalSlides }).map((_, idx) => (
            <div
              key={idx}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                currentSlide === idx ? "bg-primary" : "bg-transparent"
              }`}
              style={currentSlide !== idx ? { border: '2px solid #999' } : undefined}
            />
          ))}
        </div>
      </div>

      {effectiveMuxId && (
        <div
          id="habit-mux-fullscreen"
          className="fixed inset-0 z-[90] bg-black items-center justify-center"
          style={{ display: 'none' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              const el = e.currentTarget;
              const player = el.querySelector('mux-player') as any;
              if (player) player.pause();
              el.style.display = 'none';
            }
          }}
        >
          <button
            onClick={() => {
              const el = document.getElementById('habit-mux-fullscreen');
              if (el) {
                const player = el.querySelector('mux-player') as any;
                if (player) player.pause();
                el.style.display = 'none';
              }
            }}
            className="absolute top-4 left-4 z-10 p-2"
          >
            <X className="w-7 h-7 text-white" />
          </button>
          <MuxPlayer
            playbackId={effectiveMuxId}
            metadata={{ video_title: habit.title }}
            streamType="on-demand"
            accentColor="#0cc9a9"
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      )}

      {showCelebration && (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col animate-in fade-in duration-500">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <button onClick={() => setShowCelebration(false)} className="p-2">
              <X className="h-6 w-6 text-foreground" />
            </button>
            <div />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center px-8">
            <div className="animate-in zoom-in duration-700 ease-out">
              <div className="text-[120px] leading-none mb-6">👍</div>
            </div>
            <div className="animate-in slide-in-from-bottom duration-700 delay-300 text-center">
              <h2 className="text-2xl font-bold text-foreground mb-3">You started a new streak!</h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                Keep your winning streak going by completing your habit before the end of tomorrow.
              </p>
            </div>
          </div>
        </div>
      )}

      {showActionSheet && (
        <div className="fixed inset-0 z-50" onClick={() => setShowActionSheet(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute bottom-0 left-0 right-0 animate-in slide-in-from-bottom duration-200">
            <div className="bg-white rounded-t-2xl px-4 pt-2 pb-8 max-w-lg mx-auto">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
              <button
                className="w-full text-left py-3.5 text-[15px] font-medium text-black border-b border-gray-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActionSheet(false);
                  navigate(`/habit-edit/${habitId}`);
                }}
              >
                Edit
              </button>
              {isCompletedToday && (
                <button
                  className="w-full text-left py-3.5 text-[15px] font-medium text-black border-b border-gray-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowActionSheet(false);
                    uncompleteMutation.mutate();
                  }}
                >
                  Revert To Scheduled
                </button>
              )}
              <button
                className="w-full text-left py-3.5 text-[15px] font-medium text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActionSheet(false);
                  setShowDeleteConfirm(true);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowDeleteConfirm(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-card rounded-2xl p-6 mx-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Habit</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete this habit? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
