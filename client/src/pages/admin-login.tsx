import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // If already signed in as an admin, jump straight to the panel.
  useEffect(() => {
    if (!authLoading && isAuthenticated && (user as any)?.isAdmin) {
      navigate("/admin");
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast({
          title: "Sign-in failed",
          description: data?.message || "Invalid email or password.",
          variant: "destructive",
        });
        return;
      }

      if (!data?.user?.isAdmin) {
        toast({
          title: "Not an admin account",
          description: "This sign-in is for admins only. Sign in to the main app instead.",
          variant: "destructive",
        });
        await fetch("/api/logout", { method: "POST", credentials: "include" }).catch(() => {});
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate("/admin");
      window.location.reload();
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.location.href = "/admin/login";
    }
  };

  // Authenticated but not an admin -> friendly bounce screen.
  const signedInButNotAdmin =
    !authLoading && isAuthenticated && !(user as any)?.isAdmin;

  return (
    <div className="min-h-screen w-full bg-[#0e1114] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-[#0cc9a9]/15 border border-[#0cc9a9]/30 flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-[#0cc9a9]" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Meridian Admin</h1>
          <p className="text-sm text-white/60 mt-1">Sign in to manage your platform</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur p-6">
          {signedInButNotAdmin ? (
            <div className="space-y-5 text-center">
              <p className="text-sm text-white/80">
                You are signed in as{" "}
                <span className="font-medium text-white">
                  {(user as any)?.email || "this account"}
                </span>
                , but it is not an admin account.
              </p>
              <p className="text-xs text-white/50">
                Sign out and use an admin email to access this site.
              </p>
              <Button
                onClick={handleSignOut}
                className="w-full bg-[#0cc9a9] hover:bg-[#0bb89a] text-black font-medium"
                size="lg"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/80">Email</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/80">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={submitting}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="w-full bg-[#0cc9a9] hover:bg-[#0bb89a] text-black font-medium"
              >
                {submitting ? "Signing in..." : "Sign in to admin"}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-white/40 mt-6">
          Looking for the wellness app?{" "}
          <a href="/" className="text-[#0cc9a9] hover:underline">Go to user sign-in</a>
        </p>
      </div>
    </div>
  );
}
