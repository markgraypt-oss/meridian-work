import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mountain, ArrowLeft, CheckCircle, AlertCircle, Loader2, Eye, EyeOff, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const token = params.get("token");
  const isInvite = params.get("invite") === "true";
  
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const passwordRequirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };
  
  const isPasswordStrong = Object.values(passwordRequirements).every(Boolean);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsVerifying(false);
      setTokenError("No reset token provided");
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await fetch(`/api/verify-reset-token?token=${token}`);
        const data = await response.json();
        
        if (data.valid) {
          setIsValidToken(true);
        } else {
          setTokenError(data.message || "Invalid reset link");
        }
      } catch (error) {
        setTokenError("Failed to verify reset link");
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordStrong) {
      toast({
        title: "Password not strong enough",
        description: "Please meet all password requirements",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, isInvite }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.message || "Failed to reset password",
          variant: "destructive",
        });
        return;
      }

      if (data.autoLogin) {
        toast({
          title: "Welcome!",
          description: "Your account is ready. Taking you to your dashboard...",
        });
        window.location.href = "/";
      } else {
        setIsSuccess(true);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm border-border/50">
          <CardContent className="pt-8 pb-8 px-6">
            <div className="flex flex-col items-center text-center">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground">{isInvite ? "Verifying your invite..." : "Verifying reset link..."}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm border-border/50">
          <CardContent className="pt-8 pb-8 px-6">
            <div className="flex flex-col items-center text-center">
              <AlertCircle className="h-16 w-16 text-destructive mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">{isInvite ? "Invalid Invite Link" : "Invalid Reset Link"}</h2>
              <p className="text-muted-foreground text-sm mb-6">{tokenError}</p>
              {!isInvite && (
                <Link href="/forgot-password">
                  <Button className="w-full">Request New Reset Link</Button>
                </Link>
              )}
              {isInvite && (
                <p className="text-muted-foreground text-sm">Please contact your administrator for a new invite.</p>
              )}
              <Link href="/landing" className="mt-4 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3 inline mr-1" />
                Back to Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm border-border/50">
          <CardContent className="pt-8 pb-8 px-6">
            <div className="flex flex-col items-center text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">{isInvite ? "Account Ready!" : "Password Reset"}</h2>
              <p className="text-muted-foreground text-sm mb-6">
                {isInvite 
                  ? "Your account has been set up successfully. You can now sign in with your password."
                  : "Your password has been successfully reset. You can now sign in with your new password."}
              </p>
              <Link href="/landing">
                <Button className="w-full">Sign In</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm border-border/50">
        <CardContent className="pt-8 pb-8 px-6">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="flex items-center mb-2">
              <Mountain className="h-10 w-10 text-primary mr-3" />
              <span className="font-bold text-2xl text-foreground">MeridianWork</span>
            </div>
            <h2 className="text-lg font-medium text-foreground mt-4">
              {isInvite ? "Create Your Password" : "Set New Password"}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {isInvite ? "Choose a secure password to access your account" : "Enter your new password below"}
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              {password && (
                <div className="mt-2 space-y-1 text-xs">
                  <div className={`flex items-center gap-1.5 ${passwordRequirements.minLength ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {passwordRequirements.minLength ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    At least 8 characters
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordRequirements.hasUppercase ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {passwordRequirements.hasUppercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    One uppercase letter
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordRequirements.hasLowercase ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {passwordRequirements.hasLowercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    One lowercase letter
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordRequirements.hasNumber ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {passwordRequirements.hasNumber ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    One number
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordRequirements.hasSpecial ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {passwordRequirements.hasSpecial ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    One special character (!@#$%^&*...)
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            
            <Button 
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading}
            >
              {isLoading 
                ? (isInvite ? "Setting up..." : "Resetting...") 
                : (isInvite ? "Create Account" : "Reset Password")}
            </Button>
          </form>
          
          {!isInvite && (
            <div className="mt-4 text-center">
              <Link href="/landing" className="text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3 inline mr-1" />
                Back to Sign In
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
