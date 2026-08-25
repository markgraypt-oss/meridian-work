import { useState } from "react";
import { Route, Switch, Link, Redirect, useLocation, useSearch } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  Building2,
  Users,
  Dumbbell,
  BookOpen,
  ChefHat,
  GraduationCap,
  BarChart3,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  LogOut,
  LayoutDashboard,
  Activity,
  Wind,
  Brain,
  Armchair,
  StretchHorizontal,
  Flower2,
  Wrench,
  MapPin,
  MessageSquareText,
  MessagesSquare,
  Flame,
  LineChart,
  Trophy,
  ClipboardCheck,
  Settings,
  UserCheck,
  HeartPulse,
} from "lucide-react";

import AdminPanel from "@/pages/admin";
import AdminUsers from "@/pages/admin-users";
import AdminCompanies from "@/pages/admin-companies";
import AdminReports from "@/pages/admin-reports";
import AdminWwi from "@/pages/admin-wwi";
import AdminEditPath from "@/pages/admin-edit-path";
import AdminOutcomeEditor from "@/pages/admin-outcome-editor";
import SelectExercise from "@/pages/admin/SelectExercise";
import CreateWorkout from "@/pages/admin/CreateWorkout";
import CreateStretchingRoutine from "@/pages/admin/CreateStretchingRoutine";
import CreateCorrectiveRoutine from "@/pages/admin/CreateCorrectiveRoutine";
import CreateYogaWorkout from "@/pages/admin/CreateYogaWorkout";
import AddProgramme from "@/pages/admin/AddProgramme";
import EditProgramme from "@/pages/admin/EditProgramme";
import AdminWorkdayPositions from "@/pages/admin/AdminWorkdayPositions";
import AdminWorkdayMicroResets from "@/pages/admin/AdminWorkdayMicroResets";
import AdminWorkdayAchesFixes from "@/pages/admin/AdminWorkdayAchesFixes";
import AdminAiCoaching from "@/pages/admin/AdminAiCoaching";
import AdminAiActivity from "@/pages/admin/AdminAiActivity";
import AdminDeskReferences from "@/pages/admin/AdminDeskReferences";
import AdminBurnoutCalibration from "@/pages/admin/AdminBurnoutCalibration";
import AdminEngagement from "@/pages/admin/AdminEngagement";
import AdminRewards from "@/pages/admin/AdminRewards";
import AdminWeeklyCheckinPreview from "@/pages/admin/AdminWeeklyCheckinPreview";
import AdminSettings from "@/pages/admin-settings";
import AdminClients from "@/pages/admin-clients";
import AdminCommunity from "@/pages/admin/AdminCommunity";
import ClientProfile from "@/pages/admin/ClientProfile";
import NotFound from "@/pages/not-found";

type NavItem = {
  label: string;
  href: string;
  tab?: string;
  icon: React.ComponentType<{ className?: string }>;
  group?: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Companies", href: "/admin/companies", icon: Building2, group: "People" },
  { label: "Users", href: "/admin/users", icon: Users, group: "People" },
  { label: "Clients", href: "/admin/clients", icon: UserCheck, group: "People" },
  { label: "Exercises", href: "/admin?tab=exercises", tab: "exercises", icon: Dumbbell, group: "Content" },
  { label: "Programmes", href: "/admin?tab=programs", tab: "programs", icon: Activity, group: "Content" },
  { label: "Workouts", href: "/admin?tab=workouts", tab: "workouts", icon: Flame, group: "Content" },
  { label: "Recipes", href: "/admin?tab=recipes", tab: "recipes", icon: ChefHat, group: "Content" },
  { label: "Learning", href: "/admin?tab=learn", tab: "learn", icon: GraduationCap, group: "Content" },
  { label: "Body Map", href: "/admin?tab=body-map", tab: "body-map", icon: MapPin, group: "Content" },
  { label: "Stretching", href: "/admin?tab=stretching", tab: "stretching", icon: StretchHorizontal, group: "Content" },
  { label: "Yoga", href: "/admin?tab=yoga", tab: "yoga", icon: Flower2, group: "Content" },
  { label: "Corrective", href: "/admin?tab=corrective", tab: "corrective", icon: Wrench, group: "Content" },
  { label: "Breathwork", href: "/admin?tab=breathwork", tab: "breathwork", icon: Wind, group: "Wellbeing" },
  { label: "Mindfulness", href: "/admin?tab=mindfulness", tab: "mindfulness", icon: Brain, group: "Wellbeing" },
  { label: "Meditations", href: "/admin?tab=meditations", tab: "meditations", icon: Sparkles, group: "Wellbeing" },
  { label: "Desk Health", href: "/admin?tab=desk-health", tab: "desk-health", icon: Armchair, group: "Wellbeing" },
  { label: "Community", href: "/admin/community", icon: MessagesSquare, group: "Community" },
  { label: "Reporting", href: "/admin/reports", icon: BarChart3, group: "Analytics" },
  { label: "Wellbeing Index", href: "/admin/wwi", icon: HeartPulse, group: "Analytics" },
  { label: "Engagement", href: "/admin/engagement", icon: LineChart, group: "Analytics" },
  { label: "Rewards", href: "/admin/rewards", icon: Trophy, group: "Analytics" },
  { label: "AI Activity", href: "/admin/ai-activity", icon: ClipboardCheck, group: "Analytics" },
  { label: "AI Coaching", href: "/admin/ai-coaching", icon: MessageSquareText, group: "Config" },
  { label: "AI Prompts", href: "/admin?tab=ai-prompts", tab: "ai-prompts", icon: BookOpen, group: "Config" },
  { label: "Burnout Calibration", href: "/admin/burnout-calibration", icon: Flame, group: "Config" },
  { label: "Settings", href: "/admin/settings", icon: Settings, group: "Config" },
];

