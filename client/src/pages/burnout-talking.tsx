import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import TopHeader from "@/components/TopHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Target,
  Lightbulb,
  Shield,
  BarChart3,
  Layers,
  CalendarCheck,
  Copy,
  Send,
  Lock,
} from "lucide-react";

interface BurnoutScoreData {
  id: number;
  score: number;
  trajectory: string;
  confidence: string;
  topDrivers: any[];
  computedDate: string;
  checkInCount: number;
}

interface MonthlyLogEntry {
  id: number;
  score: number;
  trajectory: string;
  computedDate: string;
}

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

function shouldShowCheckinAction(score: number, trajectory: string, monthlyLog: MonthlyLogEntry[] | undefined): boolean {
  if (score >= 60) return true;

  if (score >= 45 && trajectory === "rising" && monthlyLog && monthlyLog.length >= 2) {
    const sorted = [...monthlyLog].sort((a, b) => new Date(a.computedDate).getTime() - new Date(b.computedDate).getTime());
    const lastTwo = sorted.slice(-2);
    const consecutiveRising = lastTwo.every((entry) => entry.trajectory === "rising");
    if (consecutiveRising) return true;
  }

  return false;
}

export default function BurnoutTalking() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [includeTrajectory, setIncludeTrajectory] = useState(false);
  const [messageText, setMessageText] = useState(
    "I'd appreciate a short meeting to review workload priorities and ensure performance remains sustainable. Please let me know a suitable time."
  );

  const { data: currentScore } = useQuery<BurnoutScoreData>({
    queryKey: ["/api/burnout/current"],
  });

  const { data: monthlyLog } = useQuery<MonthlyLogEntry[]>({
    queryKey: ["/api/burnout/monthly-log"],
  });

  const score = currentScore?.score ?? 0;
  const trajectory = currentScore?.trajectory ?? "stable";
  const showCheckin = shouldShowCheckinAction(score, trajectory, monthlyLog);

  const trajectoryLabel = trajectory === "rising" ? "Rising" : trajectory === "elevated" ? "Elevated" : trajectory === "recovering" ? "Recovering" : "Stable";

  const composedMessage = includeTrajectory
    ? `${messageText}\n\nMy Burnout Index has been trending ${trajectoryLabel} over the past few months.`
    : messageText;

  const handleCopy = () => {
    navigator.clipboard.writeText(composedMessage);
    toast({ title: "Copied to clipboard", description: "Message copied successfully." });
    setShowModal(false);
  };

  const handleSend = () => {
    if (navigator.share) {
      navigator.share({ text: composedMessage }).catch(() => {});
    } else {
      navigator.clipboard.writeText(composedMessage);
      toast({ title: "Copied to clipboard", description: "No email integration available. Message copied instead." });
    }
    setShowModal(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Talk to Your Manager" onBack={() => navigate("/recovery/burnout-tracker")} />

      <div className="px-4 pt-14 pb-32 space-y-6">
        <div className="space-y-3 px-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            If your Burnout Index is Rising or Elevated, that's a signal.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sustained overload doesn't fix itself.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Handled properly, this conversation protects performance and long-term credibility.
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed font-medium">
            This isn't weakness. It's calibration.
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border/60 p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#0cc9a9]/10">
              <MessageSquare className="h-5 w-5 text-[#0cc9a9]" />
            </div>
            <h2 className="text-base font-bold text-foreground">Step 1. State the Facts</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Avoid vague language.
          </p>
          <div className="rounded-xl bg-muted/30 p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Don't say</p>
              <p className="text-sm text-foreground/60 italic">"I'm stressed."</p>
            </div>
            <div className="border-t border-border/40 pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Say</p>
              <p className="text-sm text-foreground/90">"I'm consistently working late to meet deadlines. My focus has dropped. Fatigue is becoming constant."</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            Observable. Measured. Professional.
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border/60 p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#0cc9a9]/10">
              <Target className="h-5 w-5 text-[#0cc9a9]" />
            </div>
            <h2 className="text-base font-bold text-foreground">Step 2. Identify the Imbalance</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Burnout is usually imbalance, not effort. Clarify:
          </p>
          <div className="rounded-xl bg-muted/30 p-4">
            <BulletList
              color="bg-[#0cc9a9]"
              items={[
                "Where workload exceeds capacity",
                "Which priorities conflict",
                "What timelines are unrealistic",
                "Where constant availability is expected",
              ]}
            />
          </div>
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            Clarity removes friction.
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border/60 p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <Lightbulb className="h-5 w-5 text-emerald-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">Step 3. Bring Adjustments</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Strong operators propose solutions.
          </p>
          <div className="rounded-xl bg-muted/30 p-4 space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Examples</p>
            <BulletList
              color="bg-emerald-400"
              items={[
                "Reprioritise projects",
                "Adjust timelines",
                "Delegate workload",
                "Clarify role scope",
                "Protect focused work blocks",
                "Reduce after-hours communication",
              ]}
            />
          </div>
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            This is alignment, not complaint.
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border/60 p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10">
              <Shield className="h-5 w-5 text-rose-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">If You're Hesitant to Raise It</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Most professionals hesitate. They fear reputational damage.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            But sustained overload quietly erodes performance anyway.
          </p>
          <div className="rounded-xl bg-muted/30 p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">If "burnout" feels too heavy, change the frame</p>
            <p className="text-sm text-foreground/90">
              "I'd like to review workload alignment to ensure performance remains sustainable."
            </p>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed font-medium">
            You are protecting output. Not admitting failure.
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border/60 p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#0cc9a9]/10">
              <BarChart3 className="h-5 w-5 text-[#0cc9a9]" />
            </div>
            <h2 className="text-base font-bold text-foreground">Use Data, Not Emotion</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your Burnout Index tracks trends over months. That's signal.
          </p>
          <div className="rounded-xl bg-muted/30 p-4">
            <p className="text-sm text-foreground/90">
              "I've been reviewing my workload and recovery trends and would value a short alignment meeting."
            </p>
          </div>
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            Calm. Controlled. Factual.
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border/60 p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10">
              <Layers className="h-5 w-5 text-indigo-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">Start Smaller</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If you're not ready for a full conversation:
          </p>
          <div className="rounded-xl bg-muted/30 p-4">
            <BulletList
              color="bg-indigo-400"
              items={[
                "Confirm priorities via email",
                "Clarify deadlines",
                "Protect deep work time",
                "Rebuild recovery boundaries",
              ]}
            />
          </div>
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            Structure reduces strain.
          </p>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          If you want a structured starting point, use this.
        </p>

        {showCheckin && (
          <div className="rounded-2xl bg-card border border-border/60 p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#0cc9a9]/10">
                <CalendarCheck className="h-5 w-5 text-[#0cc9a9]" />
              </div>
              <h2 className="text-base font-bold text-foreground">Request a Wellbeing Check-In</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Send a structured meeting request to review workload sustainability.
            </p>
            <Button
              onClick={() => setShowModal(true)}
              className="w-full bg-primary hover:opacity-90 text-white rounded-full py-3 text-sm font-semibold"
            >
              Request a Wellbeing Check-In
            </Button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl p-6 space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">Request a Wellbeing Check-In</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <span className="sr-only">Close</span>
                ✕
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Send a short meeting request. You control what is shared.
            </p>

            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={4}
              className="bg-muted/30 border-border/60 text-sm text-foreground resize-none"
            />

            <div className="flex items-center justify-between gap-3">
              <label htmlFor="trajectory-toggle" className="text-sm text-foreground cursor-pointer">
                Include Burnout Index trajectory (optional)
              </label>
              <Switch
                id="trajectory-toggle"
                checked={includeTrajectory}
                onCheckedChange={setIncludeTrajectory}
              />
            </div>

            {includeTrajectory && (
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground italic">
                  "My Burnout Index has been trending {trajectoryLabel} over the past few months."
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>Detailed health data is never shared without explicit consent.</span>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleSend}
                className="flex-1 bg-primary hover:opacity-90 text-white rounded-full py-3 text-sm font-semibold"
              >
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
              <Button
                onClick={handleCopy}
                variant="outline"
                className="flex-1 rounded-full py-3 text-sm font-semibold"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Message
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
