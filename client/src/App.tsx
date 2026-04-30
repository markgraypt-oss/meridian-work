import { useState, useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import BadgeNotification from "@/components/BadgeNotification";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { UserPreferencesProvider } from "@/contexts/UserPreferencesContext";
import Onboarding from "@/pages/onboarding";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Dashboard from "@/pages/dashboard-executive";
import Training from "@/pages/training";
import TrainingMainProgramme from "@/pages/training-main-programme";
import TrainingLibrary from "@/pages/training-library";

import TrainingStretching from "@/pages/training-stretching";
import TrainingYoga from "@/pages/training-yoga";
import TrainingCorrectiveExercise from "@/pages/training-corrective-exercise";
import TrainingBodyMap from "@/pages/training-body-map";
import CreateUserProgramme from "@/pages/create-user-programme";
import Recovery from "@/pages/recovery";
import RecoveryBreathWork from "@/pages/recovery-breath-work";
import BreathTechniqueDetail from "@/pages/breath-technique-detail";
import BreathSession from "@/pages/breath-session";
import BreathSessionComplete from "@/pages/breath-session-complete";
import BreathRoutineBuilder from "@/pages/breath-routine-builder";
import BreathCategory from "@/pages/breath-category";
import RecoveryMindfulness from "@/pages/recovery-mindfulness";
import MeditationPlayer from "@/pages/meditation-player";
import MeditationList from "@/pages/meditation-list";
import RecoverySleep from "@/pages/recovery-sleep";
import RecoveryBurnout from "@/pages/recovery-burnout";
import BurnoutSigns from "@/pages/burnout-signs";
import BurnoutTalking from "@/pages/burnout-talking";
import RecoveryDeskHealth from "@/pages/recovery-desk-health";
import WorkdayPositions from "@/pages/workday-positions";
import WorkdayMicroResets from "@/pages/workday-micro-resets";
import WorkdayAchesFixes from "@/pages/workday-aches-fixes";
import WorkdaySetup from "@/pages/workday-setup";
import WorkdayRotation from "@/pages/workday-rotation";
import WorkdayDeskScan from "@/pages/workday-desk-scan";
import Learn from "@/pages/learn";
import LearnTopic from "@/pages/learn-topic";
import EducationLabPath from "@/pages/education-lab-path";
import EducationLabBookmarks from "@/pages/education-lab-bookmarks";
import LearnVideoDetail from "@/pages/learn-video-detail";
import LearnTopicVideoDetail from "@/pages/learn-topic-video-detail";
import Library from "@/pages/library";
import Nutrition from "@/pages/nutrition";
import NutritionGraphs from "@/pages/nutrition-graphs";
import MyMeals from "@/pages/my-meals";
import AddFood from "@/pages/add-food";
import SaveMeal from "@/pages/save-meal";
import EditSavedMeal from "@/pages/edit-saved-meal";
import MealPlanSettings from "@/pages/meal-plan-settings";
import SupplementStacks from "@/pages/supplement-stacks";
import SupplementDetail from "@/pages/supplement-detail";
import SupplementHistory from "@/pages/supplement-history";
import SupplementHistoryDetail from "@/pages/supplement-history-detail";
import Perform from "@/pages/perform";
import BodyMapSimple from "@/pages/body-map-simple";
import BodyMapUnified from "@/pages/body-map-unified";
import InjuryTracking from "@/pages/injury-tracking";
import Search from "@/pages/search";
import AdminPanel from "@/pages/admin";
import AdminEditPath from "@/pages/admin-edit-path";
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
import AdminWorkdayDeskSetups from "@/pages/admin/AdminWorkdayDeskSetups";
import AdminAiCoaching from "@/pages/admin/AdminAiCoaching";
import AdminBurnoutCalibration from "@/pages/admin/AdminBurnoutCalibration";
import AdminOutcomeEditor from "@/pages/admin-outcome-editor";
import AdminUsers from "@/pages/admin-users";
import AdminCompanies from "@/pages/admin-companies";
import AdminReports from "@/pages/admin-reports";
import Achievements from "@/pages/achievements";
import ProgrammeHub from "@/pages/program-hub";
import ProgrammeHistoryStats from "@/pages/programme-history-stats";
import WorkoutDetail from "@/pages/workout-detail";
import ExerciseDetail from "@/pages/exercise-detail";
import Calendar from "@/pages/calendar";
import Profile from "@/pages/profile";
import EditProfile from "@/pages/edit-profile";
import Integrations from "@/pages/integrations";
import Preferences from "@/pages/preferences";
import Notifications from "@/pages/notifications";
import PrivacySecurity from "@/pages/privacy-security";
import HelpSupport from "@/pages/help-support";
import Goals from "@/pages/goals";
import GoalsNutritionNew from "@/pages/goals-nutrition-new";
import GoalsNutritionEdit from "@/pages/goals-nutrition-edit";
import GoalsNew from "@/pages/goals-new";
import GoalsBodyweightEdit from "@/pages/goals-bodyweight-edit";
import GoalsCustomEdit from "@/pages/goals-custom-edit";
import GoalsHabits from "@/pages/goals-habits";
import GoalsHabitDetail from "@/pages/goals-habit-detail";
import Habits from "@/pages/habits";
import HabitSelection from "@/pages/habit-selection";
import HabitDetail from "@/pages/habit-detail";
import HabitCustom from "@/pages/habit-custom";
import HabitEdit from "@/pages/habit-edit";
import HabitProgress from "@/pages/habit-progress";
import HabitTracking from "@/pages/habit-tracking";
import TrainingProgrammes from "@/pages/training-programmes";
import TrainingWorkouts from "@/pages/training-workouts";
import TrainingWorkoutCategory from "@/pages/training-workout-category";
import TrainingProgrammeOverview from "@/pages/training-programme-overview";
import TrainingWorkoutDetail from "@/pages/training-workout-detail";
import ActiveWorkout from "@/pages/active-workout";
import SubstituteExercise from "@/pages/substitute-exercise";
import WorkoutNotes from "@/pages/workout-notes";
import ProgressMetricDetail from "@/pages/progress-metric-detail";
import ProgressPhotos from "@/pages/progress-photos";
import ProgressAddEntry from "@/pages/progress-add-entry";
import ProgressEntryDetail from "@/pages/progress-entry-detail";
import ProgressWorkouts from "@/pages/progress-workouts";
import ProgressExercisePRs from "@/pages/progress-exercise-prs";
import ProgressExercisePRDetail from "@/pages/progress-exercise-pr-detail";
import WorkoutLogView from "@/pages/workout-log-view";
import BuildWod from "@/pages/build-wod";
import ScheduleProgramme from "@/pages/schedule-programme";
import WodDetail from "@/pages/wod-detail";
import RecipeDetail from "@/pages/recipe-detail";
import Recipes from "@/pages/recipes";
import MealPlan from "@/pages/meal-plan";
import TopHeader from "@/components/TopHeader";
import BottomNavigation from "@/components/BottomNavigation";
import FloatingActionButton from "@/components/FloatingActionButton";
import QuickAddMenu from "@/components/QuickAddMenu";
import CoachChat from "@/components/CoachChat";
import { WorkoutSessionProvider } from "@/context/WorkoutSessionContext";

function Router() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const [coachOpen, setCoachOpen] = useState(false);
  const [showQuickAddMenu, setShowQuickAddMenu] = useState(false);

  // Allow other parts of the app (e.g. the post-workout summary page) to ask the coach to open
  useEffect(() => {
    const handler = () => setCoachOpen(true);
    window.addEventListener('open-coach', handler);
    return () => window.removeEventListener('open-coach', handler);
  }, []);
  
  const hideBottomNav = 
    location.startsWith('/training/workout/') ||
    location.startsWith('/programme-history/') ||
    location.startsWith('/workout-detail/') ||
    location.startsWith('/active-workout/') ||
    location.startsWith('/build-wod') ||
    location.startsWith('/wod/') ||
    location.startsWith('/exercise/') ||
    location.startsWith('/recipe/') ||
    location === '/onboarding' ||
    location.startsWith('/admin') ||
    location === '/landing' ||
    location === '/login' ||
    location === '/forgot-password' ||
    location === '/reset-password' ||
    location.startsWith('/breath-session/') ||
    location === '/profile' ||
    location.startsWith('/profile/') ||
    location === '/achievements' ||
    location === '/training/schedule-programme' ||
    location.startsWith('/habit-tracking/');

  const isFullscreenWorkout = location.startsWith('/active-workout/') ||
    location.startsWith('/build-wod') ||
    location.startsWith('/wod/');
  
  const hideTopHeader = location === '/profile' || location.startsWith('/profile/') || location.startsWith('/my-progress/') || location.startsWith('/progress/') || location === '/habit-selection' || location.startsWith('/habit-tracking/') || location.startsWith('/habit-progress/') || location.startsWith('/learn/path/') || location.startsWith('/nutrition/add-food') || location === '/nutrition/meal-plan-settings' || /^\/learn\/[^/]+\/video\//.test(location) || location.startsWith('/training/workout/') || location.startsWith('/workout-detail/') || location === '/achievements' || location === '/onboarding' || location === '/recovery' || location.startsWith('/recovery/') || location === '/perform' || location.startsWith('/admin/') || location.startsWith('/training/programme/') || location === '/training/main-programme' || location === '/training/schedule-programme' || location.startsWith('/recipe/') || location.startsWith('/program-hub/') || location === '/training/create-programme' || location.startsWith('/training/edit-programme/');

  // Use scroll restoration hook for site-wide back button scroll position memory
  useScrollRestoration();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {isAuthenticated && !isFullscreenWorkout && !hideTopHeader && <TopHeader />}
      <div className={isAuthenticated ? (isFullscreenWorkout || hideTopHeader ? "pb-20" : "pt-16 pb-20") : ""}>
        <Switch>
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="/landing" component={Landing} />
          <Route path="/login" component={Landing} />
          {!isAuthenticated ? (
            <>
              <Route path="/" component={Landing} />
              <Route>
                <Redirect to="/" />
              </Route>
            </>
          ) : (
            <>
              <Route path="/onboarding" component={Onboarding} />
              <Route path="/" component={Dashboard} />
              <Route path="/training" component={Training} />
              <Route path="/training/main-programme" component={TrainingMainProgramme} />
              <Route path="/training/programme-library" component={TrainingLibrary} />
              <Route path="/training/programmes/:section?" component={TrainingProgrammes} />
              <Route path="/training/workouts" component={TrainingWorkouts} />
              <Route path="/training/workouts/:routineType/:category" component={TrainingWorkoutCategory} />
              <Route path="/training/workouts/:routineType" component={TrainingWorkoutCategory} />
              <Route path="/training/programme/:id" component={TrainingProgrammeOverview} />
              <Route path="/training/workout/:id" component={TrainingWorkoutDetail} />

              <Route path="/training/stretching-mobility" component={TrainingStretching} />
              <Route path="/training/yoga" component={TrainingYoga} />
              <Route path="/training/corrective-exercise" component={TrainingCorrectiveExercise} />
              <Route path="/training/body-map" component={TrainingBodyMap} />
              <Route path="/training/schedule-programme" component={ScheduleProgramme} />
              <Route path="/training/create-programme" component={CreateUserProgramme} />
              <Route path="/training/edit-programme/:id" component={CreateUserProgramme} />
              <Route path="/recovery" component={Recovery} />
              <Route path="/recovery/breath-work" component={RecoveryBreathWork} />
              <Route path="/recovery/breath-work/builder" component={BreathRoutineBuilder} />
              <Route path="/recovery/breath-work/session/:slug" component={BreathSession} />
              <Route path="/recovery/breath-work/complete" component={BreathSessionComplete} />
              <Route path="/recovery/breath-work/category/:category" component={BreathCategory} />
              <Route path="/recovery/breath-work/:slug" component={BreathTechniqueDetail} />
              <Route path="/recovery/mindfulness" component={RecoveryMindfulness} />
              <Route path="/recovery/mindfulness/meditations/:category" component={MeditationList} />
              <Route path="/recovery/mindfulness/meditation/:id" component={MeditationPlayer} />
              <Route path="/recovery/sleep-support" component={RecoverySleep} />
              <Route path="/recovery/burnout-tracker" component={RecoveryBurnout} />
              <Route path="/recovery/burnout-signs" component={BurnoutSigns} />
              <Route path="/recovery/burnout-talking" component={BurnoutTalking} />
              <Route path="/recovery/desk-health" component={RecoveryDeskHealth} />
              <Route path="/recovery/desk-health/setup" component={WorkdaySetup} />
              <Route path="/recovery/desk-health/positions" component={WorkdayPositions} />
              <Route path="/recovery/desk-health/rotation" component={WorkdayRotation} />
              <Route path="/recovery/desk-health/micro-resets" component={WorkdayMicroResets} />
              <Route path="/recovery/desk-health/aches-fixes" component={WorkdayAchesFixes} />
              <Route path="/recovery/desk-health/scan" component={WorkdayDeskScan} />
              <Route path="/learn" component={Learn} />
              <Route path="/learn/path/:pathId/video/:contentId" component={LearnVideoDetail} />
              <Route path="/learn/:slug/video/:contentId" component={LearnTopicVideoDetail} />
              <Route path="/learn/:slug" component={LearnTopic} />
              <Route path="/education-lab/path/:id" component={EducationLabPath} />
              <Route path="/education-lab/bookmarks" component={EducationLabBookmarks} />
              <Route path="/education-lab" component={Learn} />
              <Route path="/programs">
                <Redirect to="/training/programme-library" />
              </Route>
              <Route path="/program-hub/:id" component={ProgrammeHub} />
              <Route path="/programme-history/:id" component={ProgrammeHistoryStats} />
              <Route path="/workout-detail/:enrollmentId/:week/:day" component={WorkoutDetail} />
              <Route path="/exercise/:id" component={ExerciseDetail} />
              <Route path="/library" component={Library} />
              <Route path="/perform" component={Perform} />
              <Route path="/nutrition" component={Nutrition} />
              <Route path="/nutrition/graphs" component={NutritionGraphs} />
              <Route path="/nutrition/my-meals" component={MyMeals} />
              <Route path="/nutrition/add-food" component={AddFood} />
              <Route path="/nutrition/save-meal" component={SaveMeal} />
              <Route path="/nutrition/edit-saved-meal/:id" component={EditSavedMeal} />
              <Route path="/nutrition/meal-plan-settings" component={MealPlanSettings} />
              <Route path="/supplement-stacks" component={SupplementStacks} />
              <Route path="/supplement-detail/:name" component={SupplementDetail} />
              <Route path="/supplement-history" component={SupplementHistory} />
              <Route path="/supplement-history/:id" component={SupplementHistoryDetail} />
              <Route path="/meal-plan" component={MealPlan} />
              <Route path="/recipes" component={Recipes} />
              <Route path="/recipe/:id" component={RecipeDetail} />
              <Route path="/calendar" component={Calendar} />
              <Route path="/body-map">
                <Redirect to="/training/body-map" />
              </Route>
              <Route path="/recovery/body-map">
                <Redirect to="/training/body-map" />
              </Route>
              <Route path="/body-map-simple" component={BodyMapSimple} />
              <Route path="/search" component={Search} />
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
              <Route path="/admin/workday/desk-setups" component={AdminWorkdayDeskSetups} />
              <Route path="/admin/ai-coaching" component={AdminAiCoaching} />
              <Route path="/admin/burnout-calibration" component={AdminBurnoutCalibration} />
              <Route path="/admin/outcome-editor/:id" component={AdminOutcomeEditor} />
              <Route path="/admin/users" component={AdminUsers} />
              <Route path="/admin/companies" component={AdminCompanies} />
              <Route path="/admin/reports" component={AdminReports} />
              <Route path="/admin" component={AdminPanel} />
              <Route path="/profile/edit" component={EditProfile} />
              <Route path="/profile/integrations" component={Integrations} />
              <Route path="/profile/preferences" component={Preferences} />
              <Route path="/profile/notifications" component={Notifications} />
              <Route path="/profile/privacy-security" component={PrivacySecurity} />
              <Route path="/profile/help-support" component={HelpSupport} />
              <Route path="/profile" component={Profile} />
              <Route path="/achievements" component={Achievements} />
              <Route path="/progress/workouts" component={ProgressWorkouts} />
              <Route path="/progress/exercise-prs" component={ProgressExercisePRs} />
              <Route path="/progress/exercise-pr/:id" component={ProgressExercisePRDetail} />
              <Route path="/progress/workout/:logId" component={WorkoutLogView} />
              <Route path="/my-progress/photos" component={ProgressPhotos} />
              <Route path="/my-progress/add" component={ProgressAddEntry} />
              <Route path="/my-progress/:metricKey/entry/:id" component={ProgressEntryDetail} />
              <Route path="/my-progress/:metricKey" component={ProgressMetricDetail} />
              <Route path="/goals/nutrition/new" component={GoalsNutritionNew} />
              <Route path="/goals/nutrition/edit/:id" component={GoalsNutritionEdit} />
              <Route path="/goals/bodyweight/edit/:id" component={GoalsBodyweightEdit} />
              <Route path="/goals/custom/edit/:id" component={GoalsCustomEdit} />
              <Route path="/goals/habits/:id" component={GoalsHabitDetail} />
              <Route path="/goals/habits" component={GoalsHabits} />
              <Route path="/goals/new" component={GoalsNew} />
              <Route path="/goals" component={Goals} />
              <Route path="/habits" component={Habits} />
              <Route path="/habit-selection" component={HabitSelection} />
              <Route path="/habit-detail/:id" component={HabitDetail} />
              <Route path="/habit-custom" component={HabitCustom} />
              <Route path="/habit-edit/:id" component={HabitEdit} />
              <Route path="/habit-tracking/:id" component={HabitTracking} />
              <Route path="/habit-progress/:id" component={HabitProgress} />
              <Route path="/active-workout/:logId" component={ActiveWorkout} />
              <Route path="/active-workout/:logId/notes" component={WorkoutNotes} />
              <Route path="/active-workout/:workoutLogId/substitute/:exerciseIndex" component={SubstituteExercise} />
              <Route path="/build-wod" component={BuildWod} />
              <Route path="/wod/:id" component={WodDetail} />
            </>
          )}
          <Route component={NotFound} />
        </Switch>
      </div>
      {isAuthenticated && !hideBottomNav && (
        <>
          <FloatingActionButton onClick={() => setShowQuickAddMenu(true)} isMenuOpen={showQuickAddMenu} />
          <QuickAddMenu open={showQuickAddMenu} onClose={() => setShowQuickAddMenu(false)} />
          <BottomNavigation onCoachOpen={() => setCoachOpen(true)} />
        </>
      )}
      {isAuthenticated && !location.startsWith('/admin') && !isFullscreenWorkout && location !== '/onboarding' && location !== '/profile' && !location.startsWith('/profile/') && location !== '/achievements' && <CoachChat isOpen={coachOpen} onOpenChange={setCoachOpen} />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserPreferencesProvider>
        <TooltipProvider>
          <WorkoutSessionProvider>
            <Toaster />
            <BadgeNotification />
            <Router />
          </WorkoutSessionProvider>
        </TooltipProvider>
      </UserPreferencesProvider>
    </QueryClientProvider>
  );
}

export default App;
