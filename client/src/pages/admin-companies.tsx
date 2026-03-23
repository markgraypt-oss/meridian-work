import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Building2, Users, Search, ExternalLink, Phone, Mail, Calendar, Shield, Upload, BarChart3, Heart, AlertTriangle, FolderTree, Send, TrendingUp, TrendingDown, Minus, Activity, Brain, Zap } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type CompanyData = {
  id: number;
  name: string;
  industry: string | null;
  planRate: string | null;
  primaryContactEmail: string | null;
  primaryContactName: string | null;
  joinDate: string | null;
  desiredReportingDate: string | null;
  notes: string | null;
  status: string;
  maxUsers: number | null;
  userCount: number;
  activeUserCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  renewalDate: string | null;
  billingCycle: string | null;
  accountManagerName: string | null;
  accountManagerEmail: string | null;
  logoUrl: string | null;
  reportingCadence: string | null;
  lastReportSentAt: string | null;
  engagementAlertThreshold: number | null;
};

type EngagementData = {
  totalUsers: number;
  activeUsers: number;
  activeUserPercent: number;
  avgCheckInsPerWeek: number;
  programEnrollmentRate: number;
};

type WellnessData = {
  avgBurnoutScore: number | null;
  topPainAreas: { area: string; count: number; avgSeverity: number }[];
  trendDirection: string | null;
  avgMood: number | null;
  avgEnergy: number | null;
  avgStress: number | null;
};

type DepartmentData = {
  id: number;
  companyId: number;
  name: string;
  createdAt: string | null;
};

type InviteData = {
  id: number;
  companyId: number;
  email: string;
  status: string;
  invitedAt: string | null;
  acceptedAt: string | null;
};

type AlertData = {
  id: number;
  companyId: number;
  type: string;
  message: string | null;
  isRead: boolean;
  createdAt: string | null;
};

type CompanyDetailData = CompanyData & {
  benefits: BenefitData[];
  users: CompanyUserData[];
};

type BenefitData = {
  id: number;
  companyId: number;
  title: string;
  description: string | null;
  category: string;
  link: string | null;
  contactInfo: string | null;
  createdAt: string | null;
};

type CompanyUserData = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean | null;
  createdAt: string | null;
};

const BENEFIT_CATEGORIES = [
  "Physiotherapy",
  "Therapy/Counselling",
  "EAP",
  "Mental Health",
  "Fitness",
  "Nutrition",
  "Other",
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  try {
    return format(new Date(dateStr), "dd MMM yyyy");
  } catch {
    return "N/A";
  }
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    "Physiotherapy": "bg-blue-500/20 text-blue-400 border-blue-500/30",
    "Therapy/Counselling": "bg-purple-500/20 text-purple-400 border-purple-500/30",
    "EAP": "bg-[#0cc9a9]/20 text-[#0cc9a9] border-[#0cc9a9]/30",
    "Mental Health": "bg-green-500/20 text-green-400 border-green-500/30",
    "Fitness": "bg-orange-500/20 text-orange-400 border-orange-500/30",
    "Nutrition": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    "Other": "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  return colors[category] || colors["Other"];
}

