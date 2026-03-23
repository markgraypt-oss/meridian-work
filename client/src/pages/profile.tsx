import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { User, ChevronRight, Shield, Camera, LogOut, Sparkles, RotateCcw, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { ImageCropper } from "@/components/ImageCropper";

interface Badge {
  id: number;
  name: string;
  description: string;
  category: string;
  tier: string;
  icon: string;
}

interface UserBadge {
  id: number;
  badgeId: number;
  earnedAt: string;
  badge: Badge;
}

const tierColors: Record<string, { bg: string; border: string }> = {
  platinum: { bg: "bg-cyan-500/20", border: "border-cyan-400" },
  gold: { bg: "bg-[#0cc9a9]/20", border: "border-[#0cc9a9]" },
  silver: { bg: "bg-slate-400/20", border: "border-slate-400" },
  bronze: { bg: "bg-[#0cc9a9]/20", border: "border-[#0cc9a9]" },
};

function BadgeHexagon({ badge, tier }: { badge: Badge; tier: string }) {
  const colors = tierColors[tier] || tierColors.bronze;
  
  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <polygon 
          points="50,3 93,25 93,75 50,97 7,75 7,25" 
          fill="transparent"
          stroke={tier === 'platinum' ? '#67e8f9' : tier === 'gold' ? '#0cc9a9' : tier === 'silver' ? '#94a3b8' : '#0cc9a9'}
          strokeWidth="4"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl">{badge.icon}</span>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);

  const { data: recentBadges } = useQuery<UserBadge[]>({
    queryKey: ['/api/user/badges', 'recent'],
    queryFn: async () => {
      const response = await fetch('/api/user/badges?limit=5', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch badges');
      return response.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (blob: Blob) => {
      const formData = new FormData();
      formData.append('profileImage', blob, 'profile.jpg');
      const response = await fetch('/api/user/profile-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to upload image');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setCropperOpen(false);
      setSelectedImage(null);
    },
  });

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
        setCropperOpen(true);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    uploadMutation.mutate(croppedBlob);
  };

  const handleCloseCropper = () => {
    setCropperOpen(false);
    setSelectedImage(null);
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-14 flex items-center px-4">
          <button onClick={() => navigate("/")} className="p-1 -ml-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground flex-1 text-center mr-6">Profile</h1>
        </div>
        <div className="pt-14 mt-4 mx-4">
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex flex-col items-center">
              <Skeleton className="h-24 w-24 rounded-full" />
              <Skeleton className="h-6 w-32 mt-4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const fullName = user?.displayName 
    || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : null)
    || "User";

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-14 flex items-center px-4">
        <button onClick={() => navigate("/")} className="p-1 -ml-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground flex-1 text-center mr-6">Profile</h1>
      </div>
      <div className="pt-14 mt-4 mx-4">
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex flex-col items-center">
            <div className="relative">
              <div 
                className="h-24 w-24 rounded-full bg-muted border-4 border-border overflow-hidden cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {user?.profileImageUrl ? (
                  <img 
                    src={user.profileImageUrl} 
                    alt={fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                    <User className="h-10 w-10 text-primary" />
                  </div>
                )}
              </div>
              <button
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-card border-2 border-border flex items-center justify-center shadow-md hover:bg-muted transition-colors"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
              >
                <Camera className="h-4 w-4 text-muted-foreground" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
            <h2 className="text-xl font-semibold text-foreground mt-4" data-testid="text-profile-name">
              {fullName}
            </h2>
            {user?.companyName && (
              <p className="text-sm text-muted-foreground mt-1">{user.companyName}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 mx-4">
        <Link href="/achievements">
          <div className="bg-card rounded-lg border border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-foreground font-medium">Recently Earned Badges</h3>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {recentBadges && recentBadges.length > 0 ? (
                recentBadges.map((userBadge) => (
                  <BadgeHexagon 
                    key={userBadge.id} 
                    badge={userBadge.badge} 
                    tier={userBadge.badge.tier} 
                  />
                ))
              ) : (
                <p className="text-muted-foreground text-sm py-2">No badges earned yet. Complete activities to earn badges!</p>
              )}
            </div>
          </div>
        </Link>
      </div>

      {user?.isAdmin && (
      <div className="mt-4 mx-4">
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <Link
            href="/admin"
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted transition-colors"
            data-testid="button-admin"
          >
            <div className="flex items-center space-x-3">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-foreground font-medium">Admin Panel</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-500" />
          </Link>
        </div>
      </div>
      )}

      <div className="mt-4 mx-4">
        <div className="bg-card rounded-lg border border-border overflow-hidden divide-y divide-border">
          <Link
            href="/profile/edit"
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted transition-colors"
            data-testid="button-edit-profile"
          >
            <span className="text-foreground">Edit Profile</span>
            <ChevronRight className="h-5 w-5 text-gray-500" />
          </Link>
          <Link
            href="/profile/integrations"
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted transition-colors"
            data-testid="button-integrations"
          >
            <span className="text-foreground">Integrations</span>
            <ChevronRight className="h-5 w-5 text-gray-500" />
          </Link>
          <Link
            href="/profile/notifications"
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted transition-colors"
            data-testid="button-notifications"
          >
            <span className="text-foreground">Notifications</span>
            <ChevronRight className="h-5 w-5 text-gray-500" />
          </Link>
          <Link
            href="/profile/preferences"
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted transition-colors"
            data-testid="button-preferences"
          >
            <span className="text-foreground">Preferences</span>
            <ChevronRight className="h-5 w-5 text-gray-500" />
          </Link>
        </div>
      </div>

      <div className="mt-4 mx-4">
        <div className="bg-card rounded-lg border border-border overflow-hidden divide-y divide-border">
          <Link
            to="/profile/privacy-security"
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted transition-colors"
            data-testid="button-privacy"
          >
            <span className="text-foreground">Privacy & Security</span>
            <ChevronRight className="h-5 w-5 text-gray-500" />
          </Link>
          <Link
            to="/profile/help-support"
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted transition-colors"
            data-testid="button-help"
          >
            <span className="text-foreground">Help & Support</span>
            <ChevronRight className="h-5 w-5 text-gray-500" />
          </Link>
          <button
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted transition-colors"
            data-testid="button-about"
          >
            <span className="text-foreground">About</span>
            <ChevronRight className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      </div>

      {user && (
        <div className="mt-4 mx-4">
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            {!user.onboardingCompleted ? (
              <Link
                href="/onboarding"
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="h-4 w-4 text-[#0cc9a9]" />
                  <span className="text-foreground">{user.onboardingStep && user.onboardingStep > 0 ? "Continue setup" : "Set up your profile"}</span>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-500" />
              </Link>
            ) : (
              <button
                onClick={async () => {
                  try {
                    await apiRequest("POST", "/api/onboarding/restart");
                    await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                    navigate("/onboarding");
                  } catch (e) {
                    console.error("Failed to restart onboarding", e);
                  }
                }}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">Redo profile setup</span>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-500" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mx-4">
        <Separator className="my-6" />

        <Button
          variant="outline"
          className="w-full flex items-center justify-center space-x-2 text-red-400 hover:text-red-300 hover:bg-muted border-red-700"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="h-5 w-5" />
          <span>Log Out</span>
        </Button>
      </div>

      {selectedImage && (
        <ImageCropper
          open={cropperOpen}
          onClose={handleCloseCropper}
          imageSrc={selectedImage}
          onCropComplete={handleCropComplete}
          isUploading={uploadMutation.isPending}
          aspectRatio={1}
          circularCrop={true}
        />
      )}
    </div>
  );
}
