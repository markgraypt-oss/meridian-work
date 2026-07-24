import { Timer, Dumbbell, Activity, Footprints, CalendarDays, Clock, MapPin, ShieldCheck, Beef, ClipboardList, Moon, Sunrise, HeartHandshake, CheckCircle2, ListTodo } from "lucide-react";

export const SYSTEM_HABITS: Array<{
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  durationDays?: number;
}> = [
  {
    id: "run-5km",
    title: "Run Your First 5km",
    description: "Complete a continuous 5km run. A milestone that proves your cardiovascular fitness and consistency of training are moving in the right direction.",
    icon: <Timer className="h-5 w-5 text-blue-500" />,
    color: "bg-blue-500/10",
  },
  {
    id: "run-10km",
    title: "Run Your First 10km",
    description: "Complete a continuous 10km run. A significant endurance milestone that requires sustained commitment to your training over several weeks.",
    icon: <MapPin className="h-5 w-5 text-indigo-500" />,
    color: "bg-indigo-500/10",
  },
  {
    id: "first-pull-up",
    title: "Complete Your First Pull-Up",
    description: "Perform a full, unassisted pull-up from a dead hang. One of the best indicators of relative upper body strength and a goal worth working towards at any fitness level.",
    icon: <Dumbbell className="h-5 w-5 text-orange-500" />,
    color: "bg-orange-500/10",
  },
  {
    id: "36-workouts-90-days",
    title: "Complete 36 Workouts in 90 Days",
    description: "Finish 36 logged workouts within a 90-day window. This works out to three sessions per week and builds the consistency that drives real, lasting physical change.",
    icon: <CalendarDays className="h-5 w-5 text-green-500" />,
    color: "bg-green-500/10",
    durationDays: 90,
  },
  {
    id: "30-day-stretch",
    title: "Complete a 30-Day Stretching Streak",
    description: "Stretch every day for 30 consecutive days. A short-term commitment that builds a long-term habit and produces noticeable improvements in mobility and recovery.",
    icon: <Activity className="h-5 w-5 text-teal-500" />,
    color: "bg-teal-500/10",
    durationDays: 30,
  },
  {
    id: "walk-450k-steps",
    title: "Walk 450,000 Steps in 45 Days",
    description: "Accumulate 450,000 steps over 45 days, averaging 10,000 steps per day. A proven benchmark for cardiovascular health, fat loss, and sustained energy.",
    icon: <Footprints className="h-5 w-5 text-[#0cc9a9]" />,
    color: "bg-[#0cc9a9]/10",
    durationDays: 45,
  },
  {
    id: "20-min-run",
    title: "Complete Your First Unbroken 20-Minute Run",
    description: "Run continuously for 20 minutes without stopping. A realistic and motivating target for anyone building their running base from scratch.",
    icon: <Clock className="h-5 w-5 text-rose-500" />,
    color: "bg-rose-500/10",
  },
  {
    id: "30-day-alcohol-free",
    title: "Complete a 30-Day Alcohol-Free Period",
    description: "Go completely alcohol-free for 30 consecutive days. Long enough to see meaningful improvements in sleep quality, energy levels, and body composition.",
    icon: <ShieldCheck className="h-5 w-5 text-violet-500" />,
    color: "bg-violet-500/10",
    durationDays: 30,
  },
  {
    id: "protein-30-days",
    title: "Hit Your Protein Target for 30 Consecutive Days",
    description: "Meet your daily protein goal every day for 30 days straight. Consistency here is what drives the improvements in body composition and recovery that sporadic effort never delivers.",
    icon: <Beef className="h-5 w-5 text-red-500" />,
    color: "bg-red-500/10",
    durationDays: 30,
  },
  {
    id: "track-meals-4-weeks",
    title: "Track Your Meals Every Day for 4 Weeks",
    description: "Log every meal for 28 consecutive days. Four weeks of accurate tracking builds a level of nutritional awareness that changes how you eat long after the goal is complete.",
    icon: <ClipboardList className="h-5 w-5 text-cyan-500" />,
    color: "bg-cyan-500/10",
    durationDays: 28,
  },
  {
    id: "7-hours-sleep-6-weeks",
    title: "Average 7 Hours of Sleep per Night for 6 Weeks",
    description: "Achieve an average of at least 7 hours of sleep per night across a 6-week period. Sustained sleep at this level produces compounding improvements in energy, mood, and physical performance.",
    icon: <Moon className="h-5 w-5 text-purple-500" />,
    color: "bg-purple-500/10",
    durationDays: 42,
  },
  {
    id: "consistent-wake-time-30-days",
    title: "Maintain a Consistent Wake Time for 30 Days",
    description: "Wake up at the same time every day for 30 consecutive days, including weekends. One of the most effective and underused tools for improving sleep quality and daytime energy.",
    icon: <Sunrise className="h-5 w-5 text-[#0cc9a9]" />,
    color: "bg-[#0cc9a9]/10",
    durationDays: 30,
  },
  {
    id: "resolve-pain-point",
    title: "Resolve a Specific Pain Point",
    description: "Work through your corrective exercise program until a pain or movement issue identified in your body map is fully resolved. A goal unique to your current physical situation and one of the most impactful things you can achieve.",
    icon: <HeartHandshake className="h-5 w-5 text-pink-500" />,
    color: "bg-pink-500/10",
  },
  {
    id: "30-day-checkin-streak",
    title: "Complete a 30-Day Check-In Streak",
    description: "Submit your daily health check-in every day for 30 consecutive days. Thirty days of consistent data is where your insights start to become genuinely meaningful.",
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    color: "bg-emerald-500/10",
    durationDays: 30,
  },
  {
    id: "all-habits-14-days",
    title: "Complete All Daily Habits for 14 Consecutive Days",
    description: "Tick off every assigned habit every day for two full weeks. A demanding but achievable target that demonstrates what consistent daily effort actually looks like.",
    icon: <ListTodo className="h-5 w-5 text-sky-500" />,
    color: "bg-sky-500/10",
    durationDays: 14,
  },
];
