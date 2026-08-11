// Admin Community — announcements composer, challenge builder, reports queue,
// banned words. Wired to /api/admin/community/* + /api/community/* (community.ts).
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Megaphone, Trophy, Flag, ShieldBan, Pin, EyeOff, Eye, Trash2, Send } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function invalidate(path: string) {
  queryClient.invalidateQueries({ queryKey: [path] });
}

// ── Announcements ────────────────────────────────────────────────────────────

function AnnouncementsTab() {
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [pin, setPin] = useState(false);
  const [sendPush, setSendPush] = useState(true);
  const feedQ = useQuery<any>({ queryKey: ["/api/community/feed?limit=30"] });

  const post = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/community/posts", {
        scope: "announcement", body: body.trim(), isPinned: pin, sendPush,
      });
      return res.json();
    },
    onSuccess: () => {
      setBody("");
      setPin(false);
      invalidate("/api/community/feed?limit=30");
      toast({ title: "Announcement posted", description: sendPush ? "Push fan-out is running in the background." : "Posted without push." });
    },
    onError: (e: any) => toast({ title: "Could not post", description: String(e?.message || e), variant: "destructive" }),
  });

  const patchPost = useMutation({
    mutationFn: async (args: { id: number; patch: any }) => {
      await apiRequest("PATCH", `/api/admin/community/posts/${args.id}`, args.patch);
    },
    onSuccess: () => invalidate("/api/community/feed?limit=30"),
  });

  const pinned: any[] = feedQ.data?.pinned ?? [];
  const posts: any[] = feedQ.data?.posts ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Megaphone className="w-4 h-4" /> New announcement</CardTitle>
          <CardDescription>
            Posts to the Community feed as you. Push goes to all members (respecting their preferences and quiet hours).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="New programme drop, live session invite, competition winners…"
            rows={4}
            maxLength={4000}
          />
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={pin} onCheckedChange={setPin} /> Pin to top
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={sendPush} onCheckedChange={setSendPush} /> Send push notification
            </label>
            <Button
              className="ml-auto"
              disabled={!body.trim() || post.isPending}
              onClick={() => post.mutate()}
            >
              <Send className="w-4 h-4 mr-1" /> {post.isPending ? "Posting…" : "Post"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent announcements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {feedQ.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : pinned.length + posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing posted yet.</p>
          ) : (
            [...pinned, ...posts].map((p) => (
              <div key={p.id} className="flex items-start gap-3 border rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    {p.isPinned && <Badge variant="secondary" className="gap-1"><Pin className="w-3 h-3" /> pinned</Badge>}
                    <span>{new Date(p.createdAt).toLocaleString()}</span>
                    <span>· {p.reactionCount} reactions · {p.commentCount} comments</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{p.body}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="ghost" title={p.isPinned ? "Unpin" : "Pin"}
                    onClick={() => patchPost.mutate({ id: p.id, patch: { isPinned: !p.isPinned } })}>
                    <Pin className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" title="Hide"
                    onClick={() => patchPost.mutate({ id: p.id, patch: { isHidden: true } })}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Challenges ───────────────────────────────────────────────────────────────

const EMPTY_CHALLENGE = {
  title: "",
  description: "",
  type: "metric",
  metric: "steps",
  goalMode: "daily_target",
  dailyTarget: "",
  allowPersonalTarget: true,
  personalTargetOptions: "7000, 10000, 12000",
  startDate: "",
  endDate: "",
  graceDays: "4",
  prizeText: "",
  rulesUrl: "",
  isPublished: false,
};

function ChallengesTab() {
  const { toast } = useToast();
  const [form, setForm] = useState<any>(EMPTY_CHALLENGE);
  const listQ = useQuery<any[]>({ queryKey: ["/api/admin/community/challenges"] });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        goalMode: form.goalMode,
        startDate: form.startDate,
        endDate: form.endDate,
        graceDays: parseInt(form.graceDays, 10) || 0,
        allowPersonalTarget: !!form.allowPersonalTarget,
        isPublished: !!form.isPublished,
        prizeText: form.prizeText.trim() || undefined,
        rulesUrl: form.rulesUrl.trim() || undefined,
      };
      if (form.type === "metric") payload.metric = form.metric;
      if (form.type === "programme") payload.programId = parseInt(form.programId, 10) || undefined;
      if (form.dailyTarget) payload.dailyTarget = parseInt(form.dailyTarget, 10);
      if (form.allowPersonalTarget && form.personalTargetOptions.trim()) {
        payload.personalTargetOptions = form.personalTargetOptions
          .split(",").map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => n > 0);
      }
      const res = await apiRequest("POST", "/api/admin/community/challenges", payload);
      return res.json();
    },
    onSuccess: () => {
      setForm(EMPTY_CHALLENGE);
      invalidate("/api/admin/community/challenges");
      toast({ title: "Challenge created" });
    },
    onError: (e: any) => toast({ title: "Could not create", description: String(e?.message || e), variant: "destructive" }),
  });

  const patch = useMutation({
    mutationFn: async (args: { id: number; patch: any }) => {
      await apiRequest("PATCH", `/api/admin/community/challenges/${args.id}`, args.patch);
    },
    onSuccess: () => invalidate("/api/admin/community/challenges"),
  });

  const rows = listQ.data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Trophy className="w-4 h-4" /> New challenge</CardTitle>
          <CardDescription>
            Metric challenges score automatically from wearable/phone data or completed workouts. Publish when ready — members only see published challenges.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="The 45-Day Step Challenge" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2}
              placeholder="What it is, why to join, how winners are decided" />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="metric">Metric (steps / minutes / workouts)</SelectItem>
                <SelectItem value="programme">Programme cohort</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.type === "metric" ? (
            <div className="space-y-1.5">
              <Label>Metric</Label>
              <Select value={form.metric} onValueChange={(v) => set("metric", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="steps">Steps</SelectItem>
                  <SelectItem value="active_minutes">Active minutes</SelectItem>
                  <SelectItem value="workouts">Completed workouts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Programme ID</Label>
              <Input value={form.programId ?? ""} onChange={(e) => set("programId", e.target.value)} placeholder="e.g. 12" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Goal mode</Label>
            <Select value={form.goalMode} onValueChange={(v) => set("goalMode", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily_target">Daily target (consistency)</SelectItem>
                <SelectItem value="total">Total (volume leaderboard)</SelectItem>
                <SelectItem value="completion">Programme completion</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Grace days</Label>
            <Input value={form.graceDays} onChange={(e) => set("graceDays", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Start date</Label>
            <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>End date</Label>
            <Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <Switch checked={form.allowPersonalTarget} onCheckedChange={(v) => set("allowPersonalTarget", v)} />
              Members pick their own tier
            </Label>
            {form.allowPersonalTarget && (
              <Input value={form.personalTargetOptions} onChange={(e) => set("personalTargetOptions", e.target.value)}
                placeholder="7000, 10000, 12000" />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Fixed daily target (if no tiers)</Label>
            <Input value={form.dailyTarget} onChange={(e) => set("dailyTarget", e.target.value)} placeholder="e.g. 10000" />
          </div>
          <div className="space-y-1.5">
            <Label>Prize (optional)</Label>
            <Input value={form.prizeText} onChange={(e) => set("prizeText", e.target.value)} placeholder="Winner gets 3 months free" />
          </div>
          <div className="space-y-1.5">
            <Label>Official rules URL (required for prizes)</Label>
            <Input value={form.rulesUrl} onChange={(e) => set("rulesUrl", e.target.value)} placeholder="https://…" />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.isPublished} onCheckedChange={(v) => set("isPublished", v)} /> Publish immediately
            </label>
            <Button disabled={!form.title.trim() || !form.startDate || !form.endDate || create.isPending}
              onClick={() => create.mutate()}>
              {create.isPending ? "Creating…" : "Create challenge"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">All challenges</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {listQ.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No challenges yet.</p>
          ) : (
            rows.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 border rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{c.title}</span>
                    <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
                    {!c.isPublished && <Badge variant="outline">draft</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.startDate} → {c.endDate} · {c.participantCount} joined · {c.type === "programme" ? `programme ${c.programId}` : c.metric} · {c.goalMode}
                  </p>
                </div>
                <Button size="sm" variant="outline"
                  onClick={() => patch.mutate({ id: c.id, patch: { isPublished: !c.isPublished } })}>
                  {c.isPublished ? "Unpublish" : "Publish"}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Reports ──────────────────────────────────────────────────────────────────

function ReportsTab() {
  const { toast } = useToast();
  const [status, setStatus] = useState<"open" | "actioned" | "dismissed">("open");
  const path = `/api/admin/community/reports?status=${status}`;
  const q = useQuery<any[]>({ queryKey: [path] });

  const act = useMutation({
    mutationFn: async (args: { id: number; action: string }) => {
      await apiRequest("PATCH", `/api/admin/community/reports/${args.id}`, { action: args.action });
    },
    onSuccess: () => {
      invalidate(path);
      toast({ title: "Done" });
    },
    onError: (e: any) => toast({ title: "Failed", description: String(e?.message || e), variant: "destructive" }),
  });

  const rows = q.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {(["open", "actioned", "dismissed"] as const).map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
            {s}
          </Button>
        ))}
      </div>
      {q.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {status} reports. 🎉</p>
      ) : (
        rows.map((r: any) => (
          <Card key={r.id}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Flag className="w-3 h-3" />
                <span>{r.targetType} #{r.targetId}</span>
                <span>· {new Date(r.createdAt).toLocaleString()}</span>
                <span>· reported by {r.reporterUserId === "system" ? "auto-moderation" : r.reporterUserId.slice(0, 8)}</span>
              </div>
              <p className="text-sm"><span className="font-medium">Reason:</span> {r.reason || "—"}</p>
              {r.targetBody && (
                <p className="text-sm bg-muted rounded p-2 whitespace-pre-wrap">{r.targetBody}</p>
              )}
              {status === "open" && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => act.mutate({ id: r.id, action: "dismiss" })}>
                    Dismiss
                  </Button>
                  {(r.targetType === "post" || r.targetType === "comment") && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => act.mutate({ id: r.id, action: "hide_content" })}>
                        <EyeOff className="w-3.5 h-3.5 mr-1" /> Hide content
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => act.mutate({ id: r.id, action: "unhide_content" })}>
                        <Eye className="w-3.5 h-3.5 mr-1" /> Unhide
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => {
                    if (window.confirm("Ban this user from the community and hide all their content?")) {
                      act.mutate({ id: r.id, action: "ban_user" });
                    }
                  }}>
                    <ShieldBan className="w-3.5 h-3.5 mr-1" /> Ban user
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// ── Banned words ─────────────────────────────────────────────────────────────

function BannedWordsTab() {
  const { toast } = useToast();
  const [word, setWord] = useState("");
  const q = useQuery<any[]>({ queryKey: ["/api/admin/community/banned-words"] });

  const add = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/community/banned-words", { word: word.trim() });
    },
    onSuccess: () => {
      setWord("");
      invalidate("/api/admin/community/banned-words");
    },
    onError: (e: any) => toast({ title: "Could not add", description: String(e?.message || e), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/community/banned-words/${id}`);
    },
    onSuccess: () => invalidate("/api/admin/community/banned-words"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Banned words</CardTitle>
        <CardDescription>
          Posts, comments and display names containing these words are rejected outright.
          AI moderation runs on everything else automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input value={word} onChange={(e) => setWord(e.target.value)} placeholder="Add a word…"
            onKeyDown={(e) => { if (e.key === "Enter" && word.trim()) add.mutate(); }} />
          <Button disabled={!word.trim() || add.isPending} onClick={() => add.mutate()}>Add</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(q.data ?? []).map((w: any) => (
            <Badge key={w.id} variant="secondary" className="gap-1.5 cursor-pointer" onClick={() => remove.mutate(w.id)}>
              {w.word} ✕
            </Badge>
          ))}
          {(q.data ?? []).length === 0 && !q.isLoading && (
            <p className="text-sm text-muted-foreground">No banned words yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminCommunity() {
  const [, navigate] = useLocation();
  const openReportsQ = useQuery<any[]>({ queryKey: ["/api/admin/community/reports?status=open"] });
  const openCount = openReportsQ.data?.length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Community" onBack={() => navigate("/admin")} />
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <Tabs defaultValue="announcements">
          <TabsList className="mb-4">
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
            <TabsTrigger value="challenges">Challenges</TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5">
              Reports {openCount > 0 && <Badge variant="destructive">{openCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="words">Banned words</TabsTrigger>
          </TabsList>
          <TabsContent value="announcements"><AnnouncementsTab /></TabsContent>
          <TabsContent value="challenges"><ChallengesTab /></TabsContent>
          <TabsContent value="reports"><ReportsTab /></TabsContent>
          <TabsContent value="words"><BannedWordsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
