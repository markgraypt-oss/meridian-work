import { useLocation } from "wouter";
import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Smartphone, Activity, Heart, Watch, RefreshCw, Upload, Unplug, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, formatDistanceToNow } from "date-fns";

type Provider = "oura" | "whoop" | "google_fit" | "apple_health";

interface ProviderInfo {
  provider: Provider;
  label: string;
  oauth: boolean;
  configured: boolean;
}
interface Connection {
  provider: Provider;
  status: "connected" | "disconnected" | "needs_reauth" | string;
  connectedAt?: string | null;
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
  lastSyncError?: string | null;
}

const ICONS: Record<Provider, typeof Heart> = {
  oura: Watch,
  whoop: Activity,
  google_fit: Smartphone,
  apple_health: Heart,
};

const DESCRIPTIONS: Record<Provider, string> = {
  oura: "Sync sleep stages, HRV, readiness and resting heart rate from your Oura Ring.",
  whoop: "Sync recovery, sleep, strain and HRV from your WHOOP band.",
  google_fit: "Sync steps, active minutes and heart rate from Google Fit.",
  apple_health: "Upload an Apple Health export.zip to import sleep, steps and HRV.",
};

export default function IntegrationsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);

  const { data: providers = [], isLoading: loadingProviders } = useQuery<ProviderInfo[]>({
    queryKey: ["/api/wearables/providers"],
  });
  const { data: connections = [], isLoading: loadingConnections } = useQuery<Connection[]>({
    queryKey: ["/api/wearables/connections"],
  });

  const connByProvider = new Map(connections.map((c) => [c.provider, c]));

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/wearables/connections"] });
    queryClient.invalidateQueries({ queryKey: ["/api/wearables/today"] });
  };

  const connectMutation = useMutation({
    mutationFn: async (provider: Provider) => {
      const res = await apiRequest("GET", `/api/wearables/connect/${provider}`);
      return await res.json() as { url: string };
    },
    onSuccess: (data, provider) => {
      const popup = window.open(data.url, "_blank", "width=600,height=700");
      const handler = (e: MessageEvent) => {
        // Only trust postMessage from our own origin to prevent third-party
        // tabs from spoofing a "connected" event.
        if (e.origin !== window.location.origin) return;
        if (e.data?.type === "wearable_oauth_done" && e.data?.provider === provider) {
          window.removeEventListener("message", handler);
          setBusyProvider(null);
          if (e.data.ok) {
            toast({ title: "Connected", description: `${labelOf(provider)} connected. Initial sync started.` });
            setTimeout(refreshAll, 1500);
          } else {
            toast({ title: "Connection failed", variant: "destructive" });
          }
        }
      };
      window.addEventListener("message", handler);
      // Safety timeout
      setTimeout(() => { if (popup?.closed) { window.removeEventListener("message", handler); setBusyProvider(null); refreshAll(); } }, 60_000);
    },
    onError: (err: any) => {
      setBusyProvider(null);
      toast({ title: "Cannot connect", description: err?.message || "Provider not configured", variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async ({ provider, deleteData }: { provider: Provider; deleteData: boolean }) => {
      await apiRequest("POST", `/api/wearables/disconnect/${provider}${deleteData ? "?deleteData=1" : ""}`);
    },
    onSuccess: () => { refreshAll(); toast({ title: "Disconnected" }); setBusyProvider(null); },
    onError: () => { setBusyProvider(null); toast({ title: "Disconnect failed", variant: "destructive" }); },
  });

  const syncMutation = useMutation({
    mutationFn: async (provider: Provider) => {
      const res = await apiRequest("POST", `/api/wearables/sync/${provider}`);
      return await res.json();
    },
    onSuccess: (data: any, provider) => {
      refreshAll();
      setBusyProvider(null);
      if (data.status === "ok") {
        toast({ title: "Sync complete", description: `${labelOf(provider)}: ${data.daysSynced} days synced.` });
      } else {
        toast({ title: "Sync failed", description: data.error || "Unknown error", variant: "destructive" });
      }
    },
    onError: (err: any) => { setBusyProvider(null); toast({ title: "Sync failed", description: err?.message, variant: "destructive" }); },
  });

  const labelOf = (p: Provider) => providers.find((x) => x.provider === p)?.label || p;

  const handleAppleHealthUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("export", file);
      const res = await fetch("/api/wearables/apple-health/upload", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Upload failed (${res.status})`);
      }
      const data = await res.json();
      toast({ title: "Apple Health imported", description: `${data.daysWritten} days of metrics written.` });
      refreshAll();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/settings")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold">Wearables & Integrations</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Connect your wearable devices so Meridian can use objective sleep, HRV, heart rate and activity data when assessing burnout and personalising your plan.
        </p>

        {(loadingProviders || loadingConnections) && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {providers.map((p) => {
          const Icon = ICONS[p.provider] || Smartphone;
          const conn = connByProvider.get(p.provider);
          const isConnected = conn && conn.status === "connected";
          const needsReauth = conn?.status === "needs_reauth";
          const isBusy = busyProvider === p.provider;

          return (
            <Card key={p.provider} className="p-4" data-testid={`integration-${p.provider}`}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{p.label}</h3>
                    {isConnected && (
                      <Badge variant="default" className="gap-1"><CheckCircle2 className="w-3 h-3" /> Connected</Badge>
                    )}
                    {needsReauth && (
                      <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" /> Reconnect</Badge>
                    )}
                    {!p.configured && p.oauth && (
                      <Badge variant="secondary">Not configured</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{DESCRIPTIONS[p.provider]}</p>

                  {conn && (
                    <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                      {conn.connectedAt && <div>Connected {formatDistanceToNow(new Date(conn.connectedAt), { addSuffix: true })}</div>}
                      {conn.lastSyncAt ? (
                        <div>
                          Last sync {formatDistanceToNow(new Date(conn.lastSyncAt), { addSuffix: true })}
                          {conn.lastSyncStatus === "error" && <span className="text-destructive"> · {conn.lastSyncError || "error"}</span>}
                        </div>
                      ) : isConnected && <div>Awaiting first sync…</div>}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mt-3">
                    {p.provider === "apple_health" ? (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".zip"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAppleHealthUpload(f); }}
                          data-testid="input-apple-health-file"
                        />
                        <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} data-testid="button-upload-apple-health">
                          {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                          {uploading ? "Importing…" : "Upload export.zip"}
                        </Button>
                        {isConnected && (
                          <Button size="sm" variant="outline" onClick={() => {
                            const wipe = confirm(`Disconnect ${p.label}?\n\nClick OK to also DELETE imported metrics.\nClick Cancel to disconnect but keep history.`);
                            if (wipe) {
                              setBusyProvider(p.provider);
                              disconnectMutation.mutate({ provider: p.provider, deleteData: true });
                            } else {
                              if (!confirm(`Disconnect ${p.label} and keep historical data?`)) return;
                              setBusyProvider(p.provider);
                              disconnectMutation.mutate({ provider: p.provider, deleteData: false });
                            }
                          }} disabled={isBusy}>
                            <Unplug className="w-4 h-4 mr-1" /> Disconnect
                          </Button>
                        )}
                      </>
                    ) : isConnected || needsReauth ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setBusyProvider(p.provider); syncMutation.mutate(p.provider); }} disabled={isBusy} data-testid={`button-sync-${p.provider}`}>
                          {isBusy && syncMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                          Sync now
                        </Button>
                        {needsReauth && (
                          <Button size="sm" onClick={() => { setBusyProvider(p.provider); connectMutation.mutate(p.provider); }} disabled={isBusy || !p.configured}>
                            Reconnect
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => {
                          const wipe = confirm(`Disconnect ${p.label}?\n\nClick OK to also DELETE all previously synced metrics for this device.\nClick Cancel to disconnect but KEEP your historical data.`);
                          // OK => deleteData=true, Cancel => keep data (still disconnect via separate prompt)
                          if (wipe) {
                            setBusyProvider(p.provider);
                            disconnectMutation.mutate({ provider: p.provider, deleteData: true });
                          } else {
                            if (!confirm(`Disconnect ${p.label} and keep historical data?`)) return;
                            setBusyProvider(p.provider);
                            disconnectMutation.mutate({ provider: p.provider, deleteData: false });
                          }
                        }} disabled={isBusy} data-testid={`button-disconnect-${p.provider}`}>
                          <Unplug className="w-4 h-4 mr-1" /> Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => { setBusyProvider(p.provider); connectMutation.mutate(p.provider); }}
                        disabled={isBusy || !p.configured}
                        data-testid={`button-connect-${p.provider}`}
                      >
                        {isBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}

        <p className="text-xs text-muted-foreground pt-2">
          Your tokens are encrypted at rest. You can disconnect at any time and choose whether to keep historical data.
        </p>
      </div>
    </div>
  );
}
