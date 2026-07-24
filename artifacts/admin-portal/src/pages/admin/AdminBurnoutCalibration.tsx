import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Shield,
  Activity,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Minus,
} from "lucide-react";

interface LevelStability {
  avgDaysInLevel: number;
  escalationRate: number;
  deescalationRate: number;
  totalTransitions: number;
}

interface RecoveryEffectiveness {
  activations: number;
  improvedAfter: number;
  worsenedAfter: number;
  stableAfter: number;
  effectivenessRate: number | null;
}

interface CalibrationReport {
  totalEvents: number;
  eventsByType: Record<string, number>;
  transitionMatrix: Record<string, Record<string, number>>;
  avgDaysBeforeEscalation: number | null;
  avgDaysBeforeDeescalation: number | null;
  recoveryModeEffectiveness: RecoveryEffectiveness;
  levelStability: Record<string, LevelStability>;
  thresholdAlerts: string[];
}

const levelConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  optimal: { label: "Optimal", color: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-400" },
  balanced: { label: "Balanced", color: "text-teal-300", bg: "bg-teal-500/10", dot: "bg-teal-400" },
  strained: { label: "Strained", color: "text-[#0cc9a9]", bg: "bg-[#0cc9a9]/100/10", dot: "bg-[#0cc9a9]" },
  overloaded: { label: "Overloaded", color: "text-orange-400", bg: "bg-orange-500/10", dot: "bg-orange-400" },
  sustained_overload: { label: "Sustained Overload", color: "text-red-300/70", bg: "bg-red-500/8", dot: "bg-red-400" },
};

const eventTypeLabels: Record<string, string> = {
  level_transition: "Level Transitions",
  sustained_high: "Sustained High (14+ days)",
  rapid_improvement: "Rapid Improvements",
  recovery_mode_activated: "Recovery Mode Activations",
};

const levels = ["optimal", "balanced", "strained", "overloaded", "sustained_overload"];

