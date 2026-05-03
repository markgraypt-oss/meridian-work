import { useState } from "react";
import { useLocation } from "wouter";
import { Bell, Check, Settings } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

interface NotificationData {
  url?: string;
  [key: string]: unknown;
}

interface NotificationItem {
  id: number;
  category: string;
  title: string;
  body: string;
  data: NotificationData | null;
  readAt: string | null;
  createdAt: string;
}

const CATEGORY_BADGE: Record<string, string> = {
  training: "bg-blue-500/15 text-blue-400",
  recovery: "bg-purple-500/15 text-purple-400",
  nutrition: "bg-green-500/15 text-green-400",
  coach: "bg-cyan-500/15 text-cyan-400",
  admin: "bg-amber-500/15 text-amber-400",
};

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 60_000,
  });

  const { data: items = [], isLoading } = useQuery<NotificationItem[]>({
    queryKey: ["/api/notifications"],
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: async (id: number) => apiRequest("POST", `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAll = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/notifications/read-all`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const unread = countData?.count ?? 0;

  const onItemClick = (n: NotificationItem) => {
    if (!n.readAt) markRead.mutate(n.id);
    const url = n.data?.url;
    if (url) {
      setOpen(false);
      navigate(url);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-foreground hover:bg-muted"
          data-testid="button-notifications-bell"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center"
              data-testid="badge-unread-count"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-base">Notifications</SheetTitle>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                data-testid="button-mark-all-read"
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setOpen(false);
                navigate("/profile/notifications");
              }}
              data-testid="button-notification-settings"
              aria-label="Notification settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              You're all caught up.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`px-4 py-3 cursor-pointer hover:bg-muted/50 ${!n.readAt ? "bg-muted/20" : ""}`}
                  onClick={() => onItemClick(n)}
                  data-testid={`notification-item-${n.id}`}
                >
                  <div className="flex items-start gap-3">
                    {!n.readAt && <span className="mt-2 h-2 w-2 rounded-full bg-cyan-400 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${CATEGORY_BADGE[n.category] || "bg-muted text-muted-foreground"}`}>
                          {n.category}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-foreground truncate">{n.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
