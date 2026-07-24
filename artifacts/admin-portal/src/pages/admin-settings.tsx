import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, User as UserIcon, ShieldCheck } from "lucide-react";

export default function AdminSettings() {
  const { user } = useAuth();

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground" data-testid="text-settings-title">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your admin account</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserIcon className="h-4 w-4" /> Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Name</p>
              <p className="text-foreground font-medium" data-testid="text-settings-name">
                {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="text-foreground font-medium" data-testid="text-settings-email">{user?.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Role</p>
              <p className="text-foreground font-medium flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                {user?.isAdmin ? "Administrator" : "Member"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Company</p>
              <p className="text-foreground font-medium">{user?.companyName ?? "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild data-testid="button-settings-sign-out">
            <a href="/api/logout">
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