function SidebarNav({ collapsed }: { collapsed: boolean }) {
  const [location] = useLocation();
  const search = useSearch();
  const currentTab = new URLSearchParams(search).get("tab");

  const isActive = (item: NavItem) => {
    if (item.tab) {
      return location === "/admin" && currentTab === item.tab;
    }
    if (item.href === "/admin") {
      return location === "/admin" && !currentTab;
    }
    return location === item.href || location.startsWith(item.href + "/");
  };

  const groups: Array<string | undefined> = [];
  for (const item of NAV_ITEMS) {
    if (!groups.includes(item.group)) groups.push(item.group);
  }

  return (
    <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
      {groups.map((group) => (
        <div key={group ?? "root"}>
          {group && !collapsed && (
            <p className="px-2 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group}
            </p>
          )}
          {group && collapsed && <div className="pt-3" />}
          {NAV_ITEMS.filter((i) => i.group === group).map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  collapsed && "justify-center px-0"
                )}
                title={collapsed ? item.label : undefined}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export default function AdminShell() {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col flex-shrink-0 bg-card border-r border-border transition-all duration-200",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 py-4 border-b border-border min-h-[56px]">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground leading-tight">Meridian</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Admin Portal</p>
            </div>
          )}
        </div>

        <SidebarNav collapsed={collapsed} />

        {/* Footer */}
        <div className="border-t border-border p-2 space-y-1">
          {!collapsed && user?.email && (
            <p className="px-2 py-1 text-[11px] text-muted-foreground truncate">{user.email}</p>
          )}
          <a
            href="/api/logout"
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
              collapsed && "justify-center px-0"
            )}
            data-testid="link-sign-out"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </a>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
              collapsed && "justify-center px-0"
            )}
            data-testid="button-collapse-sidebar"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Switch>
          <Route path="/" component={() => <Redirect to="/admin" />} />
          <Route path="/admin/edit-path/:id" component={AdminEditPath} />
          <Route path="/admin/programmes/new" component={AddProgramme} />
          <Route path="/admin/programmes/:id" component={EditProgramme} />
          <Route path="/admin/select-exercise" component={SelectExercise} />
          <Route path="/admin/create-workout" component={CreateWorkout} />
          <Route path="/admin/workouts/create" component={CreateWorkout} />
          <Route path="/admin/stretching/create" component={CreateStretchingRoutine} />
          <Route path="/admin/corrective/create" component={CreateCorrectiveRoutine} />
          <Route path="/admin/yoga/create" component={CreateYogaWorkout} />
          <Route path="/admin/workday/positions" component={AdminWorkdayPositions} />
          <Route path="/admin/workday/micro-resets" component={AdminWorkdayMicroResets} />
          <Route path="/admin/workday/aches-fixes" component={AdminWorkdayAchesFixes} />
          <Route path="/admin/workday/desk-references" component={AdminDeskReferences} />
          <Route path="/admin/ai-coaching" component={AdminAiCoaching} />
          <Route path="/admin/ai-activity" component={AdminAiActivity} />
          <Route path="/admin/burnout-calibration" component={AdminBurnoutCalibration} />
          <Route path="/admin/engagement" component={AdminEngagement} />
          <Route path="/admin/rewards" component={AdminRewards} />
          <Route path="/admin/weekly-checkin-preview" component={AdminWeeklyCheckinPreview} />
          <Route path="/admin/settings" component={AdminSettings} />
          <Route path="/admin/outcome-editor/:id" component={AdminOutcomeEditor} />
          <Route path="/admin/users" component={AdminUsers} />
          <Route path="/admin/clients/:userId" component={ClientProfile} />
          <Route path="/admin/clients" component={AdminClients} />
          <Route path="/admin/companies" component={AdminCompanies} />
          <Route path="/admin/community" component={AdminCommunity} />
          <Route path="/admin/reports" component={AdminReports} />
          <Route path="/admin/wwi" component={AdminWwi} />
          <Route path="/admin" component={AdminPanel} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}
