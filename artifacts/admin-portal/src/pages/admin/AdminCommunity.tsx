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
import { Megaphone, Trophy, Flag, ShieldBan, Pin, EyeOff, Eye, Trash2, Send, Radio, Copy, RefreshCw } from "lucide-react";
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const listQ = useQuery<any[]>({ queryKey: ["/api/admin/community/challenges"] });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const buildPayload = () => {
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
    return payload;
  };

  const startEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      title: c.title ?? "",
      description: c.description ?? "",
      type: c.type ?? "metric",
      metric: c.metric ?? "steps",
      programId: c.programId ? String(c.programId) : "",
      goalMode: c.goalMode ?? "daily_target",
      dailyTarget: c.dailyTarget ? String(c.dailyTarget) : "",
      allowPersonalTarget: !!c.allowPersonalTarget,
      personalTargetOptions: Array.isArray(c.personalTargetOptions) ? c.personalTargetOptions.join(", ") : "",
      startDate: c.startDate ?? "",
      endDate: c.endDate ?? "",
      graceDays: String(c.graceDays ?? 2),
      prizeText: c.prizeText ?? "",
      rulesUrl: c.rulesUrl ?? "",
      isPublished: !!c.isPublished,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_CHALLENGE);
  };

  const create = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      const res = editingId
        ? await apiRequest("PATCH", `/api/admin/community/challenges/${editingId}`, payload)
        : await apiRequest("POST", "/api/admin/community/challenges", payload);
      return res.json();
    },
    onSuccess: () => {
      const wasEdit = editingId !== null;
      cancelEdit();
      invalidate("/api/admin/community/challenges");
      toast({ title: wasEdit ? "Challenge updated" : "Challenge created" });
    },
    onError: (e: any) => toast({ title: "Could not save", description: String(e?.message || e), variant: "destructive" }),
  });

  const patch = useMutation({
    mutationFn: async (args: { id: number; patch: any }) => {
      await apiRequest("PATCH", `/api/admin/community/challenges/${args.id}`, args.patch);
      return args;
    },
    onSuccess: (args) => {
      invalidate("/api/admin/community/challenges");
      if (args.patch.isPublished !== undefined) {
        toast({
          title: args.patch.isPublished ? "Published" : "Unpublished",
          description: args.patch.isPublished
            ? "Members can now see and join this challenge."
            : "Hidden from members — it's a draft again.",
        });
      }
    },
    onError: (e: any) => toast({ title: "Failed", description: String(e?.message || e), variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/community/challenges/${id}`);
    },
    onSuccess: () => {
      invalidate("/api/admin/community/challenges");
      toast({ title: "Challenge deleted", description: "Its posts, scores and participants were removed too." });
    },
    onError: (e: any) => toast({ title: "Could not delete", description: String(e?.message || e), variant: "destructive" }),
  });

  const rows = listQ.data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="w-4 h-4" /> {editingId ? `Editing challenge #${editingId}` : "New challenge"}
            {editingId && (
              <Button size="sm" variant="ghost" className="ml-auto" onClick={cancelEdit}>Cancel edit</Button>
            )}
          </CardTitle>
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
              <Switch checked={form.isPublished} onCheckedChange={(v) => set("isPublished", v)} />
              {editingId ? "Published" : "Publish immediately"}
            </label>
            <Button disabled={!form.title.trim() || !form.startDate || !form.endDate || create.isPending}
              onClick={() => create.mutate()}>
              {create.isPending ? "Saving…" : editingId ? "Save changes" : "Create challenge"}
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
                    {c.isPublished ? (
                      <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
                    ) : (
                      <Badge variant="outline">draft — hidden from members</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.startDate} → {c.endDate} · {c.participantCount} joined · {c.type === "programme" ? `programme ${c.programId}` : c.metric} · {c.goalMode}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => startEdit(c)}>Edit</Button>
                <Button size="sm" variant="outline" disabled={patch.isPending}
                  onClick={() => patch.mutate({ id: c.id, patch: { isPublished: !c.isPublished } })}>
                  {c.isPublished ? "Unpublish" : "Publish"}
                </Button>
                <Button size="sm" variant="destructive" disabled={del.isPending} onClick={() => {
                  if (window.confirm(`Delete "${c.title}"? This also removes its posts, scores and participants. This cannot be undone.`)) {
                    del.mutate(c.id);
                  }
                }}>
                  <Trash2 className="w-3.5 h-3.5" />
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

// ── Live sessions ────────────────────────────────────────────────────────────

function CopyField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const { toast } = useToast();
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <code className="bg-muted rounded px-2 py-1 truncate flex-1">
        {secret && !revealed ? "••••••••••••••••" : value}
      </code>
      {secret && (
        <Button size="sm" variant="ghost" onClick={() => setRevealed(!revealed)}>
          {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </Button>
      )}
      <Button size="sm" variant="ghost" title="Copy"
        onClick={() => { navigator.clipboard.writeText(value); toast({ title: `${label} copied` }); }}>
        <Copy className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function LiveTab() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState("45");
  const path = "/api/admin/community/live-sessions";
  const q = useQuery<any[]>({ queryKey: [path] });

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", path, {
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledAt: new Date(when).toISOString(),
        durationMinutes: parseInt(duration, 10) || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      setTitle(""); setDescription(""); setWhen("");
      invalidate(path);
      toast({ title: "Session scheduled", description: "Stream key is ready — set it up in Ecamm before going live." });
    },
    onError: (e: any) => toast({ title: "Could not schedule", description: String(e?.message || e), variant: "destructive" }),
  });

  const patch = useMutation({
    mutationFn: async (args: { id: number; body: any }) => {
      const res = await apiRequest("PATCH", `${path}/${args.id}`, args.body);
      return { args, data: await res.json() };
    },
    onSuccess: ({ args, data }) => {
      invalidate(path);
      if (args.body.action === "sync") {
        const statusLine =
          data.status === "live" ? "LIVE — your stream is connected."
          : data.status === "scheduled" ? "Scheduled — Mux is waiting for your stream to connect."
          : data.status === "ended" ? (data.recordingPlaybackId ? "Ended — replay is ready." : "Ended — replay still processing.")
          : `Status: ${data.status}`;
        toast({ title: "Status checked", description: statusLine });
      } else if (args.body.action === "cancel") {
        toast({ title: "Session cancelled" });
      } else if (args.body.action === "end") {
        toast({ title: "Session marked ended" });
      } else {
        toast({ title: "Session updated" });
      }
    },
    onError: (e: any) => toast({ title: "Failed", description: String(e?.message || e), variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `${path}/${id}`);
    },
    onSuccess: () => {
      invalidate(path);
      toast({ title: "Session deleted" });
    },
    onError: (e: any) => toast({ title: "Could not delete", description: String(e?.message || e), variant: "destructive" }),
  });

  const rows = q.data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Radio className="w-4 h-4" /> Schedule a live session</CardTitle>
          <CardDescription>
            Creates a Mux live stream. In Ecamm Live, add a Custom RTMP destination with the server URL and stream key shown on the session below — start streaming a couple of minutes before the scheduled time. Members get a push 15 minutes before, and again the moment your stream connects. The session records automatically for replay.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Full-body mobility — live class" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="What to bring, who it's for" />
          </div>
          <div className="space-y-1.5">
            <Label>Date & time</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Planned length (minutes)</Label>
            <Input value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button disabled={!title.trim() || !when || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Creating…" : "Schedule session"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Sessions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {q.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
          ) : (
            rows.map((s: any) => (
              <div key={s.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{s.title}</span>
                  <Badge variant={s.status === "live" ? "destructive" : s.status === "scheduled" ? "default" : "secondary"}>
                    {s.status === "live" ? "● LIVE" : s.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">{new Date(s.scheduledAt).toLocaleString()}</span>
                </div>
                {(s.status === "scheduled" || s.status === "live") && (
                  <div className="space-y-1.5">
                    <CopyField label="RTMP server" value={s.rtmpUrl} />
                    <CopyField label="Stream key" value={s.muxStreamKey} secret />
                  </div>
                )}
                {s.recordingPlaybackId && (
                  <a className="text-xs text-primary underline" target="_blank" rel="noreferrer"
                    href={`https://stream.mux.com/${s.recordingPlaybackId}.m3u8`}>
                    Replay ready (HLS)
                  </a>
                )}
                <div className="flex gap-2 pt-1">
                  {(s.status === "scheduled" || s.status === "live" || (s.status === "ended" && !s.recordingPlaybackId)) && (
                    <Button size="sm" variant="outline" disabled={patch.isPending}
                      onClick={() => patch.mutate({ id: s.id, body: { action: "sync" } })}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> {patch.isPending ? "Checking…" : "Refresh status"}
                    </Button>
                  )}
                  {s.status === "live" && (
                    <Button size="sm" variant="outline" onClick={() => patch.mutate({ id: s.id, body: { action: "end" } })}>
                      Mark ended
                    </Button>
                  )}
                  {s.status === "scheduled" && (
                    <Button size="sm" variant="outline" onClick={() => {
                      if (window.confirm("Cancel this session? Members will no longer see it.")) patch.mutate({ id: s.id, body: { action: "cancel" } });
                    }}>
                      Cancel
                    </Button>
                  )}
                  {(s.status === "cancelled" || s.status === "ended") && (
                    <Button size="sm" variant="destructive" disabled={del.isPending} onClick={() => {
                      if (window.confirm(`Delete "${s.title}" and its chat? This cannot be undone.`)) del.mutate(s.id);
                    }}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
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
            <TabsTrigger value="live">Live</TabsTrigger>
            <TabsTrigger value="challenges">Challenges</TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5">
              Reports {openCount > 0 && <Badge variant="destructive">{openCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="words">Banned words</TabsTrigger>
          </TabsList>
          <TabsContent value="announcements"><AnnouncementsTab /></TabsContent>
          <TabsContent value="live"><LiveTab /></TabsContent>
          <TabsContent value="challenges"><ChallengesTab /></TabsContent>
          <TabsContent value="reports"><ReportsTab /></TabsContent>
          <TabsContent value="words"><BannedWordsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
