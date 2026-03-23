import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, User, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type UserData = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  isAdmin: boolean | null;
  createdAt: string | null;
  hasPassword?: boolean;
};

export default function AdminUsers() {
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteUserIsAdmin, setDeleteUserIsAdmin] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    companyName: "",
    isAdmin: false,
  });
  const [isNewCompany, setIsNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");

  const { data: users = [], isLoading: usersLoading } = useQuery<UserData[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user,
  });

  const { data: existingCompanies = [] } = useQuery<string[]>({
    queryKey: ["/api/admin/company-names"],
    enabled: !!user,
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/admin/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/company-names"] });
      setShowUserForm(false);
      resetForm();
      toast({ title: "Invite sent!", description: "They'll receive an email to set up their account." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to invite user", description: error.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      return apiRequest("PATCH", `/api/admin/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/company-names"] });
      setShowUserForm(false);
      setEditingUser(null);
      resetForm();
      toast({ title: "User updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update user", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async ({ id, isAdmin, password, confirmText }: { id: string; isAdmin: boolean; password?: string; confirmText?: string }) => {
      const body = isAdmin ? { password, confirmText } : undefined;
      return apiRequest("DELETE", `/api/admin/users/${id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setDeleteUserId(null);
      setDeleteUserIsAdmin(false);
      setDeleteConfirmText("");
      setDeletePassword("");
      toast({ title: "User deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete user", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ email: "", firstName: "", lastName: "", companyName: "", isAdmin: false });
    setIsNewCompany(false);
    setNewCompanyName("");
  };

  const openCreateForm = () => {
    resetForm();
    setEditingUser(null);
    setShowUserForm(true);
  };

  const openEditForm = (userData: UserData) => {
    setEditingUser(userData);
    const company = userData.companyName || "";
    const companyInList = existingCompanies.includes(company);
    setFormData({
      email: userData.email || "",
      firstName: userData.firstName || "",
      lastName: userData.lastName || "",
      companyName: company,
      isAdmin: userData.isAdmin || false,
    });
    if (company && !companyInList) {
      setIsNewCompany(true);
      setNewCompanyName(company);
    } else {
      setIsNewCompany(false);
      setNewCompanyName("");
    }
    setShowUserForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCompanyName = isNewCompany ? newCompanyName.trim() : formData.companyName;
    const submitData = { ...formData, companyName: finalCompanyName };
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data: submitData });
    } else {
      createUserMutation.mutate(submitData);
    }
  };
  
  // Filter users based on search query
  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
    const email = (u.email || '').toLowerCase();
    const company = (u.companyName || '').toLowerCase();
    return fullName.includes(query) || email.includes(query) || company.includes(query);
  });

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader title="User Management" onBack={() => navigate("/admin")} />
      
      <div className="p-4 pt-14">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-foreground">Users ({users.length})</h2>
          <Button onClick={openCreateForm} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </div>
        
        {/* Search bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {usersLoading ? (
          <p className="text-muted-foreground">Loading users...</p>
        ) : users.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No users found. Add your first user to get started.
            </CardContent>
          </Card>
        ) : filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No users match your search.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((u) => (
              <Card key={u.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {u.firstName || u.lastName ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : u.email}
                      </p>
                      <p className="text-sm text-muted-foreground">{u.email}</p>
                      <div className="flex items-center gap-2">
                        {u.companyName && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{u.companyName}</span>
                        )}
                        {u.isAdmin && (
                          <span className="text-xs text-primary font-medium">Admin</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditForm(u)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      setDeleteUserId(u.id);
                      setDeleteUserIsAdmin(u.isAdmin || false);
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showUserForm} onOpenChange={setShowUserForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Invite User"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={!!editingUser}
              />
              {!editingUser && (
                <p className="text-xs text-muted-foreground">
                  They'll receive an email to set up their password
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company</Label>
              {isNewCompany ? (
                <div className="flex gap-2">
                  <Input
                    id="newCompanyName"
                    placeholder="Enter new company name"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      setIsNewCompany(false);
                      setNewCompanyName("");
                      setFormData({ ...formData, companyName: "" });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Select
                  value={formData.companyName}
                  onValueChange={(val) => {
                    if (val === "__new__") {
                      setIsNewCompany(true);
                      setNewCompanyName("");
                    } else {
                      setFormData({ ...formData, companyName: val });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingCompanies.map((company) => (
                      <SelectItem key={company} value={company}>
                        {company}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__" className="text-primary font-medium">
                      + Create new company
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isAdmin">Admin Access</Label>
              <Switch
                id="isAdmin"
                checked={formData.isAdmin}
                onCheckedChange={(checked) => setFormData({ ...formData, isAdmin: checked })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowUserForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending || updateUserMutation.isPending}>
                {editingUser ? "Update" : "Send Invite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteUserId} onOpenChange={() => {
        setDeleteUserId(null);
        setDeleteUserIsAdmin(false);
        setDeleteConfirmText("");
        setDeletePassword("");
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteUserIsAdmin 
                ? "You are about to delete an ADMIN account. This requires extra verification."
                : "Are you sure you want to delete this user? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {deleteUserIsAdmin && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="deleteConfirm" className="text-sm font-medium">
                  Type <span className="font-bold text-destructive">DELETE NOW</span> to confirm
                </Label>
                <Input
                  id="deleteConfirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE NOW"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deletePassword" className="text-sm font-medium">
                  Enter your password
                </Label>
                <Input
                  id="deletePassword"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your password"
                />
              </div>
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserId && deleteUserMutation.mutate({
                id: deleteUserId,
                isAdmin: deleteUserIsAdmin,
                password: deletePassword,
                confirmText: deleteConfirmText,
              })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteUserIsAdmin && (deleteConfirmText !== "DELETE NOW" || !deletePassword)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