export default function AdminBurnoutCalibration() {
  const [, navigate] = useLocation();

  const { data: report, isLoading } = useQuery<CalibrationReport>({
    queryKey: ["/api/admin/burnout/calibration-report"],
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopHeader title="Burnout Calibration" onBack={() => navigate("/admin")} />

      <div className="px-5 pt-14 space-y-5 max-w-2xl mx-auto">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Automated analysis of whether the burnout threshold bands are correctly predicting real-world patterns. Data accumulates over time as users generate daily scores.
        </p>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !report || report.totalEvents === 0 ? (
          <Card className="border-border/60">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No calibration data yet</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Calibration events are recorded automatically as users generate daily burnout scores. Data will appear here once users begin transitioning between score levels.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {report.thresholdAlerts.length > 0 && (
              <div className="space-y-2.5">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#0cc9a9]" />
                  Threshold Alerts
                </h2>
                {report.thresholdAlerts.map((alert, i) => (
                  <div key={i} className="rounded-xl bg-[#0cc9a9]/100/5 border border-[#0cc9a9]/20 p-4">
                    <p className="text-xs text-[#0cc9a9]/80 leading-relaxed">{alert}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Card className="border-border/60">
                <CardContent className="pt-4 pb-4 px-4">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">Total Events</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{report.totalEvents}</p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="pt-4 pb-4 px-4">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">Event Types</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{Object.keys(report.eventsByType).length}</p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="pt-4 pb-4 px-4">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-[#0cc9a9]/70" />
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">Avg Escalation</p>
                  </div>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {report.avgDaysBeforeEscalation !== null ? `${report.avgDaysBeforeEscalation}d` : "--"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">days before worsening</p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="pt-4 pb-4 px-4">
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="h-3.5 w-3.5 text-emerald-400/70" />
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">Avg Recovery</p>
                  </div>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {report.avgDaysBeforeDeescalation !== null ? `${report.avgDaysBeforeDeescalation}d` : "--"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">days before improving</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#0cc9a9]" />
                  Event Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {Object.entries(report.eventsByType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{eventTypeLabels[type] || type}</span>
                    <Badge variant="secondary" className="text-xs font-bold">{count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#0cc9a9]" />
                  Level Stability
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">How long users stay in each level and where they go</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {levels.map((level) => {
                  const data = report.levelStability[level];
                  const config = levelConfig[level];
                  if (!data || data.totalTransitions === 0) return null;
                  return (
                    <div key={level} className={`rounded-xl ${config.bg} p-3.5 space-y-2`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${config.dot}`} />
                          <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{data.totalTransitions} transitions</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Avg Duration</p>
                          <p className="text-sm font-bold text-foreground">{data.avgDaysInLevel}d</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <TrendingUp className="h-2.5 w-2.5 text-[#0cc9a9]/60" /> Escalated
                          </p>
                          <p className="text-sm font-bold text-foreground">{data.escalationRate}%</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <TrendingDown className="h-2.5 w-2.5 text-emerald-400/60" /> Improved
                          </p>
                          <p className="text-sm font-bold text-foreground">{data.deescalationRate}%</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {levels.every(l => !report.levelStability[l] || report.levelStability[l].totalTransitions === 0) && (
                  <p className="text-xs text-muted-foreground text-center py-4">No level transitions recorded yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[#0cc9a9]" />
                  Transition Matrix
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">How users move between levels (from row to column)</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr>
                        <th className="text-left text-muted-foreground font-semibold p-1.5 w-24">From / To</th>
                        {levels.map(l => (
                          <th key={l} className={`text-center font-semibold p-1.5 ${levelConfig[l].color}`}>
                            {levelConfig[l].label.split(" ")[0]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {levels.map(from => (
                        <tr key={from} className="border-t border-border/30">
                          <td className={`p-1.5 font-semibold ${levelConfig[from].color}`}>
                            {levelConfig[from].label.split(" ")[0]}
                          </td>
                          {levels.map(to => {
                            const val = report.transitionMatrix[from]?.[to] || 0;
                            return (
                              <td key={to} className="text-center p-1.5">
                                <span className={`tabular-nums ${val > 0 ? "text-foreground font-bold" : "text-muted-foreground/40"}`}>
                                  {val}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-400" />
                  Recovery Mode Effectiveness
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">Whether activating Recovery Mode leads to score improvement</p>
              </CardHeader>
              <CardContent>
                {report.recoveryModeEffectiveness.activations === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No Recovery Mode activations recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Total Activations</span>
                      <span className="text-sm font-bold text-foreground">{report.recoveryModeEffectiveness.activations}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-emerald-500/8 p-3 text-center">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                        <p className="text-lg font-bold text-emerald-400">{report.recoveryModeEffectiveness.improvedAfter}</p>
                        <p className="text-[10px] text-muted-foreground">Improved</p>
                      </div>
                      <div className="rounded-xl bg-zinc-500/8 p-3 text-center">
                        <Minus className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                        <p className="text-lg font-bold text-foreground">{report.recoveryModeEffectiveness.stableAfter}</p>
                        <p className="text-[10px] text-muted-foreground">Stable</p>
                      </div>
                      <div className="rounded-xl bg-[#0cc9a9]/100/5 p-3 text-center">
                        <XCircle className="h-4 w-4 text-[#0cc9a9]/60 mx-auto mb-1" />
                        <p className="text-lg font-bold text-[#0cc9a9]/70">{report.recoveryModeEffectiveness.worsenedAfter}</p>
                        <p className="text-[10px] text-muted-foreground">Worsened</p>
                      </div>
                    </div>
                    {report.recoveryModeEffectiveness.effectivenessRate !== null && (
                      <div className="rounded-xl bg-[#0cc9a9]/5 border border-[#0cc9a9]/15 p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Effectiveness Rate</p>
                        <p className="text-2xl font-bold text-[#0cc9a9] mt-0.5">{report.recoveryModeEffectiveness.effectivenessRate}%</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
