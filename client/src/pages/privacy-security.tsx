import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import TopHeader from "@/components/TopHeader";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  KeyRound, 
  Trash2, 
  Download, 
  LogOut,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Brain,
  Shield,
  EyeOff,
  MessageSquareLock,
  DatabaseZap
} from "lucide-react";

export default function PrivacySecurity() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showExportData, setShowExportData] = useState(false);
  const [showLogoutAll, setShowLogoutAll] = useState(false);
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return await apiRequest("POST", "/api/auth/change-password", data);
    },
    onSuccess: () => {
      toast({ title: "Password changed successfully" });
      setShowChangePassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to change password", 
        description: error.message || "Please check your current password",
        variant: "destructive" 
      });
    },
  });

  const exportDataMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/user/export-data", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to export data");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `paradigm-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({ title: "Data exported successfully" });
      setShowExportData(false);
    },
    onError: () => {
      toast({ title: "Failed to export data", variant: "destructive" });
    },
  });

  const logoutAllMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/logout-all", {});
    },
    onSuccess: () => {
      toast({ title: "Logged out of all devices" });
      window.location.href = "/";
    },
    onError: () => {
      toast({ title: "Failed to log out of all devices", variant: "destructive" });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/user/account", {});
    },
    onSuccess: () => {
      toast({ title: "Account deleted" });
      window.location.href = "/";
    },
    onError: () => {
      toast({ title: "Failed to delete account", variant: "destructive" });
    },
  });

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleDeleteAccount = () => {
    if (deleteConfirmText !== "DELETE") {
      toast({ title: "Please type DELETE to confirm", variant: "destructive" });
      return;
    }
    deleteAccountMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const menuItems = [
    {
      icon: KeyRound,
      label: "Change Password",
      description: "Update your account password",
      onClick: () => setShowChangePassword(true),
      testId: "btn-change-password",
    },
    {
      icon: Download,
      label: "Export My Data",
      description: "Download a copy of all your data",
      onClick: () => setShowExportData(true),
      testId: "btn-export-data",
    },
    {
      icon: LogOut,
      label: "Log Out of All Devices",
      description: "End all active sessions",
      onClick: () => setShowLogoutAll(true),
      testId: "btn-logout-all",
    },
    {
      icon: Trash2,
      label: "Delete My Account",
      description: "Permanently delete your account and data",
      onClick: () => setShowDeleteAccount(true),
      danger: true,
      testId: "btn-delete-account",
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopHeader title="Privacy & Security" onBack={() => navigate("/profile")} />

      <div className="p-4 pt-14 space-y-6">
        {/* AI & Data Transparency */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">
            <Brain className="inline h-4 w-4 mr-1" />
            AI & Data Transparency
          </h3>
          <Card className="p-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <MessageSquareLock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Conversations are private</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your AI Coach conversations are stored securely and only visible to you. Your employer cannot access them.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <DatabaseZap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Your data stays yours</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Health data, conversations, and feedback are stored in our encrypted database. Nothing is sold or shared with third parties, and your data is never used to train AI models.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <EyeOff className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Anonymous company reporting</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Company reports show only aggregate, anonymised trends. Individual data is never identifiable. Pain data requires severity 4+ and a minimum of 5 users.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">You're in control</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Delete individual AI conversations anytime. Export or permanently delete all your data from the options below. Full details in Help & Support.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Account Actions */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">Account</h3>
        <Card className="divide-y divide-border">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className="w-full px-4 py-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
              data-testid={item.testId}
            >
              <div className={`p-2 rounded-lg ${item.danger ? 'bg-red-500/10' : 'bg-primary/10'}`}>
                <item.icon className={`h-5 w-5 ${item.danger ? 'text-red-500' : 'text-primary'}`} />
              </div>
              <div className="flex-1 text-left">
                <p className={`font-medium ${item.danger ? 'text-red-500' : 'text-foreground'}`}>
                  {item.label}
                </p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          ))}
        </Card>
        </div>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangePassword(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleChangePassword}
              disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
            >
              {changePasswordMutation.isPending ? "Saving..." : "Change Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Data Dialog */}
      <Dialog open={showExportData} onOpenChange={setShowExportData}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export My Data</DialogTitle>
            <DialogDescription>
              Download a copy of all your data including workouts, progress, and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Your data will be exported as a JSON file. This may take a few moments.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportData(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => exportDataMutation.mutate()}
              disabled={exportDataMutation.isPending}
            >
              {exportDataMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download Data
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logout All Devices Dialog */}
      <Dialog open={showLogoutAll} onOpenChange={setShowLogoutAll}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Out of All Devices</DialogTitle>
            <DialogDescription>
              This will end all active sessions, including this one. You'll need to log in again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogoutAll(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => logoutAllMutation.mutate()}
              disabled={logoutAllMutation.isPending}
            >
              {logoutAllMutation.isPending ? "Logging out..." : "Log Out All Devices"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteAccount} onOpenChange={setShowDeleteAccount}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. All your data will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">
                You will lose all your workouts, progress, settings, and any other data associated with your account.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteAccount(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteAccountMutation.isPending || deleteConfirmText !== "DELETE"}
            >
              {deleteAccountMutation.isPending ? "Deleting..." : "Delete My Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