export default function AdminCompanies() {
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyData | null>(null);
  const [deleteCompanyId, setDeleteCompanyId] = useState<number | null>(null);

  const [showBenefitForm, setShowBenefitForm] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState<BenefitData | null>(null);
  const [deleteBenefitId, setDeleteBenefitId] = useState<number | null>(null);

  const [showAssignUser, setShowAssignUser] = useState(false);
  const [assignUserSearch, setAssignUserSearch] = useState("");
  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const [bulkInviteEmails, setBulkInviteEmails] = useState("");
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [editingDept, setEditingDept] = useState<DepartmentData | null>(null);

  const [companyForm, setCompanyForm] = useState({
    name: "",
    industry: "",
    planRate: "",
    primaryContactEmail: "",
    primaryContactName: "",
    joinDate: "",
    desiredReportingDate: "",
    maxUsers: "",
    notes: "",
    status: "active",
    contractStartDate: "",
    contractEndDate: "",
    renewalDate: "",
    billingCycle: "",
    accountManagerName: "",
    accountManagerEmail: "",
    reportingCadence: "",
  });

  const [benefitForm, setBenefitForm] = useState({
    title: "",
    category: "",
    description: "",
    link: "",
    contactInfo: "",
  });

  const { data: companies = [], isLoading: companiesLoading } = useQuery<CompanyData[]>({
    queryKey: ["/api/admin/companies", searchQuery ? `?search=${searchQuery}` : ""],
    queryFn: async () => {
      const url = searchQuery
        ? `/api/admin/companies?search=${encodeURIComponent(searchQuery)}`
        : "/api/admin/companies";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch companies");
      return res.json();
    },
    enabled: !!user,
  });

  const { data: companyDetail, isLoading: detailLoading } = useQuery<CompanyDetailData>({
    queryKey: ["/api/admin/companies", selectedCompanyId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/companies/${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch company details");
      return res.json();
    },
    enabled: !!user && !!selectedCompanyId,
  });

  const { data: allUsers = [] } = useQuery<CompanyUserData[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user && showAssignUser,
  });

  const { data: engagement } = useQuery<EngagementData>({
    queryKey: ["/api/admin/companies", selectedCompanyId, "engagement"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/companies/${selectedCompanyId}/engagement`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch engagement");
      return res.json();
    },
    enabled: !!user && !!selectedCompanyId,
  });

  const { data: wellness } = useQuery<WellnessData>({
    queryKey: ["/api/admin/companies", selectedCompanyId, "wellness"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/companies/${selectedCompanyId}/wellness`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch wellness");
      return res.json();
    },
    enabled: !!user && !!selectedCompanyId,
  });

  const { data: companyDepartments = [] } = useQuery<DepartmentData[]>({
    queryKey: ["/api/admin/companies", selectedCompanyId, "departments"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/companies/${selectedCompanyId}/departments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch departments");
      return res.json();
    },
    enabled: !!user && !!selectedCompanyId,
  });

  const { data: invites = [] } = useQuery<InviteData[]>({
    queryKey: ["/api/admin/companies", selectedCompanyId, "invites"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/companies/${selectedCompanyId}/invites`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch invites");
      return res.json();
    },
    enabled: !!user && !!selectedCompanyId,
  });

  const { data: companyAlerts = [] } = useQuery<AlertData[]>({
    queryKey: ["/api/admin/companies", selectedCompanyId, "alerts"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/companies/${selectedCompanyId}/alerts`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return res.json();
    },
    enabled: !!user && !!selectedCompanyId,
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("POST", "/api/admin/companies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      setShowCompanyForm(false);
      resetCompanyForm();
      toast({ title: "Company created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create company", description: error.message, variant: "destructive" });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      return apiRequest("PATCH", `/api/admin/companies/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      setShowCompanyForm(false);
      setEditingCompany(null);
      resetCompanyForm();
      toast({ title: "Company updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update company", description: error.message, variant: "destructive" });
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      setDeleteCompanyId(null);
      if (selectedCompanyId) {
        setSelectedCompanyId(null);
      }
      toast({ title: "Company deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete company", description: error.message, variant: "destructive" });
    },
  });

  const createBenefitMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("POST", `/api/admin/companies/${selectedCompanyId}/benefits`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies", selectedCompanyId] });
      setShowBenefitForm(false);
      resetBenefitForm();
      toast({ title: "Benefit created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create benefit", description: error.message, variant: "destructive" });
    },
  });

  const updateBenefitMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      return apiRequest("PATCH", `/api/admin/company-benefits/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies", selectedCompanyId] });
      setShowBenefitForm(false);
      setEditingBenefit(null);
      resetBenefitForm();
      toast({ title: "Benefit updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update benefit", description: error.message, variant: "destructive" });
    },
  });

  const deleteBenefitMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/company-benefits/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies", selectedCompanyId] });
      setDeleteBenefitId(null);
      toast({ title: "Benefit deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete benefit", description: error.message, variant: "destructive" });
    },
  });

  const assignUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", `/api/admin/companies/${selectedCompanyId}/assign-user`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies", selectedCompanyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User assigned successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to assign user", description: error.message, variant: "destructive" });
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", `/api/admin/companies/${selectedCompanyId}/remove-user`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies", selectedCompanyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove user", description: error.message, variant: "destructive" });
    },
  });

  const bulkInviteMutation = useMutation({
    mutationFn: async (emails: string[]) => {
      return apiRequest("POST", `/api/admin/companies/${selectedCompanyId}/bulk-invite`, { emails });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies", selectedCompanyId, "invites"] });
      setShowBulkInvite(false);
      setBulkInviteEmails("");
      toast({ title: "Invitations sent successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to send invitations", description: error.message, variant: "destructive" });
    },
  });

  const createDeptMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", `/api/admin/companies/${selectedCompanyId}/departments`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies", selectedCompanyId, "departments"] });
      setShowDeptForm(false);
      setDeptName("");
      toast({ title: "Department created" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create department", description: error.message, variant: "destructive" });
    },
  });

  const updateDeptMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      return apiRequest("PATCH", `/api/admin/departments/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies", selectedCompanyId, "departments"] });
      setEditingDept(null);
      setDeptName("");
      setShowDeptForm(false);
      toast({ title: "Department updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update department", description: error.message, variant: "destructive" });
    },
  });

  const deleteDeptMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/departments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies", selectedCompanyId, "departments"] });
      toast({ title: "Department deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete department", description: error.message, variant: "destructive" });
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch(`/api/admin/companies/${selectedCompanyId}/logo`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies", selectedCompanyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({ title: "Logo uploaded successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to upload logo", description: error.message, variant: "destructive" });
    },
  });

  const resetCompanyForm = () => {
    setCompanyForm({
      name: "",
      industry: "",
      planRate: "",
      primaryContactEmail: "",
      primaryContactName: "",
      joinDate: "",
      desiredReportingDate: "",
      maxUsers: "",
      notes: "",
      status: "active",
      contractStartDate: "",
      contractEndDate: "",
      renewalDate: "",
      billingCycle: "",
      accountManagerName: "",
      accountManagerEmail: "",
      reportingCadence: "",
    });
  };

  const resetBenefitForm = () => {
    setBenefitForm({
      title: "",
      category: "",
      description: "",
      link: "",
      contactInfo: "",
    });
  };

  const openCreateCompany = () => {
    resetCompanyForm();
    setEditingCompany(null);
    setShowCompanyForm(true);
  };

  const openEditCompany = (company: CompanyData) => {
    setEditingCompany(company);
    setCompanyForm({
      name: company.name || "",
      industry: company.industry || "",
      planRate: company.planRate || "",
      primaryContactEmail: company.primaryContactEmail || "",
      primaryContactName: company.primaryContactName || "",
      joinDate: company.joinDate ? company.joinDate.split("T")[0] : "",
      desiredReportingDate: company.desiredReportingDate ? company.desiredReportingDate.split("T")[0] : "",
      maxUsers: company.maxUsers !== null ? String(company.maxUsers) : "",
      notes: company.notes || "",
      status: company.status || "active",
      contractStartDate: company.contractStartDate ? company.contractStartDate.split("T")[0] : "",
      contractEndDate: company.contractEndDate ? company.contractEndDate.split("T")[0] : "",
      renewalDate: company.renewalDate ? company.renewalDate.split("T")[0] : "",
      billingCycle: company.billingCycle || "",
      accountManagerName: company.accountManagerName || "",
      accountManagerEmail: company.accountManagerEmail || "",
      reportingCadence: company.reportingCadence || "",
    });
    setShowCompanyForm(true);
  };

  const openCreateBenefit = () => {
    resetBenefitForm();
    setEditingBenefit(null);
    setShowBenefitForm(true);
  };

  const openEditBenefit = (benefit: BenefitData) => {
    setEditingBenefit(benefit);
    setBenefitForm({
      title: benefit.title || "",
      category: benefit.category || "",
      description: benefit.description || "",
      link: benefit.link || "",
      contactInfo: benefit.contactInfo || "",
    });
    setShowBenefitForm(true);
  };

  const handleCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, unknown> = {
      name: companyForm.name,
      industry: companyForm.industry || null,
      planRate: companyForm.planRate || null,
      primaryContactEmail: companyForm.primaryContactEmail || null,
      primaryContactName: companyForm.primaryContactName || null,
      joinDate: companyForm.joinDate || null,
      desiredReportingDate: companyForm.desiredReportingDate || null,
      maxUsers: companyForm.maxUsers ? parseInt(companyForm.maxUsers) : null,
      notes: companyForm.notes || null,
      status: companyForm.status,
      contractStartDate: companyForm.contractStartDate || null,
      contractEndDate: companyForm.contractEndDate || null,
      renewalDate: companyForm.renewalDate || null,
      billingCycle: companyForm.billingCycle || null,
      accountManagerName: companyForm.accountManagerName || null,
      accountManagerEmail: companyForm.accountManagerEmail || null,
      reportingCadence: companyForm.reportingCadence || null,
    };
    if (editingCompany) {
      updateCompanyMutation.mutate({ id: editingCompany.id, data });
    } else {
      createCompanyMutation.mutate(data);
    }
  };

  const handleBenefitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, unknown> = {
      title: benefitForm.title,
      category: benefitForm.category,
      description: benefitForm.description || null,
      link: benefitForm.link || null,
      contactInfo: benefitForm.contactInfo || null,
    };
    if (editingBenefit) {
      updateBenefitMutation.mutate({ id: editingBenefit.id, data });
    } else {
      createBenefitMutation.mutate(data);
    }
  };

  const totalCompanies = companies.length;
  const activeCompanies = companies.filter((c) => c.status === "active").length;
  const inactiveCompanies = totalCompanies - activeCompanies;

  const filteredCompanies = companies;

  const assignedUserIds = new Set(companyDetail?.users?.map((u) => u.id) || []);
  const unassignedUsers = allUsers.filter((u) => !assignedUserIds.has(u.id));
  const filteredUnassigned = unassignedUsers.filter((u) => {
    if (!assignUserSearch) return true;
    const q = assignUserSearch.toLowerCase();
    const name = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
    const email = (u.email || "").toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  if (selectedCompanyId && companyDetail) {
    const unreadAlerts = companyAlerts.filter(a => !a.isRead);
    return (
      <div className="min-h-screen bg-background pb-20">
        <TopHeader onBack={() => setSelectedCompanyId(null)} />

        <div className="p-4 pt-14 space-y-4">
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="relative">
                  {companyDetail.logoUrl ? (
                    <img src={companyDetail.logoUrl} alt={companyDetail.name} className="h-16 w-16 rounded-xl object-cover border border-border" />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-[#0cc9a9]/10 flex items-center justify-center border border-border">
                      <Building2 className="h-8 w-8 text-[#0cc9a9]" />
                    </div>
                  )}
                  <label className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-card border border-border flex items-center justify-center cursor-pointer hover:bg-muted transition-colors">
                    <Upload className="h-3 w-3 text-muted-foreground" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadLogoMutation.mutate(file);
                    }} />
                  </label>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold text-foreground truncate">{companyDetail.name}</h2>
                    <Badge variant="outline" className={`shrink-0 text-xs ${
                      companyDetail.status === "active"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
                        : "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30"
                    }`}>
                      {companyDetail.status === "active" ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {companyDetail.industry && <p className="text-sm text-muted-foreground">{companyDetail.industry}</p>}
                  {companyDetail.planRate && <p className="text-xs text-muted-foreground mt-0.5">{companyDetail.planRate}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEditCompany(companyDetail)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {unreadAlerts.length > 0 && (
            <div className="bg-[#0cc9a9]/10 dark:bg-[#0cc9a9]/10 border border-[#0cc9a9]/30 dark:border-[#0cc9a9]/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-[#0cc9a9] dark:text-[#0cc9a9]" />
                <span className="text-sm font-medium text-[#0cc9a9] dark:text-[#0cc9a9]">{unreadAlerts.length} Alert{unreadAlerts.length > 1 ? "s" : ""}</span>
              </div>
              {unreadAlerts.slice(0, 3).map(a => (
                <p key={a.id} className="text-xs text-[#0cc9a9] dark:text-[#0cc9a9] ml-6">{a.message}</p>
              ))}
            </div>
          )}

          {engagement && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[#0cc9a9]" />
                  Engagement
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-background border border-border">
                    <p className="text-2xl font-bold text-[#0cc9a9]">{engagement.activeUserPercent}%</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-1">Active Users</p>
                    <p className="text-[10px] text-muted-foreground">{engagement.activeUsers}/{engagement.totalUsers}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background border border-border">
                    <p className="text-2xl font-bold text-foreground">{engagement.avgCheckInsPerWeek}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-1">Avg Check-ins</p>
                    <p className="text-[10px] text-muted-foreground">per week</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background border border-border">
                    <p className="text-2xl font-bold text-foreground">{engagement.programEnrollmentRate}%</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-1">Enrolled in</p>
                    <p className="text-[10px] text-muted-foreground">programmes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {wellness && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Heart className="h-4 w-4 text-rose-500" />
                  Wellness Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-background border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground">Burnout Score</span>
                      {wellness.trendDirection && (
                        <span className={`flex items-center text-xs ${
                          wellness.trendDirection === "rising" ? "text-red-500" :
                          wellness.trendDirection === "falling" ? "text-emerald-500" : "text-muted-foreground"
                        }`}>
                          {wellness.trendDirection === "rising" ? <TrendingUp className="h-3 w-3" /> :
                           wellness.trendDirection === "falling" ? <TrendingDown className="h-3 w-3" /> :
                           <Minus className="h-3 w-3" />}
                        </span>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-foreground">{wellness.avgBurnoutScore ?? "N/A"}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="p-2 rounded-lg bg-background border border-border text-center">
                      <Activity className="h-3 w-3 text-[#0cc9a9] mx-auto mb-0.5" />
                      <p className="text-sm font-bold text-foreground">{wellness.avgMood ?? "-"}</p>
                      <p className="text-[9px] text-muted-foreground">Mood</p>
                    </div>
                    <div className="p-2 rounded-lg bg-background border border-border text-center">
                      <Zap className="h-3 w-3 text-[#0cc9a9] mx-auto mb-0.5" />
                      <p className="text-sm font-bold text-foreground">{wellness.avgEnergy ?? "-"}</p>
                      <p className="text-[9px] text-muted-foreground">Energy</p>
                    </div>
                    <div className="p-2 rounded-lg bg-background border border-border text-center">
                      <Brain className="h-3 w-3 text-purple-500 mx-auto mb-0.5" />
                      <p className="text-sm font-bold text-foreground">{wellness.avgStress ?? "-"}</p>
                      <p className="text-[9px] text-muted-foreground">Stress</p>
                    </div>
                  </div>
                </div>
                {wellness.topPainAreas.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Top Pain Areas (30 days)</p>
                    <div className="flex flex-wrap gap-2">
                      {wellness.topPainAreas.map((p) => (
                        <Badge key={p.area} variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30">
                          {p.area} ({p.count}) - {p.avgSeverity}/10
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Max Users</p>
                  <p className="text-foreground">{companyDetail.maxUsers ?? "Unlimited"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Account Manager</p>
                  <p className="text-foreground">{companyDetail.accountManagerName || "Not assigned"}</p>
                  {companyDetail.accountManagerEmail && (
                    <p className="text-xs text-muted-foreground">{companyDetail.accountManagerEmail}</p>
                  )}
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-2">Contact</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-foreground">{companyDetail.primaryContactEmail || "No email"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-foreground">{companyDetail.primaryContactName || "No contact name"}</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-2">Contract</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Joined</p>
                      <p className="text-foreground">{formatDate(companyDetail.joinDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Contract Start</p>
                      <p className="text-foreground">{formatDate(companyDetail.contractStartDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Contract End</p>
                      <p className="text-foreground">{formatDate(companyDetail.contractEndDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Renewal</p>
                      <p className="text-foreground">{formatDate(companyDetail.renewalDate)}</p>
                    </div>
                  </div>
                </div>
                {companyDetail.billingCycle && (
                  <p className="text-xs text-muted-foreground mt-2">Billing: {companyDetail.billingCycle}</p>
                )}
              </div>
              {companyDetail.reportingCadence && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground">Reporting: {companyDetail.reportingCadence}</p>
                  {companyDetail.lastReportSentAt && (
                    <p className="text-xs text-muted-foreground">Last sent: {formatDate(companyDetail.lastReportSentAt)}</p>
                  )}
                </div>
              )}
              {companyDetail.notes && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{companyDetail.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FolderTree className="h-4 w-4 text-[#0cc9a9]" />
                Departments ({companyDepartments.length})
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => { setDeptName(""); setEditingDept(null); setShowDeptForm(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </CardHeader>
            <CardContent>
              {companyDepartments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No departments yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {companyDepartments.map((d) => (
                    <div key={d.id} className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-3 py-1.5">
                      <span className="text-sm text-foreground">{d.name}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setEditingDept(d); setDeptName(d.name); setShowDeptForm(true); }}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => deleteDeptMutation.mutate(d.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-[#0cc9a9]" />
                Users ({companyDetail.users?.length || 0})
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowBulkInvite(true)}>
                  <Send className="h-3.5 w-3.5 mr-1" />
                  Bulk Invite
                </Button>
                <Button size="sm" onClick={() => { setAssignUserSearch(""); setShowAssignUser(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {companyDetail.users?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No users assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {companyDetail.users?.map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {u.firstName || u.lastName
                              ? `${u.firstName || ""} ${u.lastName || ""}`.trim()
                              : u.email || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {u.isAdmin && (
                          <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30">Admin</Badge>
                        )}
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeUserMutation.mutate(u.id)} disabled={removeUserMutation.isPending}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {invites.filter(i => i.status === "pending").length > 0 && (
                <div className="mt-4 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">Pending Invites</p>
                  <div className="flex flex-wrap gap-2">
                    {invites.filter(i => i.status === "pending").map((inv) => (
                      <Badge key={inv.id} variant="outline" className="text-xs bg-[#0cc9a9]/10 text-[#0cc9a9] border-[#0cc9a9]/30 dark:bg-[#0cc9a9]/10 dark:text-[#0cc9a9] dark:border-[#0cc9a9]/30">
                        {inv.email}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#0cc9a9]" />
                Benefits ({companyDetail.benefits?.length || 0})
              </CardTitle>
              <Button size="sm" onClick={openCreateBenefit}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Benefit
              </Button>
            </CardHeader>
            <CardContent>
              {companyDetail.benefits?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No benefits added yet.</p>
              ) : (
                <div className="space-y-3">
                  {companyDetail.benefits?.map((b) => (
                    <div key={b.id} className="p-4 rounded-lg bg-background border border-border">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-foreground">{b.title}</h4>
                            <Badge variant="outline" className={`text-xs ${getCategoryColor(b.category)}`}>
                              {b.category}
                            </Badge>
                          </div>
                          {b.description && (
                            <p className="text-xs text-muted-foreground mb-2">{b.description}</p>
                          )}
                          <div className="flex flex-wrap gap-3">
                            {b.link && (
                              <a href={b.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#0cc9a9] hover:underline">
                                <ExternalLink className="h-3 w-3" />
                                Link
                              </a>
                            )}
                            {b.contactInfo && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {b.contactInfo}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditBenefit(b)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteBenefitId(b.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {renderCompanyDialog()}
        {renderBenefitDialog()}
        {renderDeleteBenefitDialog()}
        {renderAssignUserDialog()}
        {renderBulkInviteDialog()}
        {renderDeptDialog()}
      </div>
    );
  }

  if (selectedCompanyId && detailLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <TopHeader title="Loading..." onBack={() => setSelectedCompanyId(null)} />
        <div className="flex items-center justify-center pt-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0cc9a9]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader title="Company Management" onBack={() => navigate("/admin")} />

      <div className="p-4 pt-14">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-foreground">Companies ({totalCompanies})</h2>
          <Button onClick={openCreateCompany} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </Button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search companies by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card rounded-lg p-3 border border-border text-center">
            <p className="text-2xl font-bold text-foreground">{totalCompanies}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="bg-card rounded-lg p-3 border border-border text-center">
            <p className="text-2xl font-bold text-[#0cc9a9]">{activeCompanies}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className="bg-card rounded-lg p-3 border border-border text-center">
            <p className="text-2xl font-bold text-red-400">{inactiveCompanies}</p>
            <p className="text-xs text-muted-foreground">Inactive</p>
          </div>
        </div>

        {companiesLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0cc9a9]" />
          </div>
        ) : filteredCompanies.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              {searchQuery ? "No companies match your search." : "No companies found. Add your first company to get started."}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredCompanies.map((company) => (
              <Card
                key={company.id}
                className="cursor-pointer hover:border-[#0cc9a9]/50 transition-colors border-border"
                onClick={() => setSelectedCompanyId(company.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-[#0cc9a9]/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-[#0cc9a9]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground truncate">{company.name}</h3>
                          <Badge
                            variant="outline"
                            className={`shrink-0 text-xs ${
                              company.status === "active"
                                ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
                                : "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30"
                            }`}
                          >
                            {company.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        {company.industry && (
                          <p className="text-xs text-muted-foreground mb-1">{company.industry}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {company.planRate && (
                            <span className="bg-muted px-2 py-0.5 rounded">{company.planRate}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {company.activeUserCount}/{company.userCount} users
                          </span>
                          {company.joinDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(company.joinDate)}
                            </span>
                          )}
                        </div>
                        {company.primaryContactEmail && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {company.primaryContactEmail}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditCompany(company);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteCompanyId(company.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {renderCompanyDialog()}
      {renderDeleteCompanyDialog()}
    </div>
  );

  function renderCompanyDialog() {
    return (
      <Dialog open={showCompanyForm} onOpenChange={setShowCompanyForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCompany ? "Edit Company" : "Add Company"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCompanySubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Name *</Label>
              <Input
                id="companyName"
                value={companyForm.name}
                onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                required
                placeholder="Company name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={companyForm.industry}
                  onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
                  placeholder="e.g. Technology"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planRate">Plan / Rate</Label>
                <Input
                  id="planRate"
                  value={companyForm.planRate}
                  onChange={(e) => setCompanyForm({ ...companyForm, planRate: e.target.value })}
                  placeholder="e.g. Premium"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactName">Primary Contact Name</Label>
                <Input
                  id="contactName"
                  value={companyForm.primaryContactName}
                  onChange={(e) => setCompanyForm({ ...companyForm, primaryContactName: e.target.value })}
                  placeholder="Contact name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Primary Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={companyForm.primaryContactEmail}
                  onChange={(e) => setCompanyForm({ ...companyForm, primaryContactEmail: e.target.value })}
                  placeholder="email@company.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="joinDate">Join Date</Label>
                <Input
                  id="joinDate"
                  type="date"
                  value={companyForm.joinDate}
                  onChange={(e) => setCompanyForm({ ...companyForm, joinDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reportingDate">Desired Reporting Date</Label>
                <Input
                  id="reportingDate"
                  type="date"
                  value={companyForm.desiredReportingDate}
                  onChange={(e) => setCompanyForm({ ...companyForm, desiredReportingDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxUsers">Max Users</Label>
                <Input
                  id="maxUsers"
                  type="number"
                  value={companyForm.maxUsers}
                  onChange={(e) => setCompanyForm({ ...companyForm, maxUsers: e.target.value })}
                  placeholder="Unlimited"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={companyForm.status}
                  onValueChange={(val) => setCompanyForm({ ...companyForm, status: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contractStart">Contract Start</Label>
                <Input
                  id="contractStart"
                  type="date"
                  value={companyForm.contractStartDate}
                  onChange={(e) => setCompanyForm({ ...companyForm, contractStartDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contractEnd">Contract End</Label>
                <Input
                  id="contractEnd"
                  type="date"
                  value={companyForm.contractEndDate}
                  onChange={(e) => setCompanyForm({ ...companyForm, contractEndDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="renewalDate2">Renewal Date</Label>
                <Input
                  id="renewalDate2"
                  type="date"
                  value={companyForm.renewalDate}
                  onChange={(e) => setCompanyForm({ ...companyForm, renewalDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingCycle">Billing Cycle</Label>
                <Select
                  value={companyForm.billingCycle}
                  onValueChange={(val) => setCompanyForm({ ...companyForm, billingCycle: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountManager">Account Manager</Label>
                <Input
                  id="accountManager"
                  value={companyForm.accountManagerName}
                  onChange={(e) => setCompanyForm({ ...companyForm, accountManagerName: e.target.value })}
                  placeholder="Manager name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountManagerEmail">Manager Email</Label>
                <Input
                  id="accountManagerEmail"
                  type="email"
                  value={companyForm.accountManagerEmail}
                  onChange={(e) => setCompanyForm({ ...companyForm, accountManagerEmail: e.target.value })}
                  placeholder="manager@company.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportingCadence">Reporting Cadence</Label>
              <Select
                value={companyForm.reportingCadence}
                onValueChange={(val) => setCompanyForm({ ...companyForm, reportingCadence: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select cadence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={companyForm.notes}
                onChange={(e) => setCompanyForm({ ...companyForm, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCompanyForm(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createCompanyMutation.isPending || updateCompanyMutation.isPending}
              >
                {editingCompany ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  function renderDeleteCompanyDialog() {
    return (
      <AlertDialog open={!!deleteCompanyId} onOpenChange={() => setDeleteCompanyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this company? This action cannot be undone. All associated benefits will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCompanyId && deleteCompanyMutation.mutate(deleteCompanyId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCompanyMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  function renderBenefitDialog() {
    return (
      <Dialog open={showBenefitForm} onOpenChange={setShowBenefitForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBenefit ? "Edit Benefit" : "Add Benefit"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBenefitSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="benefitTitle">Title *</Label>
              <Input
                id="benefitTitle"
                value={benefitForm.title}
                onChange={(e) => setBenefitForm({ ...benefitForm, title: e.target.value })}
                required
                placeholder="Benefit title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="benefitCategory">Category *</Label>
              <Select
                value={benefitForm.category}
                onValueChange={(val) => setBenefitForm({ ...benefitForm, category: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {BENEFIT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="benefitDesc">Description</Label>
              <textarea
                id="benefitDesc"
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={benefitForm.description}
                onChange={(e) => setBenefitForm({ ...benefitForm, description: e.target.value })}
                placeholder="Describe this benefit..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benefitLink">Link</Label>
                <Input
                  id="benefitLink"
                  value={benefitForm.link}
                  onChange={(e) => setBenefitForm({ ...benefitForm, link: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="benefitContact">Contact Info</Label>
                <Input
                  id="benefitContact"
                  value={benefitForm.contactInfo}
                  onChange={(e) => setBenefitForm({ ...benefitForm, contactInfo: e.target.value })}
                  placeholder="Phone or email"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowBenefitForm(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createBenefitMutation.isPending || updateBenefitMutation.isPending || !benefitForm.category}
              >
                {editingBenefit ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  function renderDeleteBenefitDialog() {
    return (
      <AlertDialog open={!!deleteBenefitId} onOpenChange={() => setDeleteBenefitId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Benefit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this benefit? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteBenefitId && deleteBenefitMutation.mutate(deleteBenefitId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteBenefitMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  function renderAssignUserDialog() {
    return (
      <Dialog open={showAssignUser} onOpenChange={setShowAssignUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={assignUserSearch}
                onChange={(e) => setAssignUserSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {filteredUnassigned.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {assignUserSearch ? "No matching users found." : "No unassigned users available."}
                </p>
              ) : (
                filteredUnassigned.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-[#0cc9a9]/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {u.firstName || u.lastName
                          ? `${u.firstName || ""} ${u.lastName || ""}`.trim()
                          : u.email || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => assignUserMutation.mutate(u.id)}
                      disabled={assignUserMutation.isPending}
                    >
                      Assign
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  function renderBulkInviteDialog() {
    return (
      <Dialog open={showBulkInvite} onOpenChange={setShowBulkInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Invite Users</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter email addresses, one per line or separated by commas.</p>
            <textarea
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={bulkInviteEmails}
              onChange={(e) => setBulkInviteEmails(e.target.value)}
              placeholder={"user1@company.com\nuser2@company.com\nuser3@company.com"}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkInvite(false)}>Cancel</Button>
              <Button
                disabled={!bulkInviteEmails.trim() || bulkInviteMutation.isPending}
                onClick={() => {
                  const emails = bulkInviteEmails
                    .split(/[,\n]/)
                    .map(e => e.trim())
                    .filter(e => e && e.includes("@"));
                  if (emails.length > 0) bulkInviteMutation.mutate(emails);
                }}
              >
                {bulkInviteMutation.isPending ? "Sending..." : `Send ${bulkInviteEmails.split(/[,\n]/).filter(e => e.trim() && e.includes("@")).length} Invite(s)`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  function renderDeptDialog() {
    return (
      <Dialog open={showDeptForm} onOpenChange={setShowDeptForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDept ? "Edit Department" : "Add Department"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deptName">Department Name</Label>
              <Input
                id="deptName"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="e.g. Engineering, Marketing"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeptForm(false)}>Cancel</Button>
              <Button
                disabled={!deptName.trim() || createDeptMutation.isPending || updateDeptMutation.isPending}
                onClick={() => {
                  if (editingDept) {
                    updateDeptMutation.mutate({ id: editingDept.id, name: deptName.trim() });
                  } else {
                    createDeptMutation.mutate(deptName.trim());
                  }
                }}
              >
                {editingDept ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
}
