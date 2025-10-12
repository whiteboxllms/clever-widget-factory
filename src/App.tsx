import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppVersion } from "@/components/AppVersion";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { OrganizationProvider } from "@/hooks/useOrganization";
import { AppSettingsProvider } from "@/hooks/useAppSettings";
import { useSessionMonitor } from "@/hooks/useSessionMonitor";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import SuperAdminRoute from "@/components/SuperAdminRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Tools from "./pages/Tools";
import Inventory from "./pages/Inventory";
import InventorySummary from "./pages/InventorySummary";
import CombinedAssets from "./pages/CombinedAssets";
import CheckIn from "./pages/CheckIn";
import Missions from "./pages/Missions";
import EditMission from "./pages/EditMission";
import Actions from "./pages/Actions";
import Issues from "./pages/Issues";
import Audit from "./pages/Audit";
import AuditTool from "./pages/AuditTool";
import ScoringPrompts from "./pages/ScoringPrompts";
import Organization from "./pages/Organization";
import AdminOrganizations from "./pages/AdminOrganizations";
import NotFound from "./pages/NotFound";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import AcceptInvite from "./pages/AcceptInvite";
import SettingsPage from "./pages/Settings";
import ReportsTestPage from "./pages/ReportsTestPage";

const queryClient = new QueryClient();

function AppContent() {
  useSessionMonitor(); // Add session monitoring
  
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/welcome" element={
        <ProtectedRoute>
          <Index />
        </ProtectedRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/tools" element={
        <ProtectedRoute>
          <Tools />
        </ProtectedRoute>
      } />
      <Route path="/tools/:toolId/edit" element={
        <ProtectedRoute>
          <Tools />
        </ProtectedRoute>
      } />
      <Route path="/combined-assets" element={
        <ProtectedRoute>
          <CombinedAssets />
        </ProtectedRoute>
      } />
      <Route path="/inventory" element={
        <ProtectedRoute>
          <Inventory />
        </ProtectedRoute>
      } />
      <Route path="/inventory/summary" element={
        <ProtectedRoute>
          <InventorySummary />
        </ProtectedRoute>
      } />
      <Route path="/checkin" element={
        <ProtectedRoute>
          <CheckIn />
        </ProtectedRoute>
      } />
      <Route path="/missions" element={
        <ProtectedRoute>
          <Missions />
        </ProtectedRoute>
      } />
      <Route path="/missions/:missionId/edit" element={
        <ProtectedRoute>
          <EditMission />
        </ProtectedRoute>
      } />
      <Route path="/actions" element={
        <ProtectedRoute>
          <Actions />
        </ProtectedRoute>
      } />
      <Route path="/issues" element={
        <ProtectedRoute>
          <Issues />
        </ProtectedRoute>
      } />
      <Route path="/audit" element={
        <ProtectedRoute>
          <Audit />
        </ProtectedRoute>
      } />
      <Route path="/audit/tool/:toolId" element={
        <ProtectedRoute>
          <AuditTool />
        </ProtectedRoute>
      } />
      <Route path="/prompts" element={
        <ProtectedRoute>
          <ScoringPrompts />
        </ProtectedRoute>
      } />
      <Route path="/reports/test" element={
        <ProtectedRoute>
          <ReportsTestPage />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/analytics" element={
        <AdminRoute>
          <AnalyticsDashboard />
        </AdminRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      } />
      <Route path="/organization" element={
        <ProtectedRoute>
          <Organization />
        </ProtectedRoute>
      } />
      <Route path="/organization/:organizationId" element={
        <ProtectedRoute>
          <Organization />
        </ProtectedRoute>
      } />
      <Route path="/admin/organizations" element={
        <SuperAdminRoute>
          <AdminOrganizations />
        </SuperAdminRoute>
      } />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <OrganizationProvider>
        <AppSettingsProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AppVersion />
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </TooltipProvider>
        </AppSettingsProvider>
      </OrganizationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;