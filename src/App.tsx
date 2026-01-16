import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { offlineQueryConfig, offlineMutationConfig } from "@/lib/queryConfig";
import { queryCachePersister, QUERY_CACHE_MAX_AGE } from "@/lib/queryPersistAdapter";
import { setQueryClient } from "@/lib/apiService";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useCognitoAuth";
import { OrganizationProvider } from "@/hooks/useOrganization";
import { AppSettingsProvider } from "@/hooks/useAppSettings";
import { useSessionMonitor } from "@/hooks/useSessionMonitor";
import { TokenRefreshIndicator } from "@/components/TokenRefreshIndicator";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import LeadershipRoute from "@/components/LeadershipRoute";
import SuperAdminRoute from "@/components/SuperAdminRoute";


import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";


import InventorySummary from "./pages/InventorySummary";
import CombinedAssets from "./pages/CombinedAssets";
import CheckIn from "./pages/CheckIn";
import Missions from "./pages/Missions";
import EditMission from "./pages/EditMission";
import Actions from "./pages/Actions";
import Explorations from "./pages/Explorations";
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
import UploadDebug from "./pages/UploadDebug";
import UploadMobileTest from "./pages/UploadMobileTest";
import SariSariChat from "./pages/SariSariChat";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      ...offlineQueryConfig,
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors, but retry on network errors
        if (error instanceof Error && error.message.includes('fetch')) {
          return failureCount < 3;
        }
        return false;
      },
    },
    mutations: {
      ...offlineMutationConfig,
      retry: (failureCount, error) => {
        // Retry mutations on network errors only
        if (error instanceof Error && error.message.includes('fetch')) {
          return failureCount < 3;
        }
        return false;
      },
    },
  },
});

// Initialize apiService with query client for automatic cache updates
setQueryClient(queryClient);

function AppContent() {
  useSessionMonitor();

  return (
    <>
      <TokenRefreshIndicator />
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/welcome"
          element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tools"
          element={<Navigate to="/combined-assets" replace />}
        />
        <Route
          path="/tools/:toolId/edit"
          element={<Navigate to="/combined-assets" replace />}
        />
        <Route
          path="/combined-assets"
          element={
            <ProtectedRoute>
              <CombinedAssets />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory"
          element={<Navigate to="/combined-assets?view=stock" replace />}
        />
        <Route
          path="/inventory/summary"
          element={
            <ProtectedRoute>
              <InventorySummary />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkin"
          element={
            <ProtectedRoute>
              <CheckIn />
            </ProtectedRoute>
          }
        />
        <Route
          path="/missions"
          element={
            <ProtectedRoute>
              <Missions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/missions/:missionId/edit"
          element={
            <ProtectedRoute>
              <EditMission />
            </ProtectedRoute>
          }
        />
        <Route
          path="/actions/:actionId?"
          element={
            <ProtectedRoute>
              <Actions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/explorations"
          element={
            <ProtectedRoute>
              <Explorations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/issues"
          element={
            <ProtectedRoute>
              <Issues />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit"
          element={
            <ProtectedRoute>
              <Audit />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit/tool/:toolId"
          element={
            <ProtectedRoute>
              <AuditTool />
            </ProtectedRoute>
          }
        />
        <Route
          path="/prompts"
          element={
            <ProtectedRoute>
              <ScoringPrompts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/analytics"
          element={
            <LeadershipRoute>
              <AnalyticsDashboard />
            </LeadershipRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organization"
          element={
            <LeadershipRoute>
              <Organization />
            </LeadershipRoute>
          }
        />
        <Route
          path="/organization/:organizationId"
          element={
            <LeadershipRoute>
              <Organization />
            </LeadershipRoute>
          }
        />
        <Route
          path="/admin/organizations"
          element={
            <SuperAdminRoute>
              <AdminOrganizations />
            </SuperAdminRoute>
          }
        />
        <Route
          path="/debug/upload"
          element={
            <ProtectedRoute>
              <UploadDebug />
            </ProtectedRoute>
          }
        />
        <Route
          path="/debug/upload-mobile-test"
          element={
            <ProtectedRoute>
              <UploadMobileTest />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sari-sari-chat"
          element={
            <ProtectedRoute>
              <SariSariChat />
            </ProtectedRoute>
          }
        />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister: queryCachePersister,
      maxAge: QUERY_CACHE_MAX_AGE,
    }}
  >
    <AuthProvider>
      <OrganizationProvider>
        <AppSettingsProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || "/"}>
              <AppContent />
            </BrowserRouter>
          </TooltipProvider>
        </AppSettingsProvider>
      </OrganizationProvider>
    </AuthProvider>
  </PersistQueryClientProvider>
);

export default App;