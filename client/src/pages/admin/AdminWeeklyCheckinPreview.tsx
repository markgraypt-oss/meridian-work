import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UserData {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  isAdmin?: boolean;
}

interface PreviewSuggestion {
  id: string;
  title: string;
  body: string;
  category: string;
}

interface PreviewPayload {
  weekStart: string;
  weekEnd: string;
  summary: { wins: string[]; concerns: string[]; burnoutTrajectory: string };
  metrics: Record<string, unknown>;
  suggestions: PreviewSuggestion[];
}

interface PreviewResult {
  userId: string;
  weekStart: string;
  persisted: boolean;
  payload: PreviewPayload;
}

export default function AdminWeeklyCheckinPreview() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PreviewResult | null>(null);

  const { data: users = [] } = useQuery<UserData[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0cc9a9]" />
      </div>
    );
  }
  if (!user) {
    navigate("/");
    return null;
  }

  const runPreview = async () => {
    if (!selectedUserId) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await apiRequest("POST", `/api/admin/weekly-checkins/preview/${selectedUserId}`);
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      toast({ title: "Preview failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Weekly Check-in Preview" onBack={() => navigate("/admin")} />
      <div className="max-w-3xl mx-auto p-4 pt-16 pb-32">
        <p className="text-sm text-muted-foreground mb-4">
          Generate a non-persisted preview of the weekly AI summary for any user.
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#0cc9a9]" /> Run preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger data-testid="select-user">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.email}
                    {u.firstName || u.lastName ? ` — ${[u.firstName, u.lastName].filter(Boolean).join(" ")}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={runPreview} disabled={!selectedUserId || running} data-testid="button-run-preview">
              {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Generate preview
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card data-testid="card-preview-output">
            <CardHeader>
              <CardTitle className="text-base">
                Preview for {result.userId} — week of {new Date(result.weekStart).toISOString().slice(0, 10)}
              </CardTitle>
              <p className="text-xs text-muted-foreground">Not persisted. Generated for QA only.</p>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-[60vh]" data-testid="text-preview-json">
                {JSON.stringify(result.payload, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
