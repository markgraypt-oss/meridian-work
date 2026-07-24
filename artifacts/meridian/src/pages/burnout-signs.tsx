import { useLocation } from "wouter";
import TopHeader from "@/components/TopHeader";
import {
  Battery,
  UserX,
  TrendingDown,
  AlertTriangle,
  Clock,
  Activity,
} from "lucide-react";

function BulletList({ items, color }: { items: string[]; color: string }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <div className={`h-1.5 w-1.5 rounded-full ${color} mt-1.5 shrink-0`} />
          <span className="text-sm text-foreground/90">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function BurnoutSigns() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Spot the Signs" onBack={() => navigate("/recovery/burnout-tracker")} />

      <div className="px-4 pt-14 pb-32 space-y-6">
        <div className="space-y-3 px-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Burnout does not start with collapse.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            It starts with drift.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Energy dips. Motivation drops. Recovery slips. Stress stays elevated longer than it should.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Left unchecked, that drift becomes sustained overload.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your Burnout Index exists to detect those patterns early. This page helps you recognise them yourself.
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border/60 p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#0cc9a9]/10">
              <Activity className="h-5 w-5 text-[#0cc9a9]" />
            </div>
            <h2 className="text-base font-bold text-foreground">The Three Core Markers</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Across the research, burnout consistently shows up in three areas:
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/40">
              <span className="text-sm font-bold text-[#0cc9a9] w-5">1</span>
              <span className="text-sm font-semibold text-foreground">Exhaustion</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/40">
              <span className="text-sm font-bold text-[#0cc9a9] w-5">2</span>
              <span className="text-sm font-semibold text-foreground">Detachment</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/40">
              <span className="text-sm font-bold text-[#0cc9a9] w-5">3</span>
              <span className="text-sm font-semibold text-foreground">Reduced effectiveness</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            If you recognise all three over a sustained period, it is time to act.
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border/60 p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10">
              <Battery className="h-5 w-5 text-indigo-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">1. Exhaustion That Doesn't Resolve</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This is more than a busy week.
          </p>
          <div className="rounded-xl bg-muted/30 p-4 space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Look for</p>
            <BulletList
              color="bg-indigo-400"
              items={[
                "Persistent fatigue, even after rest",
                "Sleep that feels unrefreshing",
                "Frequent headaches or tension",
                "Getting ill more often",
                "Needing more caffeine to function",
                "Feeling \"wired but tired\"",
              ]}
            />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Occupational burnout literature consistently identifies emotional and physical exhaustion as the central feature.
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed font-medium">
            If exhaustion becomes your baseline rather than the exception, that matters.
          </p>
          <div className="rounded-xl bg-muted/30 p-4 space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Burnout Index may reflect this through</p>
            <BulletList
              color="bg-[#0cc9a9]"
              items={[
                "Declining sleep duration",
                "Rising stress scores",
                "Elevated resting heart rate",
                "Reduced HRV",
              ]}
            />
          </div>
          <p className="text-xs text-muted-foreground/70 leading-relaxed italic">
            It is not diagnosing you. It is detecting sustained strain patterns.
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border/60 p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10">
              <UserX className="h-5 w-5 text-rose-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">2. Growing Detachment or Cynicism</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Burnout often shifts how you relate to work.
          </p>
          <div className="rounded-xl bg-muted/30 p-4 space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">You may notice</p>
            <BulletList
              color="bg-rose-400"
              items={[
                "Feeling disconnected from your role",
                "Increased irritability",
                "Reduced motivation",
                "A sense of \"what's the point?\"",
                "Emotional numbness",
                "Avoiding conversations or tasks",
              ]}
            />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Mental health frameworks describe this as depersonalisation or cynicism. In practical terms, it is disengagement.
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed font-medium">
            If you once cared deeply and now feel indifferent, pay attention.
          </p>
          <p className="text-xs text-muted-foreground/70 leading-relaxed italic">
            Your check-ins around mood, stress, motivation, and control feed directly into your Burnout Index to flag this shift.
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border/60 p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#0cc9a9]/10">
              <TrendingDown className="h-5 w-5 text-[#0cc9a9]" />
            </div>
            <h2 className="text-base font-bold text-foreground">3. Declining Effectiveness</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Burnout impacts performance.
          </p>
          <div className="rounded-xl bg-muted/30 p-4 space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Signs include</p>
            <BulletList
              color="bg-[#0cc9a9]"
              items={[
                "Difficulty concentrating",
                "Slower decision-making",
                "Reduced confidence",
                "Missing deadlines",
                "Working longer hours to achieve less",
              ]}
            />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The research consistently links burnout with reduced professional efficacy.
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed font-medium">
            This is not about ability. It is about sustained overload narrowing your capacity.
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border/60 p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/10">
              <AlertTriangle className="h-5 w-5 text-orange-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">Work Pattern Red Flags</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Burnout is often linked to:
          </p>
          <div className="rounded-xl bg-muted/30 p-4">
            <BulletList
              color="bg-orange-400"
              items={[
                "Chronic excessive workload",
                "Lack of control over tasks",
                "Unclear expectations",
                "Poor boundaries",
                "Constant after-hours communication",
                "Value conflict",
              ]}
            />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            These are structural drivers, not personal flaws.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Short-term stress can sharpen performance. Long-term imbalance erodes it.
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border/60 p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/10">
              <Clock className="h-5 w-5 text-red-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">When to Take It Seriously</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Everyone experiences stress. Burnout is different.
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed font-medium">
            It is sustained. It lasts months, not days.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If your Burnout Index shows a Rising or Elevated trajectory over time, and you recognise the signs above, that is your early warning.
          </p>
          <div className="rounded-xl bg-[#0cc9a9]/5 border border-[#0cc9a9]/15 p-4">
            <p className="text-sm text-foreground font-medium leading-relaxed">
              Act early. Recovery is far easier before collapse.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border/60 p-5 space-y-2">
          <p className="text-sm text-foreground font-semibold">Final Note</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Burnout is not weakness.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            It is a signal that demand has exceeded sustainable capacity.
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed font-medium">
            The earlier you respond, the easier it is to course-correct.
          </p>
        </div>
      </div>
    </div>
  );
}
