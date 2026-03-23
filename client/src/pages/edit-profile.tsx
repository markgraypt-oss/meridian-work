import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Camera, User, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { ImageCropper } from "@/components/ImageCropper";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  height: number | null;
  heightUnit: string | null;
  profileImageUrl: string | null;
}

export default function EditProfile() {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [height, setHeight] = useState("");
  const [heightUnit, setHeightUnit] = useState("cm");
  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ['/api/user/profile'],
  });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || "");
      setDateOfBirth(profile.dateOfBirth || "");
      setGender(profile.gender || "");
      setHeightUnit(profile.heightUnit || "cm");
      
      if (profile.height) {
        if (profile.heightUnit === "ft") {
          const totalInches = profile.height;
          setFeet(Math.floor(totalInches / 12).toString());
          setInches((totalInches % 12).toString());
        } else {
          setHeight(profile.height.toString());
        }
      }
    }
  }, [profile]);

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
      queryClient.invalidateQueries({ queryKey: ['/api/user/profile'] });
      setCropperOpen(false);
      setSelectedImage(null);
      toast({ title: "Profile picture updated" });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<UserProfile>) => {
      return apiRequest('PATCH', '/api/user/profile', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/profile'] });
      toast({ title: "Profile updated successfully" });
      setLocation('/profile');
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
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

  const handleSave = () => {
    let heightValue: number | null = null;
    
    if (heightUnit === "ft") {
      const feetNum = parseFloat(feet) || 0;
      const inchesNum = parseFloat(inches) || 0;
      heightValue = feetNum * 12 + inchesNum;
    } else {
      heightValue = parseFloat(height) || null;
    }

    updateProfileMutation.mutate({
      displayName: displayName || null,
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      height: heightValue,
      heightUnit,
    });
  };

  const isLoading = authLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-14 flex items-center px-4">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-6 w-32 ml-4" />
        </div>
        <div className="pt-14 mx-4 space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  const profileImageUrl = profile?.profileImageUrl || user?.profileImageUrl;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-14 flex items-center justify-between px-4">
        <button 
          onClick={() => setLocation('/profile')}
          className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">Edit Profile</h1>
        <button 
          onClick={handleSave}
          disabled={updateProfileMutation.isPending}
          className="p-2 -mr-2 text-primary hover:text-primary/80 disabled:opacity-50"
        >
          <Check className="h-5 w-5" />
        </button>
      </div>

      <div className="pt-16 mx-4 space-y-6">
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex flex-col items-center">
            <div className="relative">
              <div 
                className="h-24 w-24 rounded-full bg-muted border-4 border-border overflow-hidden cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {profileImageUrl ? (
                  <img 
                    src={profileImageUrl} 
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                    <User className="h-10 w-10 text-primary" />
                  </div>
                )}
              </div>
              <button
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary border-2 border-background flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
              >
                <Camera className="h-4 w-4 text-primary-foreground" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2">Tap to change photo</p>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={profile?.firstName && profile?.lastName ? `${profile.firstName} ${profile.lastName}` : ""}
              disabled
              className="bg-muted text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">Full name is set by your administrator</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Company</Label>
            <Input
              id="companyName"
              value={user?.companyName || ""}
              disabled
              className="bg-muted text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">Company is set by your administrator</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="bg-background w-48"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Height</Label>
            <div className="flex gap-2">
              <Select value={heightUnit} onValueChange={(val) => {
                setHeightUnit(val);
                setHeight("");
                setFeet("");
                setInches("");
              }}>
                <SelectTrigger className="w-24 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cm">cm</SelectItem>
                  <SelectItem value="ft">ft/in</SelectItem>
                </SelectContent>
              </Select>
              
              {heightUnit === "cm" ? (
                <Input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="Height in cm"
                  className="flex-1 bg-background"
                />
              ) : (
                <div className="flex-1 flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      type="number"
                      value={feet}
                      onChange={(e) => setFeet(e.target.value)}
                      placeholder="Feet"
                      className="bg-background pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">ft</span>
                  </div>
                  <div className="flex-1 relative">
                    <Input
                      type="number"
                      value={inches}
                      onChange={(e) => setInches(e.target.value)}
                      placeholder="Inches"
                      className="bg-background pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">in</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <Button 
          onClick={handleSave} 
          className="w-full"
          disabled={updateProfileMutation.isPending}
        >
          {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
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
