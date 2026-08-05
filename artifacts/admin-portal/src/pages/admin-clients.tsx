import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Send,
  RefreshCw,
  Eye,
  Loader2,
} from "lucide-react";

type CoachAccessStatus = "none" | "pending" | "granted" | "declined" | "revoked";

interface CoachClient {
  clientUserId: string;
  name: string;
  email: string;
  status: CoachAccessStatus;
  requestId: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
}

function statusBadge(status: CoachAccessStatus) {
  switch (status) {
    case "granted":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Access granted
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
          <Clock className="h-3 w-3" />
          Awaiting response
        </Badge>
      );
    case "declined":
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
          <XCircle className="h-3 w-3" />
          Declined
        </Badge>
      );
    case "revoked":
      return (
        <Badge className="bg-slate-100 text-slate-600 border-slate-200 gap-1">
          <MinusCircle className="h-3 w-3" />
          Revoked
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground gap-1">
          <MinusCircle className="h-3 w-3" />
          No request sent
        </Badge>
      );
  }
}

export default function AdminClients() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<{ clients: CoachClient[] }>({
    queryKey: ["/api/admin/coach-access/clients"],
  });

  const requestMutation = useMutation({
    mutationFn: (clientUserId: string) =>
      apiRequest("POST", "/api/admin/coach-access/request", { clientUserId }),
    onSuccess: (_data, clientUserId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coach-access/clients"] });
      const client = data?.clients.find((c) => c.clientUserId === clientUserId);
      const wasAlreadyPending = client?.status === "pending";
      toast({
        title: wasAlreadyPending ? "Reminder sent" : "Access request sent",
        description: wasAlreadyPending
          ? "The client has been sent a push notification and in-app reminder."
          : "The client will receive a notification to review and respond.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to send",
        description: err?.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  const clients = data?.clients ?? [];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <UserCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Coaching Clients</h1>
          <p className="text-sm text-muted-foreground">
            Manage data-access consent for your private 1:1 clients
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading clients…</span>
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <UserCheck className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="font-medium text-foreground">No coaching clients yet</p>
            <p className="text-sm text-muted-foreground">
              Go to User Management, open a user's edit form, and toggle{" "}
              <span className="font-medium">Coaching client</span> to add them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <Card key={client.clientUserId}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate">{client.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{client.email}</p>
                  <div className="mt-1.5">{statusBadge(client.status)}</div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {client.status === "granted" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/admin/clients/${client.clientUserId}`)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      View profile
                    </Button>
                  )}

                  {client.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={requestMutation.isPending && requestMutation.variables === client.clientUserId}
                      onClick={() => requestMutation.mutate(client.clientUserId)}
                    >
                      {requestMutation.isPending && requestMutation.variables === client.clientUserId ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Resend reminder
                    </Button>
                  )}

                  {(client.status === "none" ||
                    client.status === "declined" ||
                    client.status === "revoked") && (
                    <Button
                      size="sm"
                      disabled={requestMutation.isPending && requestMutation.variables === client.clientUserId}
                      onClick={() => requestMutation.mutate(client.clientUserId)}
                    >
                      {requestMutation.isPending && requestMutation.variables === client.clientUserId ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Request access
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
